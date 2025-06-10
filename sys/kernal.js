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
        await this.pfs.mkdir('/sys/cmd').catch(e => {}); // Ensure user command dir exists
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
        const commandGroups = parse(line);

        try {
            for (const group of commandGroups) {
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
            for (const command of pipeline.commands) {
                const outputBuffer = [];
                this.write = (data) => outputBuffer.push(data);
                this.writeln = (data) => outputBuffer.push(data + '\n');
                
                await this.execute(command, pipedInput);
                
                pipedInput = outputBuffer.join('').replace(/\r/g, '');
            }

            if (pipeline.redirectMode) {
                if (!pipeline.redirectPath) {
                   originalWriteln(`-qrx: syntax error near unexpected token 'newline'`);
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
                originalWrite(pipedInput);
            }
        } finally {
            this.write = originalWrite;
            this.writeln = originalWriteln;
        }
    }

    /**
     * The core command execution logic. It now accepts a parsed command object
     * and can execute both JS modules and shell scripts.
     * @param {object} commandObject - A parsed command object { command, args }.
     * @param {string|null} stdin - Piped input from a previous command.
     */
    async execute({ command, args }, stdin = null) {
        const commandName = command;

        if (!commandName) {
            if (stdin !== null) this.write(stdin);
            return;
        }
        
        const assignMatch = commandName.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)/s);
        if (assignMatch && args.length === 0) {
            this.env[assignMatch[1]] = assignMatch[2].replace(/^['"]|['"]$/g, '');
            return;
        }

        let commandModule = null;

        // 1. Check for user-defined JS command in `/sys/cmd/`.
        const userJsCommandPath = `/sys/cmd/${commandName.replace(/\.js$/, '')}.js`;
        try {
            const commandCode = await this.pfs.readFile(userJsCommandPath, 'utf8');
            if(commandCode) {
                const blob = new Blob([commandCode], { type: 'text/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                commandModule = await import(blobUrl);
                URL.revokeObjectURL(blobUrl); 
            }
        } catch (e) { /* Fallback */ }
        
        if (commandModule && typeof commandModule.default?.run === 'function') {
            await commandModule.default.run(this, args, stdin);
            return;
        }

        // 2. Try to execute a shell script, checking CWD first, then /sys/cmd
        let scriptContent = null;
        try {
            // First, try to find the script relative to the current working directory.
            const localScriptPath = this.resolvePath(commandName);
            scriptContent = await this.pfs.readFile(localScriptPath, 'utf8');
        } catch (e) {
            // If not found locally, try the system command path.
            try {
                const systemScriptPath = `/sys/cmd/${commandName}`;
                scriptContent = await this.pfs.readFile(systemScriptPath, 'utf8');
            } catch (e2) {
                // If it's not in either location, it's not a script we can run.
                scriptContent = null;
            }
        }

        if (scriptContent !== null) {
            const scriptLines = scriptContent.split('\n');
            for (const line of scriptLines) {
                if (line.trim() && !line.trim().startsWith('#')) {
                    // Each line of the script is parsed and executed as a new pipeline.
                    const commandGroups = parse(line);
                    for (const group of commandGroups) {
                        await this.runPipeline(group);
                    }
                }
            }
            return; // Script execution successful, so we are done.
        }

        // 3. Fallback to built-in JS commands
        const builtinCommand = this.commands[commandName];
        if (builtinCommand && typeof builtinCommand.run === 'function') {
            await builtinCommand.run(this, args, stdin);
            return;
        }
        
        // 4. Handle kernel built-ins or error out
        this.handleBuiltins(commandName, args);
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

