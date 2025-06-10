/**
 * Represents a single, dynamically loadable command.
 * It is a placeholder in this implementation, as the actual logic
 * will reside in the individual command modules (e.g., ls.js, git.js).
 * The core requirement is that each command module has a 'run' method.
 */
export class QRXCommand {
    constructor({ urlBase, cmd }) {
        // In a more complex scenario, this constructor could pre-fetch
        // command-specific metadata or dependencies. For now, it's a stub.
        this.name = cmd;
        this.path = `${urlBase}${cmd}.js`;
    }

    // The 'run' method is the key. The actual implementation will be
    // in the module file itself, not in this class.
    // async run(shell, args) { /* Logic is in the module */ }
}

/**
 * A factory class responsible for loading and initializing all commands
 * based on a provided list. It dynamically imports the modules.
 */
export class QRXCommands {
    /**
     * @param {object} config - The configuration object.
     * @param {string} config.urlBase - The base path for command module files.
     * @param {string[]} config.commandList - An array of command names to load.
     * @returns {Promise<object>} A promise that resolves to an object containing
     * the loaded command modules, keyed by command name.
     */
    static async create({ urlBase, commandList }) {
        const commands = {};
        for (const cmd of commandList) {
            try {
                // Dynamically import the module for each command.
                const commandModule = await import(`${urlBase}${cmd}.js`);
                // Store the entire module (which should have a default export with a 'run' method).
                commands[cmd] = commandModule.default;
            } catch (error) {
                // Log an error but don't stop the shell from loading other commands.
                console.error(`Failed to load command '${cmd}':`, error);
            }
        }
        return commands;
    }
}
