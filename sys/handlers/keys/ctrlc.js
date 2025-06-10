// sys/handlers/keys/ctrlc.js

/**
 * Handles the 'Ctrl+C' key press to interrupt the current process.
 */
export default {
    /**
     * Executes the logic for the Ctrl+C key combination.
     * @param {Kernel} shell - The main shell instance.
     */
    run(shell) {
        // Call the Kernel's method to cancel the current running process.
        shell.cancelCurrentProcess();
    }
};

