// -----------------------------------------------------------------------------
// file: sys/cmd/rm.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'rm' (remove) command.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * @returns {Promise<number>} The exit status of the command.
     */
    async run(shell, args) {
        const flags = new Set();
        const paths = [];
        let hadError = false;

        for (const arg of args) {
            if (arg.startsWith('-')) {
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
            return 1;
        }

        for (const path of paths) {
            const absolutePath = shell.resolvePath(path);
            const stats = await shell.pfs.stat(absolutePath).catch(() => null);

            if (!stats) {
                if (!isForced) {
                    shell.writeln(`rm: cannot remove '${path}': No such file or directory`);
                    hadError = true;
                }
                continue;
            }

            if (stats.isDirectory()) {
                if (!isRecursive) {
                    shell.writeln(`rm: cannot remove '${path}': Is a directory`);
                    hadError = true;
                    continue;
                }
                if (!await recursiveDelete(shell, absolutePath)) {
                    hadError = true;
                }
            } else {
                try {
                    await shell.pfs.unlink(absolutePath);
                } catch (e) {
                    shell.writeln(`rm: error removing file '${path}': ${e.message}`);
                    hadError = true;
                }
            }
        }
        return hadError ? 1 : 0;
    }
};

async function recursiveDelete(shell, dirPath) {
    let entries;
    try {
        entries = await shell.pfs.readdir(dirPath);
    } catch (e) {
        shell.writeln(`rm: error reading directory '${dirPath}': ${e.message}`);
        return false;
    }
    for (const entry of entries) {
        const fullPath = shell.resolvePath(`${dirPath}/${entry}`);
        const stats = await shell.pfs.stat(fullPath);
        if (stats.isDirectory()) {
            if (!await recursiveDelete(shell, fullPath)) return false;
        } else {
            try {
                await shell.pfs.unlink(fullPath);
            } catch(e) {
                shell.writeln(`rm: cannot remove file '${fullPath}': ${e.message}`);
                return false;
            }
        }
    }
    try {
        await shell.pfs.rmdir(dirPath);
    } catch(e) {
        shell.writeln(`rm: cannot remove directory '${dirPath}': ${e.message}`);
        return false;
    }
    return true;
}
