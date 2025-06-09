export default {
    /**
     * Executes the logic for a printable character.
     * @param {QRx} shell - The main shell instance.
     * @param {string} key - The character that was pressed.
     */
    run(shell, key) {
        // Append the character to the internal command buffer.
        shell.commandBuffer += key;
        // Echo the character to the terminal so the user can see it.
        shell.term.write(key);
    }
};

