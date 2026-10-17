# Tabs & history

Move between tabs and browser history without reaching for chrome buttons.

## Use it

1. Press <kbd>Q</kbd> / <kbd>W</kbd> to move to the previous / next tab.
2. Press <kbd>T</kbd> for a new tab; <kbd>A</kbd> to close the current tab.
3. Press <kbd>D</kbd> to go back; <kbd>R</kbd> to go forward.
4. Press <kbd>S</kbd> (or <kbd>1</kbd>) to jump to the current site’s root (scheme + host).
5. Press <kbd>J</kbd> for **Tab History** — a branch-aware history strip for this tab (see *Tab History*).
6. Press <kbd>/</kbd> for **Tabs Overview** — every window as a card, with that window’s tabs listed inside. Key-click a tab to switch to it. Key-click the window’s header bar to focus that window and keep its active tab. Left-handed Browsing uses <kbd>Z</kbd>.

## Reference

### Default keys (Browsing, right-handed)

| Key | Action |
| --- | --- |
| <kbd>Q</kbd> | Previous tab |
| <kbd>W</kbd> | Next tab |
| <kbd>T</kbd> | New tab |
| <kbd>A</kbd> | Close tab |
| <kbd>D</kbd> | Back |
| <kbd>R</kbd> | Forward |
| <kbd>S</kbd> / <kbd>1</kbd> | Site root |
| <kbd>J</kbd> | Tab History popover |
| <kbd>/</kbd> | Tabs Overview (left-handed: <kbd>Z</kbd>) |

<h3 id="open-urls">Open URLs</h3>

**Open URLs** is an Action Instance in the Tab Control library. In the Keyboard Layout Editor inspector, add the sites you want (for example five news homepages). Place that instance on a key. Pressing the key opens each URL in its own background tab, in list order, just after the current tab. Create another instance for a different set of sites.

Browsing includes a bundled **Social media** instance on <kbd>.</kbd> (right-handed) and <kbd>X</kbd> (left-handed). The sites on that key follow the browser language.

<h3 id="open-bookmarks">Open Bookmarks</h3>

**Open Bookmarks** is an Action Instance in the Tab Control library. Choose one folder from the Bookmarks Manager. Pressing the key opens the first 30 website bookmarks in that folder, including bookmarks inside subfolders, each in a background tab after the current tab. Create another instance to open a different folder.

<h3 id="random-bookmark">Random Bookmark</h3>

**Random Bookmark** is an Action Instance in the Tab Control library. It opens random website bookmarks and switches to the first new tab. Leave the folder as All bookmarks, or pick one folder. Count is how many to open (default 1, up to 30). Further tabs open beside the one you land on.

Browsing includes a bundled **Random Bookmark** instance on <kbd>,</kbd> (right-handed) and <kbd>C</kbd> (left-handed): one random bookmark from all bookmarks, and that tab becomes active.

### Open later at a random time

Press <kbd>Alt</kbd>+<kbd>Shift</kbd> with any **Open URLs** or **Random Bookmark** key to schedule that action for a random time. <kbd>Alt</kbd>+<kbd>Shift</kbd> with **Click Element** (usually <kbd>F</kbd>) schedules the link under the cursor the same way. <kbd>Alt</kbd>+<kbd>Shift</kbd> with **Close Tab** (usually <kbd>A</kbd>, or <kbd>;</kbd> when left-handed) schedules closing that tab. <kbd>Alt</kbd>+<kbd>Shift</kbd> with a **Close Window** key you place in the Layout Editor schedules closing that window. The tab or window is the one that was current when you pressed the chord. If it is already gone when the time arrives, nothing else closes. The action remains scheduled if you navigate away, and runs while the browser is open.

To pick an exact time instead, press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd> with the same key, including **Click Element**, **Close Tab**, and **Close Window**. The link, tab, or window is the one current when you press the chord. A dialog asks for a date and time (pre-filled one hour ahead). The date field's calendar sets the day. Hour and minute controls, with − and + buttons, set the time of day. **+1 hour** and **+1 day** move the time already shown; **Tomorrow, 9:00 AM** jumps to that morning. **Schedule** is available only for a future time; <kbd>Esc</kbd>, **Cancel**, or clicking outside the dialog schedules nothing.

In **Settings → Keyboard → Deferred tab opening**, you can enable each action type separately, choose its minimum and maximum delay from 1 minute to 48 hours, and choose whether delayed tabs open in the active browser window or the original window. Each action type is enabled by default. The window choice does not apply to delayed closes. **Silent random scheduling** is on by default: Alt+Shift does not show the scheduled-time alert. Turn it off to see that alert. If a silent schedule cannot be saved, a small red square flashes in the upper right. An exact time still shows the usual confirmation.

### Tips

- Back/forward follow normal browser history for the tab.
- Tab History keeps alternate branches when you navigate away from a fork — useful after exploring multiple paths from the same page.
- Left-handed Browsing mirrors these clusters onto the right side of the keyboard.
