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
        // DEBUG: Log which handlers are being registered at startup.
        console.log(`Registering handler for key: '${keyName}'`);
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
        
        // DEBUG: Log the key press to see what the browser is sending.
        console.log(`Key event: domEvent.key='${domEvent.key}', key='${key}'`);

        const handler = this.keyHandlers[domEvent.key];
        const isPrintable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey && domEvent.key.length === 1;

        if (handler && typeof handler.run === 'function') {
            // DEBUG: Confirm that a specific handler was found and is being run.
            console.log(`Found and running handler for '${domEvent.key}'`);
            handler.run(shell);
        } else if (isPrintable && this.keyHandlers['Printable']) {
             // DEBUG: Confirm the printable fallback is being used.
            console.log(`No specific handler found. Using 'Printable' handler for '${key}'`);
            this.keyHandlers['Printable'].run(shell, key);
        } else {
            // DEBUG: Log when no handler is found for a key press.
            console.log(`No handler found or needed for '${domEvent.key}'`);
        }
    }
}

