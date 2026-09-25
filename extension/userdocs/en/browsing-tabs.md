# Tabs & history

Move between tabs and browser history without reaching for chrome buttons.

## Use it

1. Press <kbd>Q</kbd> / <kbd>W</kbd> to move to the previous / next tab.
2. Press <kbd>T</kbd> for a new tab; <kbd>A</kbd> to close the current tab.
3. Press <kbd>D</kbd> to go back; <kbd>R</kbd> to go forward.
4. Press <kbd>S</kbd> (or <kbd>1</kbd>) to jump to the current site’s root (scheme + host).
5. Press <kbd>J</kbd> for **Tab History** — a branch-aware history strip for this tab (see *Tab History*).
6. Press <kbd>.</kbd> for **Tabs Overview** — every window as a card, with that window’s tabs listed inside. Key-click a tab to switch to it. Key-click the window’s header bar to focus that window and keep its active tab. Left-handed Browsing uses <kbd>X</kbd>.

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
| <kbd>.</kbd> | Tabs Overview (left-handed: <kbd>X</kbd>) |

<h3 id="open-urls">Open URLs</h3>

**Open URLs** is an Action Instance in the Tab Control library. In the Keyboard Layout Editor inspector, add the sites you want (for example five news homepages). Place that instance on a key. Pressing the key opens each URL in its own background tab, in list order, just after the current tab. Create another instance for a different set of sites.

Browsing includes a bundled **Social media** instance on <kbd>/</kbd> (right-handed) and <kbd>Z</kbd> (left-handed): Facebook, Instagram, YouTube, and X.

<h3 id="open-bookmarks">Open Bookmarks</h3>

**Open Bookmarks** is an Action Instance in the Tab Control library. Choose one folder from the Bookmarks Manager. Pressing the key opens the first 30 website bookmarks in that folder, including bookmarks inside subfolders, each in a background tab after the current tab. Create another instance to open a different folder.

<h3 id="random-bookmark">Random Bookmark</h3>

**Random Bookmark** is an Action Instance in the Tab Control library. It opens random website bookmarks and switches to the first new tab. Leave the folder as All bookmarks, or pick one folder. Count is how many to open (default 1, up to 30). Further tabs open beside the one you land on.

Browsing includes a bundled **Random Bookmark** instance on <kbd>,</kbd> (right-handed) and <kbd>C</kbd> (left-handed): one random bookmark from all bookmarks, and that tab becomes active.

### Tips

- Back/forward follow normal browser history for the tab.
- Tab History keeps alternate branches when you navigate away from a fork — useful after exploring multiple paths from the same page.
- Left-handed Browsing mirrors these clusters onto the right side of the keyboard.
