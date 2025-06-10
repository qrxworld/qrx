// commands/echo.js

/**
 * Implements the 'echo' command.
 * Writes its arguments back to the terminal, separated by spaces.
 */
export default {
    /**
     * The main entry point for the 'echo' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     */
    async run(shell, args) {
        // Join the arguments with spaces and write the result as a new line.
        shell.writeln(args.join(' '));
    }
};

