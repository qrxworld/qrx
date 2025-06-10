// sys/handlers/input.js

/**
 * Acts as a dispatcher for key-specific handler modules.
 */
export default class InputHandler {
    constructor() {
        this.keyHandlers = {};
    }

    /**
     * Registers a key-specific handler module.
     * @param {string} keyName - The name of the key (e.g., 'Enter', 'Printable').
     * @param {object} handlerInstance - An instance of the handler class for that key.
     */
    register(keyName, handlerInstance) {
        this.keyHandlers[keyName] = handlerInstance;
    }

    /**
     * The main entry point for processing a key event. It finds the appropriate
     * registered handler and delegates the event to it.
     * @param {Kernel} shell - The main shell instance (context).
     * @param {object} keyEvent - The key event object from xterm.js.
     */
    handle(shell, { key, domEvent }) {
        // --- Special Handling for Ctrl+C ---
        if (domEvent.ctrlKey && domEvent.key === 'c') {
            const handler = this.keyHandlers['Control_C'];
            if (handler && typeof handler.run === 'function') {
                handler.run(shell);
            }
            return;
        }

        if (shell.commandInProgress) {
            return;
        }

        const handler = this.keyHandlers[domEvent.key];
        const isPrintable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey && domEvent.key.length === 1;

        if (handler && typeof handler.run === 'function') {
            handler.run(shell);
        } else if (isPrintable && this.keyHandlers['Printable']) {
            this.keyHandlers['Printable'].run(shell, key);
        }
    }
}

