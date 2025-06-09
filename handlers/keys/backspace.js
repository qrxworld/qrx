// handlers/keys/backspace.js

/**
 * Handles the 'Backspace' key press.
 * This module exports a singleton object with a 'run' method.
 */
export default {
    /**
     * Executes the logic for the Backspace key.
     * @param {QRx} shell - The main shell instance.
     */
    run(shell) {
        // If there's text in the buffer, handle the deletion.
        if (shell.commandBuffer.length > 0) {
            // In the terminal, move the cursor back, write a space to erase, then move back again.
            shell.term.write('\b \b');
            // Remove the last character from the internal command buffer.
            shell.commandBuffer = shell.commandBuffer.slice(0, -1);
        }
    }
};

