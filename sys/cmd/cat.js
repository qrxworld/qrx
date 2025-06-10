// commands/cat.js

/**
 * Implements the 'cat' (concatenate) command.
 * Reads one or more files and writes their contents to the terminal.
 */
export default {
    /**
     * The main entry point for the 'cat' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments (file paths).
     */
    async run(shell, args) {
        if (args.length === 0) {
            shell.writeln('cat: missing file operand');
            return;
        }

        for (const filePath of args) {
            const absolutePath = shell.resolvePath(filePath);
            try {
                // Read the file content from the virtual filesystem.
                const content = await shell.pfs.readFile(absolutePath, 'utf8');
                // Use 'write' instead of 'writeln' to avoid adding an extra newline.
                // This preserves the file's original line endings.
                shell.write(content);
            } catch (e) {
                shell.writeln(`cat: ${filePath}: No such file or directory`);
            }
        }
    }
};

