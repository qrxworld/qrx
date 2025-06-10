// sys/cmd/cat.js

/**
 * Implements the 'cat' (concatenate) command.
 * If stdin is provided, it prints stdin. Otherwise, it reads and
 * prints the contents of the specified files.
 */
export default {
    /**
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments (file paths).
     * @param {string|null} stdin - Piped input from a previous command.
     */
    async run(shell, args, stdin) {
        // If there is piped input, 'cat' should print it and ignore file arguments.
        if (stdin !== null) {
            shell.write(stdin);
            return;
        }

        if (args.length === 0) {
            // In a real terminal, 'cat' with no args would wait for user input.
            // Here, we'll just show a usage message.
            shell.writeln('cat: missing file operand');
            return;
        }

        for (const filePath of args) {
            const absolutePath = shell.resolvePath(filePath);
            try {
                const content = await shell.pfs.readFile(absolutePath, 'utf8');
                shell.write(content);
            } catch (e) {
                shell.writeln(`cat: ${filePath}: No such file or directory`);
            }
        }
    }
};

