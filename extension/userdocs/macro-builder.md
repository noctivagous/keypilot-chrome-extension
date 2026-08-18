# Macro Builder

Macro Builder is the step editor for user Macros, accessed from Keyboard Layout Config.

## Use it

1. Press <kbd>Alt</kbd>+<kbd>C</kbd> to open Layout Config.
2. Open **User Macros**.
3. **Create** a macro and give it a clear name — or duplicate an existing one.
4. Add steps:
   - Select a Function in the Actions Library and add it to the macro
   - Add **Logic** chips: Wait, Gate, Stop, Run Macro
   - Add **Show Popover** to display the previous step’s result (or fallback text)
   - Add **Execute JS** to run a pasted script
5. Reorder or remove steps; open a step to set parameters and optional delay.
6. **Save**, then place the Macro on a key from the library / macros list.
7. Test on a normal page; refine Gates if the flow should bail out early.

## Reference

### Logic chips

| Chip | Role |
| --- | --- |
| **Wait** | Pause before the next step |
| **Gate** | Test prior result; on failure skip configured following steps |
| **Stop** | End the macro |
| **Run Macro** | Call another macro (nested; cycle-protected) |
| **Execute JS** | Run a pasted script; return value feeds the next Gate |
| **Show Popover** | Display the previous Function result (or configured fallback text) in a popover. Not a key action. |

### Gate tests

Typical comparisons against the previous Function result:

- Has value / empty
- Equals / not equal
- Greater than / less than

Failed Gates skip ahead as configured so you can branch without full scripting.

### Macro Keys as steps

Configured keystroke primitives (hotkey, burst, round-robin, continuous, synthetic mouse, normal remap) can run as Macro Function steps as well as standalone key actions.

### Tips

- Keep macros short and name steps by intent.
- Prefer Gates over long unconditional chains when a step might yield nothing.
- Execute JS return values feed the next Gate via `kpPriorResult` (see *Execute JS*).
