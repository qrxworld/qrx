// -----------------------------------------------------------------------------
// file: sys/cmd/mv.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'mv' (move) command.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * @returns {Promise<number>} The exit status. 0 for success, 1 for failure.
     */
    async run(shell, args) {
        if (args.length !== 2) {
            shell.writeln('mv: missing destination file operand after \'source_file\'');
            shell.writeln('Usage: mv SOURCE DEST');
            return 1;
        }

        const sourcePath = shell.resolvePath(args[0]);
        const destPath = shell.resolvePath(args[1]);

        try {
            await shell.pfs.rename(sourcePath, destPath);
            return 0; // Success
        } catch (e) {
            shell.writeln(`mv: cannot move '${args[0]}' to '${args[1]}': ${e.message}`);
            return 1; // Failure
        }
    }
};
