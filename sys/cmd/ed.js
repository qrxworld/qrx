// sys/cmd/ed.js

/**
 * Implements 'ed', a simple fullscreen text editor.
 * This command demonstrates how to create long-running, interactive,
 * asynchronous commands within the QRx Kernel.
 */
export default {
    /**
     * The main entry point for the 'ed' command.
     * @param {Kernel} shell - The shell instance.
     * @param {string[]} args - The command arguments, expects one: [filename].
     * @param {string|null} stdin - Piped input (ignored by ed).
     * @returns {Promise} A promise that resolves when the editor is closed.
     */
    run(shell, args, stdin) {
        // This command returns a Promise. The Kernel will wait for this promise
        // to resolve before showing the next prompt.
        return new Promise(async (resolve, reject) => {
            if (args.length !== 1) {
                shell.writeln('Usage: ed <filename>');
                resolve(); // Immediately resolve to show next prompt.
                return;
            }
            
            const filePath = shell.resolvePath(args[0]);
            let initialContent = '';
            let hasChanges = false;
            
            try {
                initialContent = await shell.pfs.readFile(filePath, 'utf8');
            } catch (e) {
                // File doesn't exist, which is fine. It will be created on save.
            }
            
            // --- UI Creation ---
            const editorContainer = document.createElement('div');
            const editorTextarea = document.createElement('textarea');
            const buttonContainer = document.createElement('div');
            const saveButton = document.createElement('button');
            const cancelButton = document.createElement('button');
            const helpText = document.createElement('p');

            // --- Styling ---
            Object.assign(editorContainer.style, {
                position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                backgroundColor: 'rgba(20, 20, 20, 0.95)', zIndex: '1000',
                display: 'flex', flexDirection: 'column', padding: '10px', boxSizing: 'border-box'
            });
            Object.assign(editorTextarea.style, {
                flex: '1', width: '100%', boxSizing: 'border-box',
                backgroundColor: '#1e1e1e', color: '#d4d4d4', border: '1px solid #555',
                fontFamily: 'monospace', fontSize: '16px', padding: '10px', resize: 'none'
            });
            Object.assign(buttonContainer.style, {
                padding: '10px 0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
            });
            Object.assign(saveButton.style, {
                backgroundColor: '#4a90e2', color: 'white', border: 'none',
                padding: '10px 20px', marginLeft: '10px', cursor: 'pointer', borderRadius: '4px'
            });
             Object.assign(cancelButton.style, {
                backgroundColor: '#d0d0d0', color: 'black', border: 'none',
                padding: '10px 20px', cursor: 'pointer', borderRadius: '4px'
            });
            Object.assign(helpText.style, {
                color: '#aaa', margin: '0', padding: '0 10px', flex: '1', textAlign: 'left'
            });
            
            // --- Content and Attributes ---
            editorTextarea.value = initialContent;
            saveButton.textContent = 'Save';
            cancelButton.textContent = 'Cancel';
            helpText.textContent = `Editing: ${filePath}  |  Ctrl+S to Save, Ctrl+C to Cancel`;

            // --- DOM Assembly ---
            buttonContainer.appendChild(helpText);
            buttonContainer.appendChild(cancelButton);
            buttonContainer.appendChild(saveButton);
            editorContainer.appendChild(editorTextarea);
            editorContainer.appendChild(buttonContainer);
            document.body.appendChild(editorContainer);
            
            editorTextarea.focus();

            // --- Custom Modal ---
            const showModal = (message, showConfirm = false) => {
                return new Promise((modalResolve) => {
                    const modalOverlay = document.createElement('div');
                    const modalBox = document.createElement('div');
                    const modalMessage = document.createElement('p');
                    const modalButtonContainer = document.createElement('div');

                    Object.assign(modalOverlay.style, {
                        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                        backgroundColor: 'rgba(0,0,0,0.7)', zIndex: '2000',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    });
                     Object.assign(modalBox.style, {
                        background: '#333', color: 'white', padding: '20px', borderRadius: '5px',
                        textAlign: 'center', border: '1px solid #555'
                    });
                    Object.assign(modalMessage.style, { margin: '0 0 20px 0' });
                    Object.assign(modalButtonContainer.style, { display: 'flex', justifyContent: 'center' });

                    modalMessage.textContent = message;
                    
                    const okButton = document.createElement('button');
                    okButton.textContent = 'OK';
                    Object.assign(okButton.style, { padding: '8px 16px', cursor: 'pointer', background: '#4a90e2', color: 'white', border: 'none', borderRadius: '3px' });
                    
                    okButton.onclick = () => {
                        document.body.removeChild(modalOverlay);
                        modalResolve(true); // Always resolves true for simple alert
                    };

                    modalButtonContainer.appendChild(okButton);
                    
                    if(showConfirm) {
                        okButton.textContent = 'Yes';
                        const noButton = document.createElement('button');
                        noButton.textContent = 'No';
                        Object.assign(noButton.style, { padding: '8px 16px', cursor: 'pointer', background: '#ccc', color: 'black', border: 'none', borderRadius: '3px', marginLeft: '10px' });
                        noButton.onclick = () => {
                            document.body.removeChild(modalOverlay);
                            modalResolve(false); // Resolves false if "No" is clicked
                        };
                        modalButtonContainer.appendChild(noButton);
                    }
                    
                    modalBox.appendChild(modalMessage);
                    modalBox.appendChild(modalButtonContainer);
                    modalOverlay.appendChild(modalBox);
                    document.body.appendChild(modalOverlay);
                });
            };
            
            // --- Event Handlers ---
            const cleanup = () => {
                document.body.removeChild(editorContainer);
                document.removeEventListener('keydown', handleKeyDown);
                shell.currentProcess = null; // Clear the current process
                resolve(); // This signals to the Kernel that the command is done.
            };

            const saveFile = async () => {
                const newContent = editorTextarea.value;
                try {
                    await shell.pfs.writeFile(filePath, newContent, 'utf8');
                    cleanup();
                } catch (e) {
                    console.error('Failed to save file:', e);
                    await showModal(`Error saving file: ${e.message}`);
                }
            };

            const cancelEdit = async () => {
                if(hasChanges) {
                    const userIsSure = await showModal("You have unsaved changes. Discard them?", true);
                    if (userIsSure) {
                        cleanup();
                    }
                } else {
                    cleanup();
                }
            };
            
            editorTextarea.addEventListener('input', () => { hasChanges = true; });
            saveButton.addEventListener('click', saveFile);
            cancelButton.addEventListener('click', cancelEdit);
            
            const handleKeyDown = (e) => {
                if (e.ctrlKey) {
                    if (e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); } 
                    else if (e.key.toLowerCase() === 'c') { e.preventDefault(); cancelEdit(); }
                }
            };
            document.addEventListener('keydown', handleKeyDown);

            // Expose a cancel method for the Kernel's global Ctrl+C handler
            shell.currentProcess = { cancel: cancelEdit };
        });
    }
};

