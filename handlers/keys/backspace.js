// handlers/input.js

/**
 * Acts as a dispatcher for key-specific handler modules.
 * This class does not contain any logic for how to handle keys itself.
 * It is populated with handlers by the main QRx kernel.
 */
export default class InputHandler {
    constructor() {
        this.keyHandlers = {};
    }

    /**
     * Registers a key-specific handler module. This is called by the QRx
     * kernel during the module loading phase.
     * @param {string} keyName - The name of the key (e.g., 'Enter', 'Backspace', 'Printable').
     * @param {object} handlerInstance - An instance of the handler class for that key.
     */
    register(keyName, handlerInstance) {
        this.keyHandlers[keyName] = handlerInstance;
    }

    /**
     * The main entry point for processing a key event. It finds the appropriate
     * registered handler and delegates the event to it.
     * @param {QRx} shell - The main shell instance (context).
     * @param {object} keyEvent - The key event object from xterm.js.
     */
    handle(shell, { key, domEvent }) {
        if (shell.commandInProgress) {
            return;
        }

        const handler = this.keyHandlers[domEvent.key];
        const isPrintable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey && domEvent.key.length === 1;

        if (handler && typeof handler.run === 'function') {
            // Found a specific handler for this key (e.g., 'Enter').
            handler.run(shell);
        } else if (isPrintable && this.keyHandlers['Printable']) {
            // No specific handler, so delegate to the 'Printable' character handler.
            this.keyHandlers['Printable'].run(shell, key);
        }
        // If no handler is found (e.g., for Ctrl, Alt), nothing happens.
    }
}
