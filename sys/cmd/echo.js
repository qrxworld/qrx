// sys/cmd/echo.js

/**
 * Implements the 'echo' command.
 * Writes its arguments back to the terminal. It ignores stdin.
 */
export default {
    /**
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     * @param {string|null} stdin - Piped input (ignored by echo).
     */
    async run(shell, args, stdin) {
        // The echo command typically ignores standard input.
        shell.writeln(args.join(' '));
    }
};

