// system/kernel.js

// The main libraries are now loaded globally from index.html.
import http from 'https://unpkg.com/isomorphic-git/http/web/index.js';
// Import the new parser module.
import parse from './parser.js';

/**
 * Kernel is the main class for the web terminal.
 * It acts as a kernel, holding state and loading all external modules
 * for commands and input handling.
 */
export default class Kernel {
    constructor(options = {}) {
        // --- Default Configuration ---
        const defaults = {
            container: document.getElementById('terminal'),
            welcomeMessage: 'Welcome to the QRx Kernel.\r\n',
            // Paths are relative to this kernel.js file's location.
            repo: {
                commands: './cmd/index.js',
                inputHandler: './handlers/input.js',
                keyHandlers: './handlers/keys/index.js'
            },
            gitConfig: { dir: '/', corsProxy: 'https://cors.isomorphic-git.org' }
        };
        // Deep merge of defaults and options
        this.config = { 
            ...defaults, 
            ...options, 
            repo: { ...defaults.repo, ...(options.repo || {}) },
            gitConfig: { ...defaults.gitConfig, ...(options.gitConfig || {}) },
        };

        // --- Core Components & State ---
        this.fs = new window.LightningFS('main_qrxworld_qrx'); // Namespaced filesystem
        this.pfs = this.fs.promises;
        this.git = window.isomorphicGit; 
        this.http = http;
        this.term = new window.Terminal({
            cursorBlink: true, fontSize: 14, fontFamily: 'monospace',
            theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4' },
            allowTransparency: true,
        });

        // Bind core I/O methods to ensure 'this' is always correct.
        this.write = this.write.bind(this);
        this.writeln = this.writeln.bind(this);
        
        this.term.open(this.config.container);
        this.term.focus();

        this.cwd = '/'; this.env = {};
        this.history = []; this.historyIndex = -1;
        this.commandBuffer = ''; this.commandInProgress = false;
        
        this.commands = {}; this.inputHandler = null;

        // --- Initialization ---
        this.init().catch(err => {
            console.error("Initialization failed:", err);
            this.writeln(`\x1B[1;31mFATAL: Initialization failed. Check console for details.\x1B[0m`);
            this.commandInProgress = true;
        });
    }

    /**
     * Initializes the filesystem and loads all modules.
     */
    async init() {
        await this.pfs.mkdir(this.cwd).catch(e => {});
        await this.loadModules();
        this.term.onKey((keyEvent) => {
            if (this.inputHandler) {
                this.inputHandler.handle(this, keyEvent);
            }
        });
        this.term.write(this.config.welcomeMessage);
        this.prompt();
    }

    /**
     * Loads all necessary modules (input handlers and commands) as defined in the config.
     */
    async loadModules() {
        this.writeln('Loading modules...');
        await this.loadInputHandler(this.config.repo.inputHandler);
        await this.loadKeyHandlers(this.config.repo.keyHandlers);
        await this.loadCommandManifest(this.config.repo.commands);
        this.writeln('All modules loaded.');
    }
    
    async loadInputHandler(url) {
        try {
            const { default: InputHandler } = await import(url);
            this.inputHandler = new InputHandler();
        } catch (error) {
            this.writeln(`\x1B[1;31mFATAL: Could not load Input Handler from ${url}\x1B[0m`);
            console.error(`Failed to load Input Handler:`, error);
        }
    }

    async loadKeyHandlers(url) {
        if (!this.inputHandler) return;
        try {
            const { default: keyManifest } = await import(url);
            for (const keyName in keyManifest) {
                const path = keyManifest[keyName];
                const handlerModule = await import(path);
                this.inputHandler.register(keyName, handlerModule.default);
            }
        } catch (error) {
            this.writeln(`\x1B[1;31mFATAL: Could not load Key Handlers from ${url}\x1B[0m`);
            console.error(`Failed to load Key Handlers:`, error);
        }
    }

    async loadCommandManifest(url) {
        try {
            const { default: commandRegistry } = await import(url);
            this.commands = commandRegistry;
        } catch (error) {
            this.writeln(`\x1B[1;31mFATAL: Could not load Command Manifest from ${url}\x1B[0m`);
            console.error(`Failed to load Command Manifest:`, error);
        }
    }

    // --- Terminal I/O Methods ---
    prompt() {
        this.commandBuffer = '';
        this.commandInProgress = false;
        this.term.write(`\r\n\x1B[1;32muser@host\x1B[0m:\x1B[1;34m${this.cwd}\x1B[0m$ `);
    }

    write(data) {
        this.term.write(String(data).replace(/\n/g, '\r\n'));
    }

    writeln(data) {
        this.write(data + '\r\n');
    }

    // --- Command Execution ---
    /**
     * Top-level function to run a full command line. It uses the parser to break
     * the line into executable groups and runs them sequentially.
     * @param {string} line - The full command line input by the user.
     */
    async runCommand(line) {
        this.commandInProgress = true;
        // Use the new parser to get a structured list of command groups.
        const commandGroups = parse(line);

        try {
            for (const group of commandGroups) {
                // Each group is treated as a self-contained pipeline.
                await this.runPipeline(group);
            }
        } catch (error) {
            this.writeln(`\x1B[1;31mError: ${error.message}\x1B[0m`);
            console.error(error);
        } finally {
            this.prompt();
        }
    }

    /**
     * Executes a single, parsed pipeline object.
     * @param {object} pipeline - The parsed pipeline object from parser.js.
     */
    async runPipeline(pipeline) {
        const originalWrite = this.write;
        const originalWriteln = this.writeln;

        try {
            let pipedInput = null;

            // Iterate through each command in the pipeline
            for (const command of pipeline.commands) {
                const outputBuffer = [];
                this.write = (data) => outputBuffer.push(data);
                this.writeln = (data) => outputBuffer.push(data + '\n');
                
                // The execute function now takes a parsed command object
                await this.execute(command, pipedInput);
                
                pipedInput = outputBuffer.join('').replace(/\r/g, '');
            }

            // After the pipeline is finished, handle any redirection.
            if (pipeline.redirectMode) {
                if (!pipeline.redirectPath) {
                   this.writeln(`-qrx: syntax error near unexpected token 'newline'`);
                   return;
                }
                const absolutePath = this.resolvePath(pipeline.redirectPath);
                if (pipeline.redirectMode === 'append') {
                    let existingContent = await this.pfs.readFile(absolutePath, 'utf8').catch(() => '');
                    await this.pfs.writeFile(absolutePath, existingContent + pipedInput);
                } else { // 'overwrite'
                    await this.pfs.writeFile(absolutePath, pipedInput);
                }
            } else {
                // If not redirecting, print the final output to the real terminal.
                originalWrite(pipedInput);
            }
        } finally {
            // Restore original write methods after this pipeline is complete.
            this.write = originalWrite;
            this.writeln = originalWriteln;
        }
    }

    /**
     * The core command execution logic. It now accepts a parsed command object.
     * @param {object} commandObject - A parsed command object { command, args }.
     * @param {string|null} stdin - Piped input from a previous command.
     */
    async execute({ command, args }, stdin = null) {
        const commandName = command;

        if (!commandName) {
            if (stdin !== null) this.write(stdin);
            return;
        }
        
        // Variable Assignment is a special case. Check if the 'command' part is an assignment.
        // This is a simple check; it doesn't support `VAR = val`, only `VAR=val`.
        const assignMatch = commandName.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)/s);
        if (assignMatch && args.length === 0) {
            // The parser gives us the command as `VAR="value"`, so we match and extract.
            // assignMatch[1] is the variable name (VAR)
            // assignMatch[2] is the value ("value")
            // We strip quotes here, which the parser should have already handled, but this is safer.
            this.env[assignMatch[1]] = assignMatch[2].replace(/^['"]|['"]$/g, '');
            return;
        }

        const userCommandPath = `/sys/cmd/${commandName}.js`;
        let commandModule = null;
        try {
            const commandCode = await this.pfs.readFile(userCommandPath, 'utf8');
            const blob = new Blob([commandCode], { type: 'text/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            commandModule = await import(blobUrl);
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            commandModule = { default: this.commands[commandName] };
        }

        if (commandModule && typeof commandModule.default?.run === 'function') {
            await commandModule.default.run(this, args, stdin);
        } else {
            this.handleBuiltins(commandName, args);
        }
    }

    handleBuiltins(commandName, args) {
        switch (commandName) {
            case 'help':
                const cmds = Object.keys(this.commands).sort().join(', ');
                this.writeln(`Builtins: help, clear. Commands: ${cmds}`);
                break;
            case 'clear': this.term.clear(); break;
            case '': break;
            default: this.writeln(`command not found: ${commandName}`);
        }
    }
    
    resolvePath(path) {
        if (!path || path === '.') return this.cwd;
        if (path.startsWith('/')) return path.replace(/\/+/g, '/');
        const newPath = this.cwd === '/' ? `/${path}` : `${this.cwd}/${path}`;
        return newPath.replace(/\/+/g, '/');
    }
}

