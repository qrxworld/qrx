// -----------------------------------------------------------------------------
// file: sys/kernel.js
// -----------------------------------------------------------------------------
import http from 'https://unpkg.com/isomorphic-git/http/web/index.js';
import parse from './parser.js';
import AstExecutor from './engine/AstExecutor.js';
import { resolvePath } from './util/path.js';

export default class Kernel {
    constructor(options = {}) {
        const defaults = {
            container: document.getElementById('terminal'),
            welcomeMessage: 'Welcome to the QRx Kernel.\r\n',
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

        this.executor = new AstExecutor(this);

        this.write = this.write.bind(this);
        this.writeln = this.writeln.bind(this);
        this.resolvePath = (path) => resolvePath(path, this.cwd);
        
        this.term.open(this.config.container);
        this.term.focus();

        this.cwd = '/'; this.env = {};
        this.history = []; this.historyIndex = -1;
        this.commandBuffer = ''; this.commandInProgress = false;
        this.lastExitStatus = 0;
        this.commands = {}; this.inputHandler = null;
        this.currentProcess = null;
        this.jobId = 1;

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

    async loadKeyHandlers() {
        if (!this.inputHandler) return;
        try {
            const manifestPath = this.config.repo.keyHandlers;
            const { default: keyManifest } = await import(manifestPath);
            for (const keyName in keyManifest) {
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

    /**
     * Main command execution loop.
     * FINAL FIX: This version correctly suppresses output for background jobs.
     */
    async runCommand(line) {
        this.commandInProgress = true;
        const ast = parse(line);
        try {
            for (const node of ast) {
                if (node.background) {
                    this.executor.executeNode(node);
                    this.writeln(`[${this.jobId++}]`);
                } else {
                    const result = await this.executor.executeNode(node);
                    // The executor itself now handles writing output to the terminal,
                    // so we only need to check for the final stdout from a redirected
                    // background command and print it if necessary.
                    if (result && result.stdout) {
                         this.write(result.stdout);
                    }
                }
            }
        } catch (error) {
            this.writeln(`\x1B[1;31mError: ${error.message}\x1B[0m`);
            console.error(error);
        } finally {
            this.commandInProgress = false;
            this.prompt();
        }
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
}

