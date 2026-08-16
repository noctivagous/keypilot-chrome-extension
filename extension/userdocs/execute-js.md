
# Execute JS

Execute JS is a first-class Function you can bind to a key or drop into a macro.

Key / library: Create New Execute JS in Keyboard Layout Config, paste a script, optionally enable Callbacks, then place the instance on a slot.

Macro Builder: An Execute JS chip sits with the Logic chips. You can add multiple script steps. The script’s return value is the next Gate’s priorResult.

Bindings always provided: kpHoveredClickable, kpHoverLeaf, kpFocusedTextField, kpMode, kpPageUrl, kpSelection, kpPriorResult.

Callbacks (only if checked): showPopover, copyToClipboard, notify. Scripts run in the content-script isolated world (page DOM, not page JS), with an 8s timeout.