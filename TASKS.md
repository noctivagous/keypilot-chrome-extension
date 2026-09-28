
[x] bug: Click New Tab opens first link on page into new tab if no link is under cursor.

[ ] Contextual Menu updates 
  - Ensure kb shortcuts are on every list item
 - Add "Control Strip (Alt/Opt + J)"
 - "Toggle Keyboard Ref window" K instead of separate for turning on and off
 
 [ ] - Assign Scroll Line Key Action to Spacebar by default.  Setting is global/system and can be turned off in
 contextual menu.  It will be listed in the select dropdown in the Keyboard Ref. Titlebar.

[ ] add Key Action: KB Ref. Titlebar - (Toggle) collapse to titlebar/restore Keyboard Ref. window  

[ ] add Key Action category: Playback: Play, Pause, Volume Up, Volume Down, Seek Forward, Seek Backward.

[ ] modify Top Sites: allow resizing vertically to 2 rows instead of min 3.

[ ]  modify: Tabs Overview - add close button to window titlebars and tabs list items.

[ ] add: Key Action: Popout Image - pops image under cursor out into floating window, uses the same floating window as Lookup Word.
resizable, has zoom icon controls, shows image information. Uses code from Copy Image to select
image html element.  Has button
in toolbar for downloading, copying to clipboard.

[ ] add Key Action: Image Info. - does the same thing as Font Info. except for the image under the cursor.   Uses code from Copy Image to select
image html element.

[ ] add: Key Action: Hide Img - hides all images on the current tab, leaving text in layout.  does not change layout.
A toggle.

[ ] modify Key Action Delete Mode: to have three submodes: Continuous - will delete until another key is pressed (mention in persistent toast alert),
Single - current, just select and delete, Quick - No select box preview, just deletes the first element underneath cursor.  Put these three
modes in the toast as a segm ctrl as well as the settings state of the popover tooltip.

[ ] add: Key Action category: Page Appearance.
    - Key Action: Monochrome Images - will monochrome every image on every navigated page, uses css filter.

[ ] add: Key Action: Notepad (panel window). toggle.  plain text editor.  autosaves contents.

[ ] More Keyboard layouts: 
   - Scrapbook Browsing - right side is Copying media to clipboard or Media Library.

[ ] Text To Fields.  paste text into special text list window and it separates 
if json,md, txt by paragraph.  The user can then click on the right side port (outline)
with mouse click Click Element and a line is drawn from the port to the cursor.  The user moves the cursor to
the desired text field and press Click Element again.

[ ] add Key Action: Countdown Timer
    - timer start.  presets: [5, 10, 15, 30 , 45, 1 hour]
    - show timer
    - all tabs / individual tab
    - per domain (all tabs)
    - firedAction: [ Close Tab | ]
       - implies that we should add a property to these kinds of
       key actions, which is functions that could be included in macro builder, e.g. fireableAction,
       (Close Tab, Close Window, Open URL, Random Bookmark (so it will have lookup in the
       actions library because it will show instances in the dropdown menu) ).  We already have this
       kind of function class somewhere.  in the case of Close Tab, unlike the key action it can have 
       a target besides the current Tab.
stock instance: Countdown All Tabs - closes all tabs after 15 min, shows countdown timer.
stock instance: Countdown in Tab - closes current tab after 15 min, shows countdown timer


[ ] -  Add setting in Settings window: zoom in and zoom out will rescale Control Strip and Keyboard Ref. so that
they are the same size as at 100% magn.  GUI magn. consistency.

[ ] - improve Page Top and Page Bottom cover sequence.

q.a. check: key actions:
    [ ] Select Word.
    [ ] Select Sentence.
    [ ] Select Paragraph.
    [ ] Select Image.

[ ] add: Key Action category: Web Developer

[ ] Key Action category: AI


[ ]  AI - Explain Rect. key action - using selection rectangle, but may not need conventional text range 
selection, it will explain what is inside the rect.  Explain Rect. will be the key action that allows 
instances where the user provides preface prompts, such as "Explain the [aspect] of [topic]," 
allowing the user to inform the AI what the use of the key action is or what should show up
in the popover window (the same one used by Lookup Word).  For example, one key action
would be used for looking up Chinese words to learn Chinese while another one would be
used for getting historical information/explanations and descriptions.  The same
characters were captured by the user inside the selection rectangle. When the AI has
information it can process the text for the user's desired way, allowing the user to customize the processing of data by AI.
  
  --> macro builder will allow user to customize how the data is processed by the AI,
  including what to show in a popover.


Extra

Query Hovered

Without building a macro in the macro builder, the user can set up
custom query URLs that send data underneath the cursor.  This way
the user can set up keys that use the word, paragraph, or image underneath
the cursor and get query results in a popover window.

[ ]  add: Key Action: Query Hovered Word (into Link Popover style window but
sized smaller). In instances of this key action, custom URL query is set up by user for popover that for the word underneath the cursor 
and shows up in chrome window popover.  Like Lookup Word key action.
      - Hovered Word
      - Hovered Image
      - Hovered Paragraph

[ ] Sometimes a web page hasn't loaded but you want to use certain keys.


----------------

[-] If a key action on the keyboard keyboard ref window does not have settings, clicking its keycap should not fix the popover in place like in settings mode.  It should do nothing.   Then if it does have settings, the popover should have a titlebar that says "Settings". The Key Action name 
at the top of the Inspector when it is loaded should be in bold.

Gmixer Audience Page Customization
[ ] restyle every page - override headers, paragraph, links.
   [ ] overrides backgrounds
   [ ] inspects and changes gradients.

[ ] duotone / monochrome all images on the page, including.

[ ] apply CSS filter to images and bg images.