// -----------------------------------------------------------------------------
// file: sys/cmd/mkdir.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'mkdir' (make directory) command.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * The main entry point for the 'mkdir' command.
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     * @returns {Promise<number>} The exit status. 0 for success, 1 for failure.
     */
    async run(shell, args) {
        if (!args[0]) {
            shell.writeln('mkdir: missing operand');
            return 1;
        }
        const targetPath = shell.resolvePath(args[0]);
        try {
            // Attempt to create the directory in the virtual filesystem.
            await shell.pfs.mkdir(targetPath);
            return 0; // Success
        } catch (e) {
            // Basic error handling for existing files/directories.
            shell.writeln(`-qrx: mkdir: cannot create directory '${args[0]}': File exists`);
            return 1; // Failure
        }
    }
};
