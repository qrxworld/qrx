/**
 * Implements the 'mkdir' (make directory) command.
 */
export default {
    /**
     * The main entry point for the 'mkdir' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     */
    async run(shell, args) {
        if (!args[0]) {
            shell.writeln('mkdir: missing operand');
            return;
        }
        const targetPath = shell.resolvePath(args[0]);
        try {
            // Attempt to create the directory in the virtual filesystem.
            await shell.pfs.mkdir(targetPath);
        } catch (e) {
            // Basic error handling for existing files/directories.
            shell.writeln(`mkdir: cannot create directory '${args[0]}': File exists`);
        }
    }
};

