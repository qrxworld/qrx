// -----------------------------------------------------------------------------
// file: sys/cmd/ls.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'ls' (list directory contents) command.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * The main entry point for the 'ls' command.
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     * @returns {Promise<number>} The exit status. 0 for success, 2 for failure.
     */
    async run(shell, args) {
        // Resolve the target path. If no argument is given, use the current directory.
        const targetPath = shell.resolvePath(args[0] || '.');
        try {
            // Read all entries in the directory.
            const files = await shell.pfs.readdir(targetPath);
            for (const file of files) {
                // Get stats to determine if it's a file or directory.
                const fullPath = (targetPath === '/' ? '' : targetPath) + '/' + file;
                const stats = await shell.pfs.stat(fullPath);
                // Add a trailing slash to directories for clarity.
                shell.writeln(stats.isDirectory() ? `${file}/` : file);
            }
            return 0; // Success
        } catch (e) {
            shell.writeln(`-qrx: ls: cannot access '${args[0] || '.'}': No such file or directory`);
            return 2; // ls often uses 2 for serious errors like this.
        }
    }
};
