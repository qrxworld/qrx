/**
 * Implements the 'pwd' (print working directory) command.
 */
export default {
    /**
     * The main entry point for the 'pwd' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     */
    async run(shell, args) {
        // The shell's current working directory is stored in shell.cwd
        shell.writeln(shell.cwd);
    }
};


