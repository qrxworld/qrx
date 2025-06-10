/**
 * This manifest maps key names to the modules that handle them.
 * The 'Printable' key is a special case for any visible character
 * that doesn't have its own specific handler.
 *
 * This allows the input system to be extended simply by adding a new
 * key and its corresponding module file here.
 */
export default {
    "Enter": "./keys/enter.js",
    "Backspace": "./keys/backspace.js",
    "ArrowUp": "./keys/arrowup.js",
    "ArrowDown": "./keys/arrowdown.js",
    "Printable": "./keys/printable.js"
};

