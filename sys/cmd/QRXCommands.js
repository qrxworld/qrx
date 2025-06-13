// -----------------------------------------------------------------------------
// file: sys/cmd/QRXCommands.js
// -----------------------------------------------------------------------------
/**
 * Represents a single, dynamically loadable command.
 */
export class QRXCommand {
    constructor({ urlBase, cmd }) {
        this.name = cmd;
        this.path = `${urlBase}${cmd}.js`;
    }
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
                // MODIFIED: Added a cache-busting query parameter.
                // This ensures the browser always fetches the latest version of the command file.
                const commandModule = await import(`${urlBase}${cmd}.js?t=${new Date().getTime()}`);
                commands[cmd] = commandModule.default;
            } catch (error) {
                // Log an error but don't stop the shell from loading other commands.
                console.error(`Failed to load command '${cmd}':`, error);
            }
        }
        return commands;
    }
}
