# Macros

A Macro is an ordered sequence of Function and Logic steps bound to a single key.

## Use it

1. Open **Keyboard Layout Editor** (<kbd>Alt</kbd>+<kbd>C</kbd>) and go to **User Macros** (see *Macro Builder* for editing).
2. Pick a stock macro to try, or create your own.
3. Place the Macro on a Keyboard Reference keycap like any other action.
4. Press that key on a page — steps run in order, with Gates deciding whether to continue.

Stock examples include flows such as **AI Assist**, **Quick Nav**, and **Clip & Search**. Editing a stock macro forks it to a user copy you can customize freely.

## Reference

### Concepts

- **Steps** — Functions (including Execute JS) and Logic chips
- **Gate** — inspects the previous result; can skip following steps
- **Delay** — optional wait between steps
- **Run Macro** — nest another macro (cycles are guarded)

### Stock macros

Read-only templates. Save/edit forks a user macro you can customize and place freely.

### Compared with a single Function

| Use a Function when… | Use a Macro when… |
| --- | --- |
| One operation is enough | You need a pipeline |
| Parameters stay simple | You need Gates / waits / nested runs |

### Next

Open *Macro Builder* for create / edit / place details, and *Execute JS* for script steps inside macros.
