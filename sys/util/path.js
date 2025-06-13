// -----------------------------------------------------------------------------
// file: sys/util/path.js
// -----------------------------------------------------------------------------
/**
 * Resolves a relative or absolute path to a fully qualified absolute path.
 * This version correctly handles '.' and '..' segments.
 * @param {string} path - The path to resolve.
 * @param {string} cwd - The current working directory to resolve from.
 * @returns {string} The resolved absolute path.
 */
export function resolvePath(path, cwd) {
    if (!path) return cwd;

    // Determine the starting point for resolution.
    const fullPath = path.startsWith('/') ? path : `${cwd}/${path}`;
    
    const parts = fullPath.split('/');
    const resolvedParts = [];

    for (const part of parts) {
        if (part === '..') {
            // Go up one level, but not beyond the root.
            if (resolvedParts.length > 0) {
                resolvedParts.pop();
            }
        } else if (part !== '.' && part !== '') {
            // Ignore '.' and empty parts (from multiple slashes), add all others.
            resolvedParts.push(part);
        }
    }
    
    // Join the parts and ensure the path starts with a '/'.
    const finalPath = `/${resolvedParts.join('/')}`;
    return finalPath;
}

