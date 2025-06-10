// sys/parser.js

/**
 * A simple argument parser that respects single and double quotes.
 * @param {string} line - The command line string.
 * @returns {string[]} - An array of arguments.
 */
function parseArguments(line) {
    if (!line) return [];
    // This regex splits by spaces, but treats anything inside single or double quotes as a single argument.
    const args = line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    // Remove quotes from the final arguments
    return args.map(arg => (arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'")) ? arg.slice(1, -1) : arg);
}

/**
 * Parses a single command pipeline (a string that may contain pipes and redirection).
 * @param {string} pipelineStr - The string representing the command pipeline.
 * @returns {object} A structured object representing the pipeline.
 */
function parsePipeline(pipelineStr) {
    let commandToExecute = pipelineStr;
    let redirectPath = null;
    let redirectMode = null; // 'overwrite' or 'append'

    // Check for '>>' (append) first.
    const appendIndex = pipelineStr.lastIndexOf('>>');
    if (appendIndex !== -1) {
        commandToExecute = pipelineStr.substring(0, appendIndex).trim();
        redirectPath = pipelineStr.substring(appendIndex + 2).trim();
        redirectMode = 'append';
    } else {
        // If no '>>', check for '>' (overwrite).
        const overwriteIndex = pipelineStr.lastIndexOf('>');
        if (overwriteIndex !== -1) {
            commandToExecute = pipelineStr.substring(0, overwriteIndex).trim();
            redirectPath = pipelineStr.substring(overwriteIndex + 1).trim();
            redirectMode = 'overwrite';
        }
    }

    // Split the remaining command string into individual commands by the pipe operator.
    const commands = commandToExecute.split('|').map(cmdStr => {
        const parts = parseArguments(cmdStr.trim());
        return {
            command: parts[0],
            args: parts.slice(1),
        };
    });

    return {
        commands,
        redirectPath,
        redirectMode,
        original: pipelineStr,
    };
}

/**
 * The main export. Parses the entire command line, handling semicolons.
 * @param {string} line - The full line input by the user.
 * @returns {object[]} An array of structured pipeline objects to be executed sequentially.
 */
export default function parse(line) {
    // Split the full line into command groups based on the semicolon.
    const commandGroups = line.split(';').map(group => group.trim());
    
    // Parse each group into a structured pipeline object.
    return commandGroups
        .filter(group => group) // Filter out any empty strings from `cmd1; ; cmd2`
        .map(parsePipeline);
}

