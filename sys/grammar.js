// system/grammar.js

/**
 * This file defines the grammar for the QRx shell language using nearley.js syntax.
 * It specifies how to parse command sequences, pipelines, groups, and arguments.
 * The output of this grammar is an Abstract Syntax Tree (AST).
 */
export default {
    Lexer: undefined,
    ParserRules: [
    {"name": "main", "symbols": ["_", "command_list", "_"], "postprocess": (d) => d[1]},
    {"name": "command_list", "symbols": ["pipeline"], "postprocess": (d) => [d[0]]},
    {"name": "command_list", "symbols": ["command_list", "_", {"literal":";"}, "_", "pipeline"], "postprocess": (d) => [...d[0], d[4]]},
    {"name": "pipeline", "symbols": ["command_group"], "postprocess": (d) => d[0]},
    {"name": "pipeline", "symbols": ["pipeline", "_", {"literal":"|"}, "_", "command_group"], "postprocess": (d) => ({type: 'pipeline', from: d[0], to: d[4]})},
    {"name": "command_group", "symbols": ["command"], "postprocess": (d) => d[0]},
    {"name": "command_group", "symbols": ["command_group", "_", "redirect"], "postprocess": 
        (d) => ({...d[0], redirection: d[2]})
        },
    {"name": "command", "symbols": ["word"], "postprocess": (d) => ({type: 'command', name: d[0], args: []})},
    {"name": "command", "symbols": ["word", "__", "arg_list"], "postprocess": (d) => ({type: 'command', name: d[0], args: d[2]})},
    {"name": "command_group", "symbols": [{"literal":"("}, "_", "command_list", "_", {"literal":")"}], "postprocess": (d) => ({type: 'group', commands: d[2]})},
    {"name": "arg_list", "symbols": ["word"], "postprocess": (d) => [d[0]]},
    {"name": "arg_list", "symbols": ["arg_list", "__", "word"], "postprocess": (d) => [...d[0], d[2]]},
    
    // --- CORRECTED REDIRECT RULES ---
    // The rule for '>>' (append) now comes first to be checked first.
    // It is explicitly defined as two consecutive '>' literal characters.
    // This resolves the parsing ambiguity without needing an external tokenizer.
    {"name": "redirect", "symbols": [{"literal":">"}, {"literal":">"}, "_", "word"], "postprocess": (d) => ({mode: 'append', file: d[3]})},
    {"name": "redirect", "symbols": [{"literal":">"}, "_", "word"], "postprocess": (d) => ({mode: 'overwrite', file: d[2]})},

    {"name": "word", "symbols": ["string"], "postprocess": (d) => d[0]},
    {"name": "word", "symbols": ["bareword"], "postprocess": (d) => d[0]},
    {"name": "string", "symbols": [{"literal":"'"}, "sq_chars", {"literal":"'"}], "postprocess": (d) => d[1].join('')},
    {"name": "string", "symbols": [{"literal":"\""}, "dq_chars", {"literal":"\""}], "postprocess": (d) => d[1].join('')},
    {"name": "sq_chars", "symbols": [], "postprocess": () => []},
    {"name": "sq_chars", "symbols": ["sq_chars", "sq_char"], "postprocess": (d) => [...d[0], d[1]]},
    {"name": "sq_char", "symbols": [/[^']/], "postprocess": (d) => d[0]},
    {"name": "dq_chars", "symbols": [], "postprocess": () => []},
    {"name": "dq_chars", "symbols": ["dq_chars", "dq_char"], "postprocess": (d) => [...d[0], d[1]]},
    {"name": "dq_char", "symbols": [/[^"]/], "postprocess": (d) => d[0]},
    {"name": "bareword", "symbols": ["bare_chars"], "postprocess": (d) => d[0].join('')},
    {"name": "bare_chars", "symbols": ["bare_char"], "postprocess": (d) => [d[0]]},
    {"name": "bare_chars", "symbols": ["bare_chars", "bare_char"], "postprocess": (d) => [...d[0], d[1]]},
    {"name": "bare_char", "symbols": [/[^|<>;()'"\s`]/], "postprocess": (d) => d[0]},
    {"name": "_", "symbols": []},
    {"name": "_", "symbols": ["_", /[\s\t]/], "postprocess": () => null},
    {"name": "__", "symbols": [/[\s\t]/]},
    {"name": "__", "symbols": ["__", /[\s\t]/], "postprocess": () => null}
]
  , ParserStart: "main"
}

