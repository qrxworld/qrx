// -----------------------------------------------------------------------------
// file: sys/cmd/cp.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'cp' (copy) command.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * @returns {Promise<number>} The exit status. 0 for success, 1 for failure.
     */
    async run(shell, args) {
        if (args.length !== 2) {
            shell.writeln('cp: missing destination file operand after \'source_file\'');
            shell.writeln('Usage: cp SOURCE DEST');
            return 1;
        }

        const sourcePath = shell.resolvePath(args[0]);
        const destPath = shell.resolvePath(args[1]);

        const success = await _copy(shell, sourcePath, destPath, args[0], args[1]);
        return success ? 0 : 1;
    }
};

/**
 * A recursive helper function to copy files and directories.
 * @returns {Promise<boolean>} True on success, false on failure.
 */
async function _copy(shell, source, dest, sourceArg, destArg) {
    const sourceStats = await shell.pfs.stat(source).catch(() => null);
    if (!sourceStats) {
        shell.writeln(`cp: cannot stat '${sourceArg}': No such file or directory`);
        return false;
    }

    if (sourceStats.isFile()) {
        try {
            const content = await shell.pfs.readFile(source);
            let finalDest = dest;
            const destStats = await shell.pfs.stat(dest).catch(() => null);
            if (destStats && destStats.isDirectory()) {
                const sourceBasename = source.split('/').pop();
                finalDest = shell.resolvePath(`${dest}/${sourceBasename}`);
            }
            await shell.pfs.writeFile(finalDest, content);
            return true;
        } catch (e) {
            shell.writeln(`cp: error copying file '${sourceArg}': ${e.message}`);
            return false;
        }
    }

    if (sourceStats.isDirectory()) {
        try {
            const destStats = await shell.pfs.stat(dest).catch(() => null);
            let finalDestDir = dest;

            if (destStats && destStats.isFile()) {
                shell.writeln(`cp: cannot overwrite non-directory '${destArg}' with directory '${sourceArg}'`);
                return false;
            }
            
            if (destStats && destStats.isDirectory()) {
                const sourceBasename = source.split('/').pop();
                finalDestDir = shell.resolvePath(`${dest}/${sourceBasename}`);
            }

            await shell.pfs.mkdir(finalDestDir).catch(() => {});
            const entries = await shell.pfs.readdir(source);
            for (const entry of entries) {
                const sourceEntryPath = shell.resolvePath(`${source}/${entry}`);
                const destEntryPath = shell.resolvePath(`${finalDestDir}/${entry}`);
                if (!await _copy(shell, sourceEntryPath, destEntryPath, `${sourceArg}/${entry}`, `${destArg}/${entry}`)) {
                    return false;
                }
            }
            return true;
        } catch (e) {
            shell.writeln(`cp: error copying directory '${sourceArg}': ${e.message}`);
            return false;
        }
    }
    return true;
}
