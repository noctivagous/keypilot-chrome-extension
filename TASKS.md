
[ ] Contextual Menu updates 
  - Add shortcuts to every list item
 - Add "Control Strip (Alt/Opt + J)"
 - Toggle Keyboard Ref window  K
 
 [ ] - Assign Scroll Line Key Action to Spacebar by default.  Setting is global/system and can be turned off in
 contextual menu.  It will be listed in the select dropdown in the Keyboard Ref. Titlebar.

[ ] add Key Action: Keyboard Ref. Titlebar (Toggle) - collapse to titlebar/restore window 

[ ] add Key Action category: Playback: Play, Pause, Volume Up, Volume Down, Seek Forward, Seek Backward.

[ ] modify Top Sites: allow resizing vertically to 2 rows instead of min 3.

[ ]  modify: Tabs and Windows Overview - add close button to window titlebars and tabs list items.

[ ] add: Key Action: Popout Image - pops image under cursor out into floating window, uses the same floating window as Lookup Word.
resizable, has zoom icon controls, shows image information.  Uses code from Copy Image to pull out.  Has button
in toolbar for downloading, copying to clipboard.

[ ] modify Delete Mode: to have three submodes: Continuous - will delete until another key is pressed (mentioned in persistent toast alert),
Single - current, just select and delete, Quick - No select box preview, just deletes the first element underneath cursor.  Put these three
modes in the toast as a segm ctrl as well as the settings state of the popover tooltip.

[ ] add: Key Action category: Page Appearance Modification.
    - Key Action: Monochrome Images - will monochrome every image on every navigated page, uses css filter.

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


------------
[ ] If a key action on the keyboard keyboard ref window does not have settings, clicking its keycap should not fix the popover in place like in settings mode.  It should do nothing.   Then if it does have settings, the popover should have a titlebar that says "Settings". The Key Action name 
at the top of the Inspector when it is loaded should be in bold.




Keyboard Layout Config

[x]Change Instructions to 
"Instructions: 
 Click a key cap below once and 
 move the mouse. Use the placement arrow
 to place the action on the keyboard.
"  Increase the font size of Instructions.

[x] In the Inspector in the Keyboard Layout Config, it looks like
the Assigned Keys list is not in sync with what is on the keyboard layout.  
All assigned keys for that key action should show up in that list.  
The keys themselves in the list should have a kbd styling.  

[x] Give the key caps in the Actions Library a dark drop shadow with 1px blur
and 2px thickness, bottom and right.  Make sure they use our corner-shape
CSS.

[x]  The fieldset that says "Description" inside each card section does not
need the label "Description" and can just be the box.

[x]  Once the placement arrow begins for placing key caps, a pulsating message box should
show up to the right of "Instructions:" that says "Click the desired key cap location
on the Keyboard Reference."  The titlebar of Keyboard Reference should be pulsating.


extend early-inject:

[x] Sometimes you navigate to a page with Click Element but before it is finished loading you want to 
use the Go Back action.

[x] Sometimes a web page hasn't loaded but you want to see hover outlines
for clickables and be able to click them with Click Element.

[x] Some websites have attached to Scroll To Top and Scroll To Bottom events
it appears and when we use our fade-in and fade-out effect to replace it.
 

KEY ACTIONS:

[x] - "Font Info." - Shows popover with information about the font, font name,
size, family, file, font file type (.otf,.ttf,...) (download) resource URL, for the styled text 
underneath the cursor.  When popover is shown a rectangle outlines the
inspected text with the text range covering forwards and backwards from the
character underneath the cursor.

[x] Selection key actions - place in "Clipboard" section in Actions Library.
Allows for better control of selecting page data.

key actions:
    [x] Select Word.
    [x] Select Sentence.
    [x] Select Paragraph.
    [x] Select Image.

    A second press of any of these keys will deselect the named range type underneath
    the cursor.  That is, if a word is selected with Select Word and the cursor
    is still under that word and the key is pressed again, it will deselect
    that word.  Custom highlights are used so cumulative selections can show
    gaps (Chrome native Selection is one range).

Settings for all four for popover:
*exclusive (only one) | cumulative (pressing the key again over other text
will add to the selection.


BUGS
[x] There is a bug that after I turned lefthanded on in
Settings and then turned it off, the kb layout changed
back but the keys were still mapped to lefthanded.

[x] In the lefthanded mode, the A key is missing from the
Keyboard Ref window.

[x]  Often the control strip will load (early-inject ?)
in the expanded state when it is set to compact state.

[x] the diagonal hatching that is on Keyboard Ref window
during editing is not showing up visibly in the metal pro ui
right now of Keyboard Layout Config in teh titlebar

TASKS
[x] Set the extension's default "paint mode" to B->C,
skipping A (I think what says Auto B-C in the Shadow Root Debug win)
Whichever is chosen should be reflecte in the Shadow Root Debug win,
i.e. if B->C is being used then that shows up on first load of Shadow Root Debug
for a page.  Put this as a setting under "Advanced" in the Click Mode section
of Settings and include an additional setting: padding.  Right now,
padding is >0 for strategy A for buttons but is 0 for B->C for buttons.

[x] In the "Keyboard Layout Config" window, hide the legend "Stock function, 
Configurable, Stock macro, User macro" and replace with text to the right 
of "Card | Table" ctrl that says  

"
Instructions:
1. Hover over a key and press the close button to remove its action.
 2. Assign key caps in one of two ways:
 a. Click a key cap once and move the mouse
to use the placement arrow.
 b. Drag a key cap to its position
"

[x] If the current keyboard layout is set to lefthanded, 
"Keyboard Layout Config" should show a segmented switch
to the left of the [...] button on the same line as LAYOUT.
That [...] menu is where the user can switch to lefthanded.
If the switch is set to righthanded, it will disappear.
it only shows up if the lefthanded setting was set, either in
the Settings popover or in this [...] menu.

[x] In the "Keyboard Layout Config" window titlebar, to the right of the
titlebar title put "(Alt + C)" in kbd styling, normal font weight, and establish this as
an available setting for our window titlebars, then implement it across
all of them.  For example, for the Keyboard Ref window put "([K])" kbd
to the right of the titlebar.

[x] "Click to show settings" in the Keyboard Ref key action popover
should be in a chip capsule.  When a key action popover has entered
the configuration state, its bg should be darker and it should have
a corresponding outline.  If the key cap is clicked again for the
key cap that has a popover that has entered the configuration state,
it should return the popover to the normal hover styling and state.

[x] Put "Alt + C" to the right of "Edit Keyboard Layout..." in the 
Keyboard Ref titlebar select dropdown.

[x] Theming system.  The first thing we need to do is make sure
that all of our GUI follows a consistent pattern so that
we can actually theme everything.  We should also make
sure we have design token system so that this also allows
theming.  We should have three initial themes: 1) dark pro gui
with overrides (onboarding) 2) gray metal pro  3) gx-er - modeled
after the theme of opera gx in fonts and style, which includes
box corner truncation, a cyber style font that it uses, dark gray 
shading.  Initially we will not have a customization feature for our
themes but we will later, so we should prepare for that
by architecting the theming system.  A theme should include
changes from the default Click Mode and cursor settings.
We want to make sure that parameters or design tokens
exist for things such as corner radii.

[x] The next stage of our theming system.
We want a new tab on the left tabs of KeyPilot Settings.  
It will be called Appearance. It will have at the top of it 
the same Appearance fieldset found in the Overview tab but the 
rest of it will be all of the parameters and design tokens
that a user can currently customize for a theme.  
As soon as the user starts customizing it is no long the built-in theme 
but a copy of the built-in one.  If not already available,
the user should be able to customize the appearance of the Keyboard Ref
window keys, such as setting their backgrounds to no shading,
controlling the outline, whether they have corner radii or are truncated. 
It should allow the user
to set corners of the KeyPilot chrome windows, whether truncated
or rounded.  I would like to note that we should make sure that
the parameters and controls for window corner truncation and
rounding are applied to all of the KeyPilot windows because I saw
that KeyPilot settings does not have truncated corners on the
gx-er theme.


GX Audience Page Customization
[ ] restyle every page - override headers, paragraph, links.
   [ ] overrides backgrounds
   [ ] inspects and changes gradients.

[ ] duotone / monochrome all images on the page, including.

[ ] apply CSS filter to images and bg images.