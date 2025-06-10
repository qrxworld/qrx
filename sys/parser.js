// system/parser.js

import grammar from './grammar.js';

/**
 * The main export. Parses the entire command line.
 * @param {string} line - The full line input by the user.
 * @returns {object[]} An array of structured AST nodes to be executed sequentially.
 */
export default function parse(line) {
    // By creating a new Parser instance for each call, we ensure it's stateless.
    // This is more robust and prevents errors from previous partial parses.
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    
    try {
        // Feed the line to the new parser instance.
        parser.feed(line);
        
        if (parser.results.length > 1) {
            // This can happen with ambiguous grammars. For now, we'll log a warning
            // and proceed with the first valid interpretation.
            console.warn("Ambiguous grammar: multiple parse results. Using the first.");
        }

        if (parser.results.length) {
            // The result is the Abstract Syntax Tree (AST).
            return parser.results[0];
        } else {
            // No valid command was parsed.
            return []; 
        }
    } catch (err) {
        console.error("Parse error:", err.message);
        // Return a special error object that the kernel can handle and display.
        return [{ type: 'error', message: err.message }];
    }
}

