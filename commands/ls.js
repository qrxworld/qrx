/**
 * Implements the 'ls' (list directory contents) command.
 */
export default {
    /**
     * The main entry point for the 'ls' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     */
    async run(shell, args) {
        // Resolve the target path. If no argument is given, use the current directory.
        const targetPath = shell.resolvePath(args[0] || '.');
        try {
            // Read all entries in the directory.
            const files = await shell.pfs.readdir(targetPath);
            if (files.length === 0) {
                return; // Nothing to list
            }
            for (const file of files) {
                // Get stats to determine if it's a file or directory.
                const stats = await shell.pfs.stat(`${targetPath === '/' ? '' : targetPath}/${file}`);
                // Add a trailing slash to directories for clarity.
                shell.writeln(stats.isDirectory() ? `${file}/` : file);
            }
        } catch (e) {
            shell.writeln(`ls: cannot access '${args[0] || '.'}': No such file or directory`);
        }
    }
};
