// -----------------------------------------------------------------------------
// file: sys/engine/AstExecutor.js
// -----------------------------------------------------------------------------
import { resolvePath } from '../util/path.js';

/**
 * Handles the recursive execution of the Abstract Syntax Tree (AST).
 * MODIFIED: Added handling for 'if_statement' nodes.
 */
export default class AstExecutor {
    constructor(kernel) {
        this.kernel = kernel;
    }

    /**
     * Main AST interpreter, now with logical operator support and 'if' statements.
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

            // NEW: Handle 'if_statement' nodes
            case 'if_statement': {
                // Execute the condition (e.g., 'ls file.txt')
                // This call will capture its own output and return its status.
                const conditionResult = await this.executeNode(node.condition, stdin);
                let branchResult = { stdout: '', status: 0 }; // Initialize result for the chosen branch

                // If the condition command succeeded (exit status 0)
                if (conditionResult.status === 0) {
                    // Execute commands in the 'then' branch
                    for (const cmdNode of node.then_branch) {
                        const subResult = await this.executeNode(cmdNode, stdin);
                        branchResult.stdout += subResult.stdout; // Accumulate output
                        branchResult.status = subResult.status; // Keep the status of the last command
                        if (subResult.status !== 0) break; // Stop if a command in the branch fails
                    }
                } else if (node.else_branch) { // If condition failed and 'else' branch exists
                    // Execute commands in the 'else' branch
                    for (const cmdNode of node.else_branch) {
                        const subResult = await this.executeNode(cmdNode, stdin);
                        branchResult.stdout += subResult.stdout; // Accumulate output
                        branchResult.status = subResult.status; // Keep the status of the last command
                        if (subResult.status !== 0) break; // Stop if a command in the branch fails
                    }
                }
                // The overall result of the if_statement is the result of the executed branch
                result = branchResult;
                break;
            }

            case 'command': {
                const buffer = [];
                const originalWrite = this.kernel.write;
                const originalWriteln = this.kernel.writeln;

                // Redirect kernel's output methods to capture command output
                if (isBackground) {
                    this.kernel.write = () => {}; // Suppress output for background jobs
                    this.kernel.writeln = () => {};
                } else {
                    this.kernel.write = (data) => buffer.push(data);
                    this.kernel.writeln = (data) => buffer.push(data + '\n');
                }

                let commandStatus = 0;
                try {
                    // Execute the command; shell.currentProcess might be a Promise for long-running tasks
                    this.kernel.currentProcess = this.executeSingleCommand(node, stdin);
                    const commandResult = await this.kernel.currentProcess;

                    // If the command returns a number, use it as status. Otherwise, default to 0.
                    if (typeof commandResult === 'number') {
                        commandStatus = commandResult;
                    } else if (commandResult && typeof commandResult.status === 'number') {
                        // Handle cases where a command might return an object with a status property
                        commandStatus = commandResult.status;
                    }
                } catch (err) {
                    // Capture and display command-specific errors
                    this.kernel.writeln(`-qrx: ${node.name}: ${err.message}`);
                    commandStatus = 1; // General error status
                } finally {
                    // Restore original output methods
                    this.kernel.write = originalWrite;
                    this.kernel.writeln = originalWriteln;
                    this.kernel.currentProcess = null; // Clear the current process
                }
                result = { stdout: buffer.join(''), status: commandStatus };
                break;
            }
        }

        // Apply redirection if specified for the current node (command, group, or if_statement)
        if (node.redirection) {
            const path = resolvePath(node.redirection.file, this.kernel.cwd);
            try {
                if (node.redirection.mode === 'append') {
                    const existing = await this.kernel.pfs.readFile(path, 'utf8').catch(() => '');
                    await this.kernel.pfs.writeFile(path, existing + result.stdout);
                } else { // overwrite mode
                    await this.kernel.pfs.writeFile(path, result.stdout);
                }
                result.stdout = ''; // Redirection means stdout goes to file, not terminal
            } catch (e) {
                this.kernel.writeln(`-qrx: ${node.redirection.file}: ${e.message}`);
                result.status = 1; // Redirection failure results in non-zero status
            }
        }

        // Update the kernel's last exit status, which is used for subsequent logical operations ($? and if statements)
        this.kernel.lastExitStatus = result.status;
        return result;
    }

    /**
     * Executes a single command. This is called by executeNode for 'command' type nodes.
     * @param {object} node - The command AST node.
     * @param {string|null} stdin - Input piped from a previous command.
     * @returns {Promise<number>} The exit status of the command.
     */
    async executeSingleCommand({ name, args }, stdin = null) {
        // Expand '$?' to the last exit status
        const expandedArgs = args.map(arg => {
            if (arg === '$?') { return String(this.kernel.lastExitStatus); }
            return arg;
        });

        if (!name) {
            // If there's no command name but stdin, just print stdin.
            if (stdin !== null) this.kernel.write(stdin);
            return 0;
        }

        // Handle environment variable assignments (e.g., MYVAR="value")
        const assignMatch = name.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)/s);
        if (assignMatch && expandedArgs.length === 0) { // Ensure it's purely an assignment, not a command with args
            this.kernel.env[assignMatch[1]] = assignMatch[2].replace(/^['"]|['"]$/g, ''); // Remove quotes
            return 0;
        }

        // Check if the command is a dynamically loaded module (builtin from sys/cmd)
        const builtin = this.kernel.commands[name];
        if (builtin?.run) {
            let status = 0;
            try {
                // Execute the command module's run method
                // The run method should return a Promise that resolves to the exit status
                const commandPromise = builtin.run(this.kernel, expandedArgs, stdin);
                // Assign the promise to currentProcess so Ctrl+C can cancel it if implemented
                this.kernel.currentProcess = commandPromise;
                const commandResult = await commandPromise;

                if (typeof commandResult === 'number') {
                    status = commandResult;
                } else {
                    // Commands that don't explicitly return a status are considered success
                    status = 0;
                }
            } catch (err) {
                // Catch errors thrown by the command's run method
                this.kernel.writeln(`-qrx: ${name}: ${err.message}`);
                status = 1; // Indicate failure
            } finally {
                this.kernel.currentProcess = null; // Clear the current process
            }
            return status;
        }

        // If not a dynamically loaded command, try kernel's internal builtins
        return this.kernel.handleBuiltins(name, expandedArgs);
    }
}


