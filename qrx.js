// These libraries are loaded globally from the CDN scripts in index.html
const git = window.isomorphicGit;
const fs = new LightningFS('fs');
const http = window.isomorphicGit.http.web;

/**
 * QRx is the main class for the web terminal.
 * It acts as a kernel, holding state and connecting modular components,
 * but contains no hardcoded application logic for input or commands.
 */
export default class QRx {
    constructor(options = {}) {
        // --- Default Configuration ---
        const defaults = {
            container: document.getElementById('terminal'),
            welcomeMessage: 'Welcome to a fully modular browser-based shell.\r\n',
            // Paths to the external modules that define core behaviors.
            repo: {
                commands: './commands/list.js',
                inputHandler: './handlers/input.js'
            },
            gitConfig: {
                dir: '/repo',
                corsProxy: 'https://cors.isomorphic-git.org',
            }
        };
        // Deep merge of defaults and options
        this.config = { 
            ...defaults, 
            ...options, 
            repo: { ...defaults.repo, ...(options.repo || {}) },
            gitConfig: { ...defaults.gitConfig, ...(options.gitConfig || {}) },
        };

        // --- Core Components ---
        this.fs = fs;
        this.pfs = fs.promises;
        this.git = git;
        this.http = http;
        this.term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'monospace',
            theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4' },
            allowTransparency: true,
        });

        // --- Shell State ---
        this.cwd = '/';
        this.env = {};
        this.history = [];
        this.historyIndex = -1;
        this.commandBuffer = '';
        this.commandInProgress = false;
        
        // --- Modular Components ---
        this.commands = {};
        this.inputHandler = null;

        // --- Initialization ---
        this.init();
    }

    /**
     * Initializes the terminal and loads all external modules.
     */
    async init() {
        await this.pfs.mkdir(this.cwd).catch(e => {});
        this.term.open(this.config.container);
        this.term.focus();

        // Load all external logic modules (input handlers, commands, etc.)
        await this.loadModules();

        // The terminal's key events are now delegated to the loaded input handler.
        // The QRx class itself no longer knows how to handle a keystroke.
        this.term.onKey((keyEvent) => {
            if (this.inputHandler && typeof this.inputHandler.handle === 'function') {
                this.inputHandler.handle(this, keyEvent); // Pass shell context and the event
            }
        });

        this.term.write(this.config.welcomeMessage);
        this.prompt();
    }

    /**
     * Loads all necessary modules as defined in the configuration.
     */
    async loadModules() {
        this.writeln('Loading modules...');
        // Load the module responsible for handling user keyboard input.
        await this.loadInputHandler(this.config.repo.inputHandler);
        // Load the module that defines the list of available commands.
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

    async loadCommandManifest(url) {
        try {
            const commandRegistry = await import(url);
            this.commands = commandRegistry.default;
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
            // The command runner can eventually be modularized as well.
            line = line.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, v) => this.env[v] || '');
            const assignMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)/);
            if (assignMatch) {
                this.env[assignMatch[1]] = assignMatch[2].replace(/^"|"$/g, '');
            } else {
                const parts = this.parseArguments(line);
                const commandName = parts[0];
                const args = parts.slice(1);
                const command = this.commands[commandName];

                if (command && typeof command.run === 'function') {
                    await command.run(this, args);
                } else {
                    this.handleBuiltins(commandName, args);
                }
            }
        } catch (error) {
            this.writeln(`\x1B[1;31mError: ${error.message}\x1B[0m`);
            console.error(error);
        }
        this.prompt();
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

