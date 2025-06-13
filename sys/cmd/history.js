// -----------------------------------------------------------------------------
// file: sys/cmd/history.js
// -----------------------------------------------------------------------------
/**
 * Implements the 'history' command.
 * Displays the command history or clears it.
 * MODIFIED to return an exit status.
 */
export default {
    /**
     * The main entry point for the 'history' command.
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     * @returns {Promise<number>} The exit status. This command always returns 0 for success.
     */
    async run(shell, args) {
        // Check for the '-c' (clear) flag.
        if (args[0] === '-c') {
            shell.history = [];
            shell.historyIndex = -1;
            shell.writeln('Command history cleared.');
            return 0; // Success
        }

        // If no flags are present, display the history.
        if (shell.history.length === 0) {
            shell.writeln('No history yet.');
            return 0; // Success
        }

        // Iterate over the history array and print each command with its line number.
        shell.history.forEach((command, index) => {
            // Display with a 1-based index, padded for alignment to look nice.
            const lineNumber = String(index + 1).padStart(4, ' ');
            shell.writeln(`${lineNumber}  ${command}`);
        });

        // The history command itself doesn't have a failure condition in this implementation.
        return 0; // Success
    }
};

