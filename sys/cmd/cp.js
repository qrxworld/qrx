// commands/cp.js

/**
 * A recursive helper function to copy files and directories.
 * @param {QRx} shell - The shell instance.
 * @param {string} source - The absolute path of the source file/directory.
 * @param {string} dest - The absolute path of the destination.
 */
async function _copy(shell, source, dest) {
    const sourceStats = await shell.pfs.stat(source).catch(() => null);
    if (!sourceStats) {
        shell.writeln(`cp: cannot stat '${source}': No such file or directory`);
        return;
    }

    // If source is a file
    if (sourceStats.isFile()) {
        try {
            const content = await shell.pfs.readFile(source);
            let finalDest = dest;

            // If destination exists and is a directory, copy the file inside it.
            const destStats = await shell.pfs.stat(dest).catch(() => null);
            if (destStats && destStats.isDirectory()) {
                const sourceBasename = source.split('/').pop();
                finalDest = (dest === '/' ? '' : dest) + '/' + sourceBasename;
            }

            await shell.pfs.writeFile(finalDest, content);
        } catch (e) {
            shell.writeln(`cp: error copying file '${source}': ${e.message}`);
        }
        return;
    }

    // If source is a directory
    if (sourceStats.isDirectory()) {
        try {
            // Check if destination exists.
            const destStats = await shell.pfs.stat(dest).catch(() => null);
            let finalDestDir = dest;

            // If dest is a file, we can't copy a directory into it.
            if (destStats && destStats.isFile()) {
                shell.writeln(`cp: cannot overwrite non-directory '${dest}' with directory '${source}'`);
                return;
            }
            
            // If dest exists and is a directory, we copy the source dir *inside* it.
            if (destStats && destStats.isDirectory()) {
                 const sourceBasename = source.split('/').pop();
                 finalDestDir = (dest === '/' ? '' : dest) + '/' + sourceBasename;
            }

            // Create the final destination directory if it doesn't exist.
            await shell.pfs.mkdir(finalDestDir).catch(() => {});

            // Read all entries from the source directory and copy them recursively.
            const entries = await shell.pfs.readdir(source);
            for (const entry of entries) {
                const sourceEntryPath = (source === '/' ? '' : source) + '/' + entry;
                const destEntryPath = (finalDestDir === '/' ? '' : finalDestDir) + '/' + entry;
                await _copy(shell, sourceEntryPath, destEntryPath); // Recursive call
            }
        } catch (e) {
            shell.writeln(`cp: error copying directory '${source}': ${e.message}`);
        }
    }
}


/**
 * Implements the 'cp' (copy) command.
 * Copies files and directories.
 */
export default {
    /**
     * The main entry point for the 'cp' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments: [source, destination].
     */
    async run(shell, args) {
        if (args.length !== 2) {
            shell.writeln('cp: missing destination file operand after \'source_file\'');
            shell.writeln('Usage: cp SOURCE DEST');
            return;
        }

        const sourcePath = shell.resolvePath(args[0]);
        const destPath = shell.resolvePath(args[1]);

        await _copy(shell, sourcePath, destPath);
    }
};

