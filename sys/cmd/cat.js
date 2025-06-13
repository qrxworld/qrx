// -----------------------------------------------------------------------------
// file: sys/cmd/cat.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'cat' (concatenate) command.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments (file paths).
     * @param {string|null} stdin - Piped input from a previous command.
     * @returns {Promise<number>} The exit status. 0 for success, 1 for failure.
     */
    async run(shell, args, stdin) {
        // If there is piped input, 'cat' should print it and ignore file arguments.
        if (stdin !== null) {
            shell.write(stdin);
            return 0;
        }

        if (args.length === 0) {
            // In a real terminal, 'cat' with no args would wait for user input.
            // Here, it's an error.
            shell.writeln('cat: missing file operand');
            return 1;
        }

        let hadError = false;
        for (const filePath of args) {
            const absolutePath = shell.resolvePath(filePath);
            try {
                const content = await shell.pfs.readFile(absolutePath, 'utf8');
                shell.write(content);
            } catch (e) {
                shell.writeln(`cat: ${filePath}: No such file or directory`);
                hadError = true;
            }
        }
        return hadError ? 1 : 0;
    }
};
