// -----------------------------------------------------------------------------
// file: sys/engine/AstExecutor.js
// -----------------------------------------------------------------------------
import { resolvePath } from '../util/path.js';

/**
 * Handles the recursive execution of the Abstract Syntax Tree (AST).
 */
export default class AstExecutor {
    constructor(kernel) {
        this.kernel = kernel;
    }

    /**
     * Main AST interpreter, now with logical operator support.
     */
    async executeNode(node, stdin = null) {
        // If a background job, its output will not be written to the terminal
        // unless explicitly redirected to a file.
        const isBackground = node.background && !node.redirection;

        if (!node) return { stdout: '', status: 0 };
        let result = { stdout: '', status: 0 };

        switch (node.type) {
            case 'error':
                result = { stdout: `-qrx: parse error: ${node.message}\n`, status: 2 };
                break;
            
            case 'logical_and': {
                const leftResult = await this.executeNode(node.left, stdin);
                if (leftResult.status === 0) {
                    const rightResult = await this.executeNode(node.right, stdin);
                    result = {
                        stdout: leftResult.stdout + rightResult.stdout,
                        status: rightResult.status
                    };
                } else {
                    result = leftResult;
                }
                break;
            }

            case 'logical_or': {
                const leftResult = await this.executeNode(node.left, stdin);
                if (leftResult.status !== 0) {
                    const rightResult = await this.executeNode(node.right, stdin);
                     result = {
                        stdout: leftResult.stdout + rightResult.stdout,
                        status: rightResult.status
                    };
                } else {
                    result = leftResult;
                }
                break;
            }

            case 'pipeline': {
                const leftResult = await this.executeNode(node.from, stdin);
                result = await this.executeNode(node.to, leftResult.stdout);
                break;
            }

            case 'group': {
                const groupOutputBuffer = [];
                let groupStatus = 0;
                for (const cmdNode of node.commands) {
                    const subResult = await this.executeNode(cmdNode, stdin);
                    groupOutputBuffer.push(subResult.stdout);
                    groupStatus = subResult.status;
                }
                result = { stdout: groupOutputBuffer.join(''), status: groupStatus };
                break;
            }

            case 'command': {
                const buffer = [];
                const originalWrite = this.kernel.write;
                const originalWriteln = this.kernel.writeln;

                if (isBackground) {
                    this.kernel.write = () => {};
                    this.kernel.writeln = () => {};
                } else {
                    this.kernel.write = (data) => buffer.push(data);
                    this.kernel.writeln = (data) => buffer.push(data + '\n');
                }

                let commandStatus = 0;
                try {
                    commandStatus = await this.executeSingleCommand(node, stdin);
                } finally {
                    this.kernel.write = originalWrite;
                    this.kernel.writeln = originalWriteln;
                }
                result = { stdout: buffer.join(''), status: commandStatus };
                break;
            }
        }

        if (node.redirection) {
            const path = resolvePath(node.redirection.file, this.kernel.cwd);
            try {
                if (node.redirection.mode === 'append') {
                    const existing = await this.kernel.pfs.readFile(path, 'utf8').catch(() => '');
                    await this.kernel.pfs.writeFile(path, existing + result.stdout);
                } else {
                    await this.kernel.pfs.writeFile(path, result.stdout);
                }
                result.stdout = '';
            } catch (e) {
                this.kernel.writeln(`-qrx: ${file}: ${e.message}`);
                result.status = 1;
            }
        }

        this.kernel.lastExitStatus = result.status;
        return result;
    }

    async executeSingleCommand({ name, args }, stdin = null) {
        const expandedArgs = args.map(arg => {
            if (arg === '$?') { return String(this.kernel.lastExitStatus); }
            return arg;
        });
        if (!name) {
            if (stdin !== null) this.kernel.write(stdin);
            return 0;
        }
        const assignMatch = name.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)/s);
        if (assignMatch && expandedArgs.length === 0) {
            this.kernel.env[assignMatch[1]] = assignMatch[2].replace(/^['"]|['"]$/g, '');
            return 0;
        }
        const builtin = this.kernel.commands[name];
        if (builtin?.run) {
            let status = 0;
            try {
                this.kernel.currentProcess = builtin.run(this.kernel, expandedArgs, stdin);
                const commandResult = await this.kernel.currentProcess;
                if (typeof commandResult === 'number') {
                    status = commandResult;
                }
            } catch (err) {
                this.kernel.writeln(`-qrx: ${name}: ${err.message}`);
                status = 1;
            } finally {
                this.kernel.currentProcess = null;
            }
            return status;
        }
        return this.kernel.handleBuiltins(name, expandedArgs);
    }
}

