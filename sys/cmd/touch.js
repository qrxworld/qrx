// -----------------------------------------------------------------------------
// file: sys/cmd/touch.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'touch' command.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments (file paths).
     * @returns {Promise<number>} The exit status. 0 for success, 1 for failure.
     */
    async run(shell, args) {
        if (args.length === 0) {
            shell.writeln('touch: missing file operand');
            return 1;
        }

        const now = new Date();
        let hadError = false;

        for (const path of args) {
            const absolutePath = shell.resolvePath(path);
            
            try {
                const stats = await shell.pfs.stat(absolutePath).catch(() => null);

                if (stats) {
                    await shell.pfs.utimes(absolutePath, now, now);
                } else {
                    await shell.pfs.writeFile(absolutePath, '');
                }
            } catch (e) {
                shell.writeln(`touch: cannot touch '${path}': ${e.message}`);
                hadError = true;
            }
        }
        return hadError ? 1 : 0;
    }
};
