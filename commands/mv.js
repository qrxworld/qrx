// commands/mv.js

/**
 * Implements the 'mv' (move) command.
 * Renames or moves files and directories.
 */
export default {
    /**
     * The main entry point for the 'mv' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments: [source, destination].
     */
    async run(shell, args) {
        if (args.length !== 2) {
            shell.writeln('mv: missing destination file operand after \'source_file\'');
            shell.writeln('Usage: mv SOURCE DEST');
            return;
        }

        const sourcePath = shell.resolvePath(args[0]);
        const destPath = shell.resolvePath(args[1]);

        try {
            // Use the filesystem's built-in rename operation, which handles both
            // moving and renaming files and directories efficiently.
            await shell.pfs.rename(sourcePath, destPath);
        } catch (e) {
            // Provide a user-friendly error message if the operation fails.
            shell.writeln(`mv: cannot move '${args[0]}' to '${args[1]}': ${e.message}`);
        }
    }
};
