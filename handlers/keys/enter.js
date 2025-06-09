/**
 * Handles the 'Enter' key press.
 * This module exports a singleton object with a 'run' method.
 */
export default {
    /**
     * Executes the logic for the Enter key.
     * @param {QRx} shell - The main shell instance.
     */
    run(shell) {
        // Write a newline to the terminal for visual feedback.
        shell.term.write('\r\n');
        
        // Only execute if the buffer is not just whitespace.
        if (shell.commandBuffer.trim()) {
            // Add the completed command to the shell's history.
            shell.history.push(shell.commandBuffer);
            shell.historyIndex = shell.history.length;
            
            // Tell the shell kernel to execute the command.
            shell.runCommand(shell.commandBuffer);
        } else {
            // If the buffer is empty, just show a new prompt.
            shell.prompt();
        }
    }
};
