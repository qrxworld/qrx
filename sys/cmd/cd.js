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
            const stats = await shell.pfs.stat(targetPath);
            
            if (stats.isDirectory()) {
                shell.cwd = targetPath;
                return 0; // Success
            } else {
                shell.writeln(`-qrx: cd: not a directory: ${args[0] || targetPath}`);
                return 1; // Failure
            }
        } catch (e) {
            shell.writeln(`-qrx: cd: no such file or directory: ${args[0] || targetPath}`);
            return 1; // Failure
        }
    }
};

