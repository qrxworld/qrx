// commands/rm.js

/**
 * Recursively deletes a directory and all its contents.
 * @param {QRx} shell - The shell instance.
 * @param {string} dirPath - The absolute path of the directory to delete.
 */
async function recursiveDelete(shell, dirPath) {
    let entries;
    try {
        entries = await shell.pfs.readdir(dirPath);
    } catch (e) {
        shell.writeln(`rm: error reading directory '${dirPath}': ${e.message}`);
        return;
    }

    // Loop through all entries in the directory.
    for (const entry of entries) {
        // Construct the full path for the entry.
        const fullPath = (dirPath === '/' ? '' : dirPath) + '/' + entry;
        const stats = await shell.pfs.stat(fullPath);

        // If the entry is a directory, recurse into it.
        if (stats.isDirectory()) {
            await recursiveDelete(shell, fullPath);
        } else {
            // If the entry is a file, delete it.
            await shell.pfs.unlink(fullPath);
        }
    }

    // After deleting all contents, delete the now-empty directory itself.
    await shell.pfs.rmdir(dirPath);
}


/**
 * Implements the 'rm' (remove) command.
 * Deletes files and, with the -r flag, directories.
 */
export default {
    /**
     * The main entry point for the 'rm' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments, including flags and paths.
     */
    async run(shell, args) {
        const flags = new Set();
        const paths = [];

        // Simple argument parser to separate flags from paths.
        for (const arg of args) {
            if (arg.startsWith('-')) {
                // Add all characters after '-' as individual flags (e.g., -rf).
                for (const char of arg.substring(1)) {
                    flags.add(char);
                }
            } else {
                paths.push(arg);
            }
        }
        
        const isRecursive = flags.has('r');
        const isForced = flags.has('f');

        if (paths.length === 0) {
            shell.writeln('rm: missing operand');
            return;
        }

        // Process each path provided.
        for (const path of paths) {
            const absolutePath = shell.resolvePath(path);
            const stats = await shell.pfs.stat(absolutePath).catch(() => null);

            // If path doesn't exist, either show an error or do nothing if -f is used.
            if (!stats) {
                if (!isForced) {
                    shell.writeln(`rm: cannot remove '${path}': No such file or directory`);
                }
                continue; // Move to the next path.
            }

            // Handle directory removal.
            if (stats.isDirectory()) {
                if (!isRecursive) {
                    shell.writeln(`rm: cannot remove '${path}': Is a directory`);
                    continue;
                }
                // If recursive, delete the directory and its contents.
                try {
                    await recursiveDelete(shell, absolutePath);
                } catch(e) {
                    shell.writeln(`rm: error removing directory '${path}': ${e.message}`);
                }
            } else {
                // Handle file removal.
                try {
                    await shell.pfs.unlink(absolutePath);
                } catch (e) {
                     shell.writeln(`rm: error removing file '${path}': ${e.message}`);
                }
            }
        }
    }
};

