// commands/history.js

/**
 * Implements the 'history' command.
 * Displays the command history or clears it.
 */
export default {
    /**
     * The main entry point for the 'history' command.
     * @param {QRx} shell - The shell instance.
     * @param {string[]} args - The command arguments.
     */
    async run(shell, args) {
        // Check for the '-c' (clear) flag.
        if (args[0] === '-c') {
            shell.history = [];
            shell.historyIndex = -1;
            shell.writeln('Command history cleared.');
            return;
        }

        // If no flags are present, display the history.
        if (shell.history.length === 0) {
            shell.writeln('No history yet.');
            return;
        }

        // Iterate over the history array and print each command with its line number.
        shell.history.forEach((command, index) => {
            // Display with a 1-based index, padded for alignment to look nice.
            const lineNumber = String(index + 1).padStart(4, ' ');
            shell.writeln(`${lineNumber}  ${command}`);
        });
    }
};

