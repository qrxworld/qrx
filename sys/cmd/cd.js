/**
 * Implements the 'cd' (change directory) command.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * The main entry point for the 'cd' command.
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     * @returns {Promise<number>} The exit status of the command. 0 for success, 1 for failure.
     */
    async run(shell, args) {
        // Resolve the target path. Default to root '/' if no argument is given.
        const targetPath = shell.resolvePath(args[0] || '/');
        
        try {
            // Get stats to ensure the target exists and is a directory.
            const stats = await shell.pfs.stat(targetPath);
            
            if (stats.isDirectory()) {
                // If it's a directory, update the shell's state and return success.
                shell.cwd = targetPath;
                return 0; // 0 indicates success
            } else {
                shell.writeln(`-qrx: cd: not a directory: ${args[0] || targetPath}`);
                return 1; // 1 indicates failure
            }
        } catch (e) {
            shell.writeln(`-qrx: cd: no such file or directory: ${args[0] || targetPath}`);
            return 1; // 1 indicates failure
        }
    }
};

