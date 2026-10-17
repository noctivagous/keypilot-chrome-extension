# Keyboard Reference

The floating Keyboard Reference is a live map of your current layout — the fastest way to learn and switch layouts.

## Use it

1. Press <kbd>K</kbd> (right-handed) or <kbd>D</kbd> (left-handed), or use the Control Strip / popup / New Tab toggle.
2. Hover a keycap to see the bound action.
3. Use the **titlebar layout dropdown** to:
   - Switch built-in families or custom layouts
   - Open Layout Editor (Edit / New / Duplicate)
   - Launch **Onboarding Tutorial**
   - Open **KeyPilot Documentation/Help** (this popover)
   - Open **KeyPilot Settings**
4. Drag the window; collapse it when you need screen space; close with the × or the same toggle key.
5. While KeyPilot is in Text Mode, use <kbd>Exit</kbd> on the reference chrome if you prefer not to press <kbd>Esc</kbd>.

## Reference

### What it shows

- Active family, handedness, and custom assignments
- The selected physical keyboard model’s key positions and printed legends
- Always-on system keys
- Optional number row (Settings → Keyboard)
- Pressed-key highlight when feedback is enabled
- Optional glow on action keys when you hover a link (Settings → Click Mode)

### Physical keyboard model

Keyboard Reference separates the physical key you press from the character
printed on it. KeyPilot actions stay attached to physical positions, while the
Reference draws the legends for the selected keyboard model.

For example, on German QWERTZ, the physical `KeyY` position is labelled
<kbd>Z</kbd> and the physical `KeyZ` position is labelled <kbd>Y</kbd>. An
action assigned to `KeyY` stays on that physical keycap; it is not moved to
the cap that prints `Y`.

Your KeyPilot UI language and your operating-system input method do not choose
a hardware model. This matters for Chinese and Japanese input: an IME changes
text composition, not where KeyPilot actions are placed. The selected model
should match the physical keyboard in front of you; an external US/ISO
keyboard used with a Japanese or Chinese IME should keep its US/ISO model.

Custom layouts also distinguish a **physical key** from a **typed character**.
Use a physical assignment when an action should remain at one location across
keyboard models. Use a character assignment only when the character itself is
the intended trigger.

### Edit mode

When <kbd>Alt</kbd>+<kbd>C</kbd> Layout Editor is open, the Keyboard Reference becomes the placement surface: pick an action in the library, then click a keycap to assign it.

### Tips

- Leave it open on a second monitor or corner while learning.
- If a key does nothing, check this window before assuming KeyPilot is broken — you may be on Navigation family or a sparse custom layout.
