// -----------------------------------------------------------------------------
// file: sys/kernel.js
// -----------------------------------------------------------------------------
import http from 'https://unpkg.com/isomorphic-git/http/web/index.js';
import parse from './parser.js';

export default class Kernel {
    constructor(options = {}) {
        const defaults = {
            container: document.getElementById('terminal'),
            welcomeMessage: 'Welcome to the QRx Kernel.\r\n',
            // All paths are absolute from the server root.
            repo: {
                commands: '/sys/cmd/index.js',
                inputHandler: '/sys/handlers/input.js',
                keyHandlers: '/sys/handlers/keys/index.js'
            },
            gitConfig: { dir: '/', corsProxy: 'https://cors.isomorphic-git.org' }
        };
        this.config = { 
            ...defaults, 
            ...options, 
            repo: { ...defaults.repo, ...(options.repo || {}) },
            gitConfig: { ...defaults.gitConfig, ...(options.gitConfig || {}) },
        };

        this.fs = new window.LightningFS('main_qrxworld_qrx');
        this.pfs = this.fs.promises;
        this.git = window.isomorphicGit; 
        this.http = http;
        this.term = new window.Terminal({
            cursorBlink: true, fontSize: 14, fontFamily: 'monospace',
            theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4' },
            allowTransparency: true,
        });

        this.write = this.write.bind(this);
        this.writeln = this.writeln.bind(this);
        
        this.term.open(this.config.container);
        this.term.focus();

        this.cwd = '/'; this.env = {};
        this.history = []; this.historyIndex = -1;
        this.commandBuffer = ''; this.commandInProgress = false;
        this.lastExitStatus = 0;
        this.commands = {}; this.inputHandler = null;
        this.currentProcess = null;

        this.init().catch(err => {
            console.error("Initialization failed:", err);
            this.writeln(`\x1B[1;31mFATAL: Initialization failed. Check console for details.\x1B[0m`);
            this.commandInProgress = true;
        });
    }

    async init() {
        await this.pfs.mkdir('/sys/cmd').catch(e => {});
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
     * Loads all necessary modules using absolute paths defined in the config.
     */
    async loadModules() {
        this.writeln('Loading modules...');
        await this.loadInputHandler();
        await this.loadKeyHandlers();
        await this.loadCommandManifest();
        this.writeln('All modules loaded.');
    }

    async loadInputHandler() {
        try {
            const { default: InputHandler } = await import(this.config.repo.inputHandler);
            this.inputHandler = new InputHandler();
        } catch (error) {
            this.writeln(`\x1B[1;31mFATAL: Could not load Input Handler from ${this.config.repo.inputHandler}\x1B[0m`);
            console.error(error);
        }
    }

    /**
     * FINAL BUGFIX: This version assumes the manifest provides the correct, full absolute paths.
     * It performs no path manipulation.
     */
    async loadKeyHandlers() {
        if (!this.inputHandler) return;
        try {
            const manifestPath = this.config.repo.keyHandlers;
            const { default: keyManifest } = await import(manifestPath);

            for (const keyName in keyManifest) {
                // Assume the manifest provides the correct and full absolute path.
                const handlerPath = keyManifest[keyName];
                const handlerModule = await import(handlerPath);
                this.inputHandler.register(keyName, handlerModule.default);
            }
        } catch (error) {
            this.writeln(`\x1B[1;31mFATAL: Could not load Key Handlers from ${this.config.repo.keyHandlers}\x1B[0m`);
            console.error(error);
        }
    }

    async loadCommandManifest() {
        try {
            // This imports '/sys/cmd/index.js', which then correctly handles its own relative paths.
            const { default: commandRegistry } = await import(this.config.repo.commands);
            this.commands = commandRegistry;
        } catch (error) {
            this.writeln(`\x1B[1;31mFATAL: Could not load Command Manifest from ${this.config.repo.commands}\x1B[0m`);
            console.error(error);
        }
    }
    
    prompt() {
        this.commandBuffer = '';
        this.commandInProgress = false;
        this.term.focus();
        this.term.write(`\r\n\x1B[1;32muser@host\x1B[0m:\x1B[1;34m${this.cwd}\x1B[0m$ `);
    }

    write(data) { this.term.write(String(data).replace(/\n/g, '\r\n')); }
    writeln(data) { this.write(data + '\r\n'); }
    
    cancelCurrentProcess() {
        if (this.currentProcess?.cancel) {
            this.currentProcess.cancel();
        } else {
            this.writeln('^C');
            this.prompt();
        }
    }

    async runCommand(line) {
        this.commandInProgress = true;
        const ast = parse(line);
        try {
            for (const node of ast) {
                const { stdout, status } = await this.executeNode(node);
                if (stdout && !node.redirection) { this.write(stdout); }
            }
        } catch (error) {
            this.writeln(`\x1B[1;31mError: ${error.message}\x1B[0m`);
            console.error(error);
        } finally {
            this.commandInProgress = false;
            this.prompt();
        }
    }

    async executeNode(node, stdin = null) {
        if (!node) return { stdout: '', status: 0 };
        let result = { stdout: '', status: 0 };
        switch (node.type) {
            case 'error':
                result = { stdout: `-qrx: parse error: ${node.message}\n`, status: 2 };
                break;
            case 'pipeline':
                const leftResult = await this.executeNode(node.from, stdin);
                result = await this.executeNode(node.to, leftResult.stdout);
                break;
            case 'group':
                const groupOutputBuffer = [];
                let groupStatus = 0;
                for (const cmdNode of node.commands) {
                    const subResult = await this.executeNode(cmdNode, stdin);
                    groupOutputBuffer.push(subResult.stdout);
                    groupStatus = subResult.status;
                }
                result = { stdout: groupOutputBuffer.join(''), status: groupStatus };
                break;
            case 'command':
                const buffer = [];
                const originalWrite = this.write;
                const originalWriteln = this.writeln;
                this.write = (data) => buffer.push(data);
                this.writeln = (data) => buffer.push(data + '\n');
                let commandStatus = 0;
                try {
                    commandStatus = await this.executeSingleCommand(node, stdin);
                } finally {
                    this.write = originalWrite;
                    this.writeln = originalWriteln;
                }
                result = { stdout: buffer.join(''), status: commandStatus };
                break;
        }
        if (node.redirection) {
            const { mode, file } = node.redirection;
            const path = this.resolvePath(file);
            try {
                if (mode === 'append') {
                    const existing = await this.pfs.readFile(path, 'utf8').catch(() => '');
                    await this.pfs.writeFile(path, existing + result.stdout);
                } else {
                    await this.pfs.writeFile(path, result.stdout);
                }
                result.stdout = '';
            } catch (e) {
                this.writeln(`-qrx: ${file}: ${e.message}`);
                result.status = 1;
            }
        }
        this.lastExitStatus = result.status;
        return result;
    }

    async executeSingleCommand({ name, args }, stdin = null) {
        const expandedArgs = args.map(arg => {
            if (arg === '$?') { return String(this.lastExitStatus); }
            return arg;
        });
        if (!name) {
            if (stdin !== null) this.write(stdin);
            return 0;
        }
        const assignMatch = name.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)/s);
        if (assignMatch && expandedArgs.length === 0) {
            this.env[assignMatch[1]] = assignMatch[2].replace(/^['"]|['"]$/g, '');
            return 0;
        }
        const builtin = this.commands[name];
        if (builtin?.run) {
            let status = 0;
            try {
                this.currentProcess = builtin.run(this, expandedArgs, stdin);
                const commandResult = await this.currentProcess;
                if (typeof commandResult === 'number') {
                    status = commandResult;
                }
            } catch (err) {
                this.writeln(`-qrx: ${name}: ${err.message}`);
                status = 1;
            } finally {
                this.currentProcess = null;
            }
            return status;
        }
        return this.handleBuiltins(name, expandedArgs);
    }
    
    handleBuiltins(name, args) {
        switch (name) {
            case 'help':
                const cmds = Object.keys(this.commands).sort().join(', ');
                this.writeln(`Builtins: help, clear. Commands: ${cmds}`);
                return 0;
            case 'clear':
                this.term.clear();
                return 0;
            case '':
                return 0;
            default:
                this.writeln(`command not found: ${name}`);
                return 127;
        }
    }

    /**
     * Resolves a relative or absolute path to a fully qualified absolute path.
     * This version correctly handles '.' and '..' segments.
     * @param {string} path - The path to resolve.
     * @returns {string} The resolved absolute path.
     */
    resolvePath(path) {
        if (!path) return this.cwd;

        // Determine the starting point for resolution.
        const fullPath = path.startsWith('/') ? path : `${this.cwd}/${path}`;
        
        const parts = fullPath.split('/');
        const resolvedParts = [];

        for (const part of parts) {
            if (part === '..') {
                // Go up one level, but not beyond the root.
                if (resolvedParts.length > 0) {
                    resolvedParts.pop();
                }
            } else if (part !== '.' && part !== '') {
                // Ignore '.' and empty parts (from multiple slashes), add all others.
                resolvedParts.push(part);
            }
        }
        
        // Join the parts and ensure the path starts with a '/'.
        const finalPath = `/${resolvedParts.join('/')}`;
        return finalPath;
    }
}

