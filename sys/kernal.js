// system/kernel.js

// The main libraries are now loaded globally from index.html.
import http from 'https://unpkg.com/isomorphic-git/http/web/index.js';

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
        // This prevents context-related errors when methods are passed as callbacks.
        this.write = this.write.bind(this);
        this.writeln = this.writeln.bind(this);
        
        this.term.open(this.config.container);
        this.term.focus();

        this.cwd = '/'; this.env = {};
        this.history = []; this.historyIndex = -1;
        this.commandBuffer = ''; this.commandInProgress = false;
        
        this.commands = {}; this.inputHandler = null;

        this.init().catch(err => {
            console.error("Initialization failed:", err);
            this.writeln(`\x1B[1;31mFATAL: Initialization failed. Check console for details.\x1B[0m`);
            this.commandInProgress = true;
        });
    }

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
    async runCommand(line) {
        this.commandInProgress = true;
        const originalWrite = this.write;
        const originalWriteln = this.writeln;

        try {
            let commandToExecute = line;
            let redirectPath = null;
            let redirectMode = null;

            // Check for redirection first, as it has precedence for the *entire* pipeline's output.
            const appendIndex = line.lastIndexOf('>>');
            if (appendIndex !== -1) {
                commandToExecute = line.substring(0, appendIndex).trim();
                redirectPath = line.substring(appendIndex + 2).trim();
                redirectMode = 'append';
            } else {
                const overwriteIndex = line.lastIndexOf('>');
                if (overwriteIndex !== -1) {
                    commandToExecute = line.substring(0, overwriteIndex).trim();
                    redirectPath = line.substring(overwriteIndex + 1).trim();
                    redirectMode = 'overwrite';
                }
            }
            
            if (redirectMode && !redirectPath) {
                this.writeln(`-qrx: syntax error near unexpected token 'newline'`);
                return;
            }

            // Now, handle the pipeline for the part of the command that will be executed.
            const pipeline = commandToExecute.split('|').map(cmd => cmd.trim());
            let pipedInput = null;

            for (const command of pipeline) {
                const outputBuffer = [];
                // Temporarily hijack terminal output for every command in the pipeline
                this.write = (data) => outputBuffer.push(data);
                this.writeln = (data) => outputBuffer.push(data + '\n');
                
                // Pass the output of the previous command as stdin to the current one
                await this.execute(command, pipedInput);
                
                // The output of the current command becomes the input for the next one
                pipedInput = outputBuffer.join('').replace(/\r/g, '');
            }

            // After the pipeline is finished, handle the final output.
            if (redirectMode) {
                const absolutePath = this.resolvePath(redirectPath);
                if (redirectMode === 'append') {
                    let existingContent = await this.pfs.readFile(absolutePath, 'utf8').catch(() => '');
                    await this.pfs.writeFile(absolutePath, existingContent + pipedInput);
                } else {
                    await this.pfs.writeFile(absolutePath, pipedInput);
                }
            } else {
                // If not redirecting, print the final output to the real terminal.
                originalWrite(pipedInput);
            }

        } catch (error) {
            // Restore original methods before trying to use them.
            this.write = originalWrite;
            this.writeln = originalWriteln;
            this.writeln(`\x1B[1;31mError: ${error.message}\x1B[0m`);
            console.error(error);
        } finally {
            this.write = originalWrite;
            this.writeln = originalWriteln;
            this.prompt();
        }
    }

    /**
     * The core command execution logic. It now accepts an optional stdin argument.
     * @param {string} line - The command line to execute.
     * @param {string|null} stdin - Piped input from a previous command.
     */
    async execute(line, stdin = null) {
        line = line.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, v) => this.env[v] || '');

        const assignMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)/);
        if (assignMatch) {
            this.env[assignMatch[1]] = assignMatch[2].replace(/^"|"$/g, '');
            return;
        }

        const parts = this.parseArguments(line);
        const commandName = parts[0];
        const args = parts.slice(1);

        if (!commandName) {
            // If there's only stdin, echo it. This handles `echo "foo" |`
            if (stdin) this.write(stdin);
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
            // Fallback to built-in if user command doesn't exist.
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
    
    parseArguments(line) {
        if (!line) return [''];
        const args = line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
        return args.map(arg => (arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'")) ? arg.slice(1, -1) : arg);
    }
    
    resolvePath(path) {
        if (!path || path === '.') return this.cwd;
        if (path.startsWith('/')) return path.replace(/\/+/g, '/');
        const newPath = this.cwd === '/' ? `/${path}` : `${this.cwd}/${path}`;
        return newPath.replace(/\/+/g, '/');
    }
}

