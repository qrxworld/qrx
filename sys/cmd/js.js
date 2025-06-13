// -----------------------------------------------------------------------------
// file: sys/cmd/js.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'js' command.
 * Executes JavaScript code from a file or a string.
 */
export default {
    /**
     * The main entry point for the 'js' command.
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     * @returns {Promise<number>} The exit status. 0 for success, 1 for failure.
     */
    async run(shell, args) {
        if (args.length === 0) {
            shell.writeln('js: missing operand');
            shell.writeln('Usage: js <file1> [file2] ...');
            shell.writeln('   or: js --string "<code>"');
            return 1;
        }

        // --- Execute from a string ---
        if (args[0] === '--string') {
            if (args.length < 2) {
                shell.writeln('js: --string option requires an argument');
                return 1;
            }
            const code = args[1];
            try {
                // The Function constructor creates a new function from the code string.
                // We pass 'shell' as an argument, making it available inside the script.
                const func = new Function('shell', code);
                await func(shell);
                return 0; // Success
            } catch (e) {
                shell.writeln(`js: error executing script: ${e.message}`);
                return 1; // Failure
            }
        }

        // --- Execute from one or more files ---
        let hadError = false;
        for (const path of args) {
            const absolutePath = shell.resolvePath(path);
            try {
                const code = await shell.pfs.readFile(absolutePath, 'utf8');
                const func = new Function('shell', code);
                await func(shell);
            } catch (e) {
                // If a file is not found or has a syntax error, report it and continue.
                shell.writeln(`js: error in file '${path}': ${e.message}`);
                hadError = true;
            }
        }

        // Return a failure code if any of the files failed.
        return hadError ? 1 : 0;
    }
};

