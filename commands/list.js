import { QRXCommands } from './QRXCommands.js';

/**
 * This is the central command manifest for the shell.
 *
 * It uses the QRXCommands factory to asynchronously load all command modules
 * specified in the `commandList`. The QRx kernel imports this file to get
 * the final, resolved object of command modules.
 *
 * To add a new command to the shell:
 * 1. Add its name to the `commandList` array below.
 * 2. Create the corresponding `[command-name].js` file in this directory.
 */
export default await QRXCommands.create({
    urlBase: './', // The command modules are in the same directory.
    commandList: [
        'git',
        'ls',
        'cd',
        'echo',
        'mkdir',
        'rm',
        'cp',
        'cat',
        'pwd'
    ]
});
