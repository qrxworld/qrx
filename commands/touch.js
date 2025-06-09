// commands/touch.js

/**
 * Implements the 'touch' command.
 * Creates an empty file if it doesn't exist, or updates the
 * modification timestamp of an existing file.
 */
export default {
    /**
     * The main entry point for the 'touch' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments (file paths).
     */
    async run(shell, args) {
        if (args.length === 0) {
            shell.writeln('touch: missing file operand');
            return;
        }

        const now = new Date();

        for (const path of args) {
            const absolutePath = shell.resolvePath(path);
            
            try {
                // Check if the file already exists.
                const stats = await shell.pfs.stat(absolutePath).catch(() => null);

                if (stats) {
                    // If file exists, update its access and modification times.
                    await shell.pfs.utimes(absolutePath, now, now);
                } else {
                    // If file does not exist, create it as an empty file.
                    await shell.pfs.writeFile(absolutePath, '');
                }
            } catch (e) {
                shell.writeln(`touch: cannot touch '${path}': ${e.message}`);
            }
        }
    }
};

