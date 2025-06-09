/**
 * Implements the 'cd' (change directory) command.
 */
export default {
    /**
     * The main entry point for the 'cd' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     */
    async run(shell, args) {
        // Resolve the target path. Default to root '/' if no argument is given.
        const targetPath = shell.resolvePath(args[0] || '/');
        try {
            // Get stats to ensure the target exists and is a directory.
            const stats = await shell.pfs.stat(targetPath);
            if (stats.isDirectory()) {
                // If it's a directory, update the shell's state.
                shell.cwd = targetPath;
            } else {
                shell.writeln(`cd: not a directory: ${args[0]}`);
            }
        } catch (e) {
            shell.writeln(`cd: no such file or directory: ${args[0]}`);
        }
    }
};
