// system/grammar.js

/**
 * This file defines the grammar for the QRx shell language using nearley.js syntax.
 * It specifies how to parse command sequences, pipelines, groups, and arguments.
 * The output of this grammar is an Abstract Syntax Tree (AST).
 * MODIFIED: Corrected the grammar to resolve ambiguity between the '&' background
 * operator and the '&&' logical AND operator. This fixes issues where '&&' was
 * treated as a background command.
 * MODIFIED: Added grammar rules for 'if' statements.
 * MODIFIED: Reordered logical_sequence to prioritize 'if_statement' to resolve parsing ambiguity.
 * MODIFIED: Introduced 'IDENTIFIER' rule to distinguish command names from reserved keywords.
 */
export default {
    Lexer: undefined,
    ParserRules: [
    {"name": "main", "symbols": ["_", "command_list", "_"], "postprocess": (d) => d[1]},

    // MODIFIED: Replaced the old 'command_list' rules to remove ambiguity.
    // A command list is now a series of command units separated by semicolons.
    {"name": "command_list", "symbols": ["command_unit"], "postprocess": (d) => [d[0]]},
    {"name": "command_list", "symbols": ["command_list", "_", {"literal":";"}, "_", "command_unit"], "postprocess": (d) => [...d[0], d[4]]},
    {"name": "command_list", "symbols": ["command_list", "_", {"literal":";"}], "postprocess": (d) => d[0]}, // Allows a trailing semicolon.

    // NEW: A 'command_unit' is a logical sequence that can be terminated by '&' to run in the background.
    // This isolates the '&' operator from '&&', fixing the parsing conflict.
    {"name": "command_unit", "symbols": ["logical_sequence"], "postprocess": (d) => d[0]},
    {"name": "command_unit", "symbols": ["logical_sequence", "_", {"literal":"&"}], "postprocess": (d) => ({ ...d[0], background: true })},


    // A logical_sequence handles '&&' and '||', and now 'if' statements.
    // IMPORTANT: Placed 'if_statement' first to give it precedence over 'pipeline'
    // when 'if' is encountered, resolving ambiguity with barewords.
    {"name": "logical_sequence", "symbols": ["if_statement"], "postprocess": (d) => d[0]},
    {"name": "logical_sequence", "symbols": ["pipeline"], "postprocess": (d) => d[0]},
    {"name": "logical_sequence", "symbols": ["logical_sequence", "__", {"literal":"&"}, {"literal":"&"}, "__", "pipeline"], "postprocess":
        (d) => ({type: 'logical_and', left: d[0], right: d[5]})
    },
    {"name": "logical_sequence", "symbols": ["logical_sequence", "__", {"literal":"|"}, {"literal":"|"}, "__", "pipeline"], "postprocess":
        (d) => ({type: 'logical_or', left: d[0], right: d[5]})
    },

    // A pipeline handles '|'.
    {"name": "pipeline", "symbols": ["command_group"], "postprocess": (d) => d[0]},
    {"name": "pipeline", "symbols": ["pipeline", "_", {"literal":"|"}, "_", "command_group"], "postprocess": (d) => ({type: 'pipeline', from: d[0], to: d[4]})},

    // A command_group handles redirection and grouping with parentheses.
    {"name": "command_group", "symbols": ["command"], "postprocess": (d) => d[0]},
    {"name": "command_group", "symbols": ["command_group", "_", "redirect"], "postprocess":
        (d) => ({...d[0], redirection: d[2]})
    },
    {"name": "command_group", "symbols": [{"literal":"("}, "_", "command_list", "_", {"literal":")"}], "postprocess": (d) => ({type: 'group', commands: d[2]})},

    // A command is now an IDENTIFIER followed by optional arguments.
    // This prevents keywords like 'if' from being parsed as command names.
    {"name": "command", "symbols": ["IDENTIFIER"], "postprocess": (d) => ({type: 'command', name: d[0], args: []})},
    {"name": "command", "symbols": ["IDENTIFIER", "__", "arg_list"], "postprocess": (d) => ({type: 'command', name: d[0], args: d[2]})},

    {"name": "arg_list", "symbols": ["word"], "postprocess": (d) => [d[0]]},
    {"name": "arg_list", "symbols": ["arg_list", "__", "word"], "postprocess": (d) => [...d[0], d[2]]},

    // Redirection operators '>>' and '>'.
    {"name": "redirect", "symbols": [{"literal":">"}, {"literal":">"}, "_", "word"], "postprocess": (d) => ({mode: 'append', file: d[3]})},
    {"name": "redirect", "symbols": [{"literal":">"}, "_", "word"], "postprocess": (d) => ({mode: 'overwrite', file: d[2]})},

    // NEW: if statement definition
    // Structure: if CONDITION; then COMMAND_LIST; fi
    {"name": "if_statement", "symbols": [
        {"literal":"if"}, "__", "pipeline", // The condition can be a pipeline
        "_", {"literal":";"}, "_", // Separator after condition
        {"literal":"then"}, "__", "command_list", // The 'then' block is a command_list
        "_", {"literal":";"}, "_", // Separator after then block
        {"literal":"fi"}
    ], "postprocess":
        (d) => ({type: 'if_statement', condition: d[2], then_branch: d[8], else_branch: null})
    },
    // Structure: if CONDITION; then COMMAND_LIST; else COMMAND_LIST; fi
    {"name": "if_statement", "symbols": [
        {"literal":"if"}, "__", "pipeline", // The condition
        "_", {"literal":";"}, "_",
        {"literal":"then"}, "__", "command_list", // The 'then' branch
        "_", {"literal":";"}, "_",
        {"literal":"else"}, "__", "command_list", // The 'else' branch
        "_", {"literal":";"}, "_",
        {"literal":"fi"}
    ], "postprocess":
        (d) => ({type: 'if_statement', condition: d[2], then_branch: d[8], else_branch: d[14]})
    },

    // Word definitions. 'word' is still used for arguments.
    {"name": "word", "symbols": ["string"], "postprocess": (d) => d[0]},
    {"name": "word", "symbols": ["bareword"], "postprocess": (d) => d[0]}, // Bareword can be any sequence of bare_chars

    // NEW: IDENTIFIER rule: a bareword that is explicitly NOT a reserved keyword.
    // This is crucial for distinguishing command names from `if`, `then`, `else`, `fi`.
    {"name": "IDENTIFIER", "symbols": ["bare_chars"], "postprocess": (d) => {
        const value = d[0].join('');
        const reservedKeywords = ['if', 'then', 'else', 'fi']; // List all keywords here
        if (reservedKeywords.includes(value)) {
            // Returning null in postprocess rejects this parse path for 'IDENTIFIER'
            // if the matched string is a reserved keyword.
            return null;
        }
        return value;
    }},
    {"name": "IDENTIFIER", "symbols": ["bare_char_leading_hyphen"], "postprocess": (d) => {
        const value = d[0].join('');
        const reservedKeywords = ['if', 'then', 'else', 'fi'];
        if (reservedKeywords.includes(value)) {
            return null;
        }
        return value;
    }},

    {"name": "string", "symbols": [{"literal":"'"}, "sq_chars", {"literal":"'"}], "postprocess": (d) => d[1].join('')},
    {"name": "string", "symbols": [{"literal":"\""}, "dq_chars", {"literal":"\""}], "postprocess": (d) => d[1].join('')},
    {"name": "sq_chars", "symbols": [], "postprocess": () => []},
    {"name": "sq_chars", "symbols": ["sq_chars", "sq_char"], "postprocess": (d) => [...d[0], d[1]]},
    {"name": "sq_char", "symbols": [/[^']/], "postprocess": (d) => d[0]},
    {"name": "dq_chars", "symbols": [], "postprocess": () => []},
    {"name": "dq_chars", "symbols": ["dq_chars", "dq_char"], "postprocess": (d) => [...d[0], d[1]]},
    {"name": "dq_char", "symbols": [/[^"]/], "postprocess": (d) => d[0]},

    // 'bareword' rule, used for `word` (arguments). Does not reject keywords.
    {"name": "bareword", "symbols": ["bare_chars"], "postprocess": (d) => d[0].join('')},
    {"name": "bareword", "symbols": ["bare_char_leading_hyphen"], "postprocess": (d) => d[0].join('')},


    {"name": "bare_chars", "symbols": ["bare_char"], "postprocess": (d) => [d[0]]},
    {"name": "bare_chars", "symbols": ["bare_chars", "bare_char"], "postprocess": (d) => [...d[0], d[1]]},
    {"name": "bare_char", "symbols": [/[^|&<>;()'"\s`]/], "postprocess": (d) => d[0]},
    // A bareword starting with a hyphen (e.g., -r in rm -r)
    {"name": "bare_char_leading_hyphen", "symbols": [{"literal":"-"}, "bare_chars"], "postprocess": (d) => [d[0], ...d[1]]},


    // Whitespace definitions.
    {"name": "_", "symbols": []},
    {"name": "_", "symbols": ["_", /[\s\t]/], "postprocess": () => null},
    {"name": "__", "symbols": [/[\s\t]+/]}
]
 , ParserStart: "main"
}
