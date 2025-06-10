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
            // Paths now point to the new '/sys/' directory structure.
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
        // Access the libraries from the global window object.
        this.fs = new window.LightningFS('main_qrxworld_qrx'); // Namespaced filesystem
        this.pfs = this.fs.promises;
        this.git = window.isomorphicGit; 
        this.http = http;

        this.term = new window.Terminal({
            cursorBlink: true, fontSize: 14, fontFamily: 'monospace',
            theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4' },
            allowTransparency: true,
        });
        
        // Open the terminal early so we can report any errors during init.
        this.term.open(this.config.container);
        this.term.focus();

        this.cwd = '/'; this.env = {};
        this.history = []; this.historyIndex = -1;
        this.commandBuffer = ''; this.commandInProgress = false;
        
        // --- Modular Components ---
        this.commands = {}; this.inputHandler = null;

        // --- Initialization ---
        this.init().catch(err => {
            console.error("Initialization failed:", err);
            this.writeln(`\x1B[1;31mFATAL: Initialization failed. Check console for details.\x1B[0m`);
            this.commandInProgress = true; // Halt execution
        });
    }

    /**
     * Initializes the filesystem and loads all modules.
     */
    async init() {
        // Create the root directory.
        await this.pfs.mkdir(this.cwd).catch(e => {});

        // Load all modular components.
        await this.loadModules();

        // Attach the key handler now that modules are loaded.
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
        // Instantiate the input dispatcher first.
        await this.loadInputHandler(this.config.repo.inputHandler);
        // Load all key-specific handlers and register them with the dispatcher.
        await this.loadKeyHandlers(this.config.repo.keyHandlers);
        // Load the manifest for the built-in, default commands.
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
    write(data) { this.term.write(String(data).replace(/\n/g, '\r\n')); }
    writeln(data) { this.write(data + '\r\n'); }

    // --- Command Execution ---
    async runCommand(line) {
        this.commandInProgress = true;
        try {
            line = line.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, v) => this.env[v] || '');
            const assignMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)/);
            if (assignMatch) {
                this.env[assignMatch[1]] = assignMatch[2].replace(/^"|"$/g, '');
            } else {
                await this.execute(line);
            }
        } catch (error) {
            this.writeln(`\x1B[1;31mError: ${error.message}\x1B[0m`);
            console.error(error);
        }
        this.prompt();
    }

    /**
     * The core command execution logic.
     * Implements the override system: checks for a user command in the virtual
     * filesystem before falling back to built-in commands.
     * @param {string} line - The full command line to execute.
     */
    async execute(line) {
        const parts = this.parseArguments(line);
        const commandName = parts[0];
        const args = parts.slice(1);

        if (!commandName) return;

        // 1. Check for a user-defined command in the virtual filesystem first.
        const userCommandPath = `/sys/cmd/${commandName}.js`;
        let userCommandModule = null;
        try {
            const commandCode = await this.pfs.readFile(userCommandPath, 'utf8');
            const blob = new Blob([commandCode], { type: 'text/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            userCommandModule = await import(blobUrl);
            URL.revokeObjectURL(blobUrl); // Clean up the URL object.
        } catch (e) {
            // This is expected if the file doesn't exist. We just ignore the error.
        }

        if (userCommandModule && typeof userCommandModule.default.run === 'function') {
            await userCommandModule.default.run(this, args);
            return;
        }

        // 2. If no user command was found, check for a built-in command.
        const builtinCommand = this.commands[commandName];
        if (builtinCommand && typeof builtinCommand.run === 'function') {
            await builtinCommand.run(this, args);
            return;
        }
        
        // 3. If neither user nor built-in found, handle kernel built-ins or error.
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

    // --- Utility Methods ---
    parseArguments(line) {
        if (!line) return [''];
        const args = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        return args.map(arg => arg.startsWith('"') && arg.endsWith('"') ? arg.slice(1, -1) : arg);
    }

    resolvePath(path) {
        if (!path || path === '.') return this.cwd;
        if (path.startsWith('/')) return path.replace(/\/+/g, '/');
        const newPath = this.cwd === '/' ? `/${path}` : `${this.cwd}/${path}`;
        return newPath.replace(/\/+/g, '/');
    }
}

