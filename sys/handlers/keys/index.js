/**
 * This manifest maps key names to the modules that handle them.
 * The 'Printable' key is a special case for any visible character
 * that doesn't have its own specific handler.
 *
 * This allows the input system to be extended simply by adding a new
 * key and its corresponding module file here.
 */
export default {
  "Enter": "./handlers/keys/enter.js",
  "Backspace": "./handlers/keys/backspace.js",
  "ArrowUp": "./handlers/keys/arrowup.js",
  "ArrowDown": "./handlers/keys/arrowdown.js",
  "Printable": "./handlers/keys/printable.js",
  "Control_C": "./handlers/keys/ctrlc.js"
};
