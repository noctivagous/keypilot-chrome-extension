# KeyPilot Chrome Extension Architecture

## Overview

KeyPilot is a Chrome extension that transforms web browsing into a keyboard-first experience, providing intuitive keyboard shortcuts and visual feedback for common web interactions. This document explains how the extension is structured, built, and deployed.

## Core Architecture

### Extension Manifest (Manifest V3)
- **Location**: `extension/manifest.json`
- **Version**: <!-- KP_ARCHITECTURE_VERSION_START -->0.3.2<!-- KP_ARCHITECTURE_VERSION_END -->
- **Build Date**: <!-- KP_ARCHITECTURE_BUILD_DATE_START -->Dec-25-2025-9:16PM<!-- KP_ARCHITECTURE_BUILD_DATE_END -->
- **Purpose**: Defines extension metadata, permissions, and entry points
- **Key Features**:
  - Service worker for background processing (`background.js`)
  - Dual content scripts: early injection and main bundle
  - Popup interface (`popup.html`)
  - Custom new tab page (`pages/newtab.html`)
  - Global keyboard shortcut (Alt+K)
  - DeclarativeNetRequest for iframe embedding (removes X-Frame-Options restrictions)
  - Content scripts run in all frames (`all_frames: true`) for popover iframe support
  - Omnibox overlay for address bar functionality
  - History and bookmarks integration for omnibox suggestions
  - Web navigation permissions for enhanced navigation features

### Build System
- **Entry Point**: `extension/build.js`
- **Source Structure**: ES6 modules in `extension/src/`
- **Output**: Single bundled file (`content-bundled.js`)
- **Build Configuration**: `extension/babel.config.cjs` for Node.js transpilation
- **Process**:
  1. Validates all source files exist
  2. Concatenates modules into single IIFE
  3. Strips ES6 imports/exports
  4. Optional minification with Terser
  5. Updates manifest with build timestamp

## Component Hierarchy

### 1. Service Worker (`background.js`)
**Role**: Global state management and cross-tab coordination

**Responsibilities**:
- Manages extension enable/disable state via Chrome storage
- Handles global keyboard shortcut (Alt+K)
- Coordinates cursor settings across all tabs
- Processes tab navigation commands (Q/W for prev/next tab)
- Manages cross-tab communication via message passing

**Key Classes**:
- `ExtensionToggleManager`: Core state management
- `ContentScriptManager`: Conditional execution control

### 2. Early Injection (`early-inject.js`)
**Purpose**: Immediate visual feedback before main extension loads

**Features**:
- Injects at `document_start` for fastest possible cursor display
- Provides CSS-based cursor (green crosshair)
- Basic keyboard event capture for Alt+K toggle
- DOM observation for clickable elements
- Early rendering of floating keyboard reference shell (prevents flicker)
- Hands off control to main extension when loaded

**Performance Benefits**:
- Cursor appears instantly on page load
- No delay waiting for main bundle to load
- Responsive toggle even during page load
- Keyboard reference UI shell ready before main extension initializes

### 3. Main Content Script (`content-bundled.js`)
**Architecture**: Modular ES6 class-based system

**Core Modules**:

#### State Management
- `StateManager`: Central state coordination
- `KeyPilotToggleHandler`: Wraps main KeyPilot instance with enable/disable logic

#### Visual Components
- `Cursor`: Manages crosshair cursor positioning
- `OverlayManager`: Handles visual overlays (highlights, selections, popover iframes)
- `StyleManager`: Manages CSS injection and removal
- `ShadowDOMManager`: Isolates extension styles
- `HighlightManager`: Manages text selection highlighting

#### Interaction Handling
- `EventManager`: Base class for event handling
- `ActivationHandler`: Processes F/G key clicks
- `FocusDetector`: Detects text input focus
- `MouseCoordinateManager`: Tracks mouse position
- `ElementDetector`: Detects elements under cursor

#### Advanced Features
- `TextElementFilter`: Filters text-containing elements
- `EdgeCharacterDetector`: Handles text selection edge cases
- `RectangleIntersectionObserver`: Optimized intersection detection
- `IntersectionObserverManager`: Manages intersection observers for performance
- `OptimizedScrollManager`: Smooth scrolling operations
- `OmniboxManager`: Address bar overlay with history/bookmarks integration
- `OnboardingManager`: Manages user onboarding flow and tutorials
- `PopupManager`: Handles popup window lifecycle and positioning
- `SettingsManager`: Centralized settings storage and retrieval
- `TabHistoryPopover`: Manages tab history navigation popover
- `UrlListingManager`: Handles URL listing and navigation features

#### UI Components
- `FloatingKeyboardHelp`: Floating keyboard visualization panel (K key toggle)
- `KeybindingsUI`: Keyboard visualization with interactive tooltips
- `KeybindingsUIShared`: Shared constants and CSS generation for keyboard UI (early-inject and bundled)
- `PopupThemeVars`: Centralized theme variables for consistent styling across UI surfaces
- `OnboardingPanel`: User onboarding interface and tutorial system
- `PracticePopoverPanel`: Interactive practice mode for keyboard shortcuts

### 4. Popup Interface (`popup.html` + `popup.js`)
**Purpose**: User settings and status display

**Features**:
- Enable/disable toggle
- Cursor size adjustment (0.5x - 2.0x)
- Cursor visibility toggle
- Real-time state synchronization
- Interactive keyboard visualization with keybindings
- Status indicator (ON/OFF/TEXT/DELETE/UNAVAILABLE)
- Availability detection for restricted pages (chrome://, etc.)

### 5. Custom New Tab Page (`pages/newtab.html` + `pages/newtab.js`)
**Purpose**: Enhanced new tab experience with KeyPilot branding and quick access features

**Features**:
- Custom KeyPilot-themed new tab page
- Quick access to extension settings
- Integration with KeyPilot's keyboard-first navigation philosophy
- Consistent visual design with popup interface

## Data Flow

### Initialization Sequence
1. **Manifest loads** → Service worker starts
2. **Early injection** → CSS cursor and keyboard reference shell appear immediately
3. **Main bundle loads** → Full functionality initializes
4. **Toggle handler** → Queries service worker for current state
5. **State applied** → Extension either enables or remains disabled
6. **UI adoption** → Main extension adopts early-injected UI elements (prevents flicker)

### User Interaction Flow
1. **Keyboard input** → Event captured by main content script
2. **State check** → Toggle handler validates extension is enabled
3. **Command processing** → Appropriate handler processes command
4. **Visual feedback** → Cursor/highlights update accordingly
5. **Action execution** → DOM manipulation or navigation occurs

### Toggle Flow (Alt+K)
1. **Keyboard shortcut** → Captured by service worker
2. **State update** → Stored in Chrome storage (sync + local)
3. **Cross-tab notification** → All tabs receive state change message
4. **UI update** → Each tab shows/hides visual elements
5. **Notification display** → User sees confirmation overlay

## Key Features Explained

### Operation Modes

#### Navigation Mode (Default)
- Green crosshair cursor
- F key: Activate element under cursor
- G key: Activate in new tab
- H key: Middle click (open in new tab, background)
- E key: Open link in popover iframe
- D/S: Browser back
- R: Browser forward
- Q/W: Previous/next tab
- T: New tab
- Backspace: Toggle delete mode
- K: Toggle floating keyboard reference
- L: Open omnibox (address bar overlay)
- ' (quote): Open KeyPilot settings
- ` (backtick): Navigate to site root
- A: Close current tab
- **Scrolling**:
  - Z: Page up (800px)
  - X: Page down (800px)
  - C: Page up instant (400px)
  - V: Page down instant (400px)
  - B: Scroll to top
  - N: Scroll to bottom

#### Text Focus Mode
- Orange cursor and labels
- Automatic detection of input fields
- ESC key exits focus mode
- Only ESC intercepted in this mode

#### Delete Mode
- Red X cursor
- Backspace key deletes elements
- Click elements to remove them

#### Omnibox Mode
- Address bar overlay with search suggestions
- L key opens omnibox overlay
- ESC key closes omnibox
- Integrates with browser history and bookmarks

#### Popover Mode
- Modal iframe overlay (80vw x 80vh, centered)
- E key opens link in popover iframe
- ESC or E key closes popover
- F key closes popover when pressed outside iframe
- Scroll shortcuts (Z/X/C/V/B/N) scroll the iframe content
- Full KeyPilot functionality available inside popover iframe
- Iframe bridge enables keyboard shortcuts across frame boundary

#### Text Selection Modes
- **H key (Character)**: Natural text flow selection
- **Y key (Rectangle)**: Area-based selection
- Both show identical visual rectangle
- Different text extraction algorithms

#### Floating Keyboard reference
- **K key**: Toggle floating keyboard visualization panel
- Interactive keyboard with all keybindings displayed
- Click keys to see detailed tooltips
- Positioned at bottom-left (16px from edges)
- Persists visibility state across page loads
- Early-injected shell prevents UI flicker

### Omnibox Overlay System
- **L key**: Opens centered address bar overlay
- **Purpose**: Browser-integrated address bar with search functionality
- **Features**:
  - Suggestions from browser history and bookmarks
  - Search engine integration (configurable)
  - URL validation and navigation
  - Keyboard navigation (arrow keys, enter, escape)
  - Non-URL queries automatically become search engine queries
- **Integration**: Communicates with service worker for history/bookmarks data

### Performance Optimizations

#### Early Loading
- Critical CSS injected at document start
- Immediate visual feedback
- Progressive enhancement
- Early UI shell creation (keyboard reference) prevents flicker

#### Optimized Rendering
- Shadow DOM isolation
- Efficient intersection observers
- Minimal DOM manipulation
- UI element adoption (main extension adopts early-injected elements)

#### State Management
- Chrome storage sync across devices
- Cross-tab state synchronization
- Persistent settings
- Keyboard reference visibility persistence

#### Iframe Bridge
- PostMessage-based communication between parent and popover iframe
- Handshake protocol for bridge initialization
- Scroll command forwarding to iframe
- Keyboard event bridging (ESC/E for close, F for activation)
- Full KeyPilot initialization inside popover iframes

## Build and Deployment

### Development Workflow
```bash
# Build unminified bundle
npm run build

# Build minified bundle
npm run build:minify

# Manual installation
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Load unpacked: select extension/ directory
```

### Source Organization
```
extension/
├── _metadata/             # Build-generated metadata
│   └── generated_indexed_rulesets/
│       └── _ruleset1      # Indexed declarative net request rules
├── src/                    # Source modules (ES6)
│   ├── config/            # Constants and configuration
│   │   └── constants.js   # Keybindings, selectors, z-index values
│   ├── modules/           # Core functionality
│   │   ├── activation-handler.js
│   │   ├── cursor.js
│   │   ├── edge-character-detector.js
│   │   ├── element-detector.js
│   │   ├── event-manager.js
│   │   ├── focus-detector.js
│   │   ├── highlight-manager.js
│   │   ├── intersection-observer-manager.js
│   │   ├── keypilot-toggle-handler.js
│   │   ├── mouse-coordinate-manager.js
│   │   ├── omnibox-manager.js
│   │   ├── onboarding-manager.js
│   │   ├── optimized-scroll-manager.js
│   │   ├── overlay-manager.js
│   │   ├── popup-manager.js
│   │   ├── rectangle-intersection-observer.js
│   │   ├── settings-manager.js
│   │   ├── shadow-dom-manager.js
│   │   ├── state-manager.js
│   │   ├── style-manager.js
│   │   ├── tab-history-popover.js
│   │   ├── text-element-filter.js
│   │   └── url-listing-manager.js
│   ├── ui/                 # UI components
│   │   ├── floating-keyboard-help.js
│   │   ├── keybindings-ui.js
│   │   ├── keybindings-ui-shared.js  # Shared keyboard UI constants/CSS
│   │   ├── onboarding-panel.js       # User onboarding interface
│   │   ├── popup-theme-vars.js       # Centralized theme variables
│   │   └── practice-popover-panel.js # Interactive practice exercises
│   ├── utils/             # Utility functions
│   │   └── logger.js
│   ├── content-script.js  # Entry point
│   └── keypilot.js        # Main class
├── babel.config.cjs       # Babel configuration for build system
├── build.js              # Build script
├── content-bundled.js    # Generated bundle
├── early-inject.js       # Early injection script
├── manifest.json         # Extension manifest
└── pages/                # HTML pages and assets
    ├── guide.css         # User guide styling
    ├── guide.html        # User guide page
    ├── guide.js          # Guide page logic
    ├── keypilot-page-init.js # Page initialization utilities
    ├── newtab.css        # New tab page styling
    ├── newtab.html       # Custom new tab page
    ├── newtab.js         # New tab page logic
    ├── onboarding.xml    # Onboarding configuration
    ├── popover-bridge.js # Popover iframe bridge
    ├── settings.css      # Settings page styling
    ├── settings.html     # Settings page
    ├── settings.js       # Settings page logic
    ├── text-mode-practice.html # Text mode practice page
    ├── text-mode-tutorial.html # Text mode tutorial page
    └── ui-standards.css  # UI design standards
```

### Module Loading Strategy
- **Development**: Individual ES6 modules
- **Production**: Single concatenated bundle
- **Imports stripped**: No tree-shaking needed
- **IIFE wrapper**: Prevents global pollution

## Browser Compatibility

- ✅ **Chrome**: Full support (recommended)
- ✅ **Edge**: Full support
- ⚠️ **Firefox**: Limited support
- ❌ **Safari**: Not supported

## Error Handling

### Graceful Degradation
- Service worker failures → Default to enabled state
- Content script failures → Fallback without toggle
- Module failures → Continue with partial functionality

### State Recovery
- Storage failures → Use default values
- Message timeouts → Retry with exponential backoff
- DOM manipulation failures → Log and continue

## Security Considerations

### Content Script Isolation
- Shadow DOM prevents style conflicts
- Minimal global namespace pollution
- Event delegation for security

### Permission Model
- `<all_urls>` for content scripts
- Storage permissions for state persistence
- Tabs permission for cross-tab navigation
- History permission for omnibox suggestions
- Bookmarks permission for omnibox suggestions
- DeclarativeNetRequest for removing X-Frame-Options restrictions (enables popover iframes)

### Input Validation
- Sanitized storage keys
- Validated message types
- Bounded numeric inputs

## Advanced Features

### Popover Iframe System
- **Purpose**: Open links in modal iframe overlays without leaving current page
- **Implementation**: 
  - DeclarativeNetRequest removes X-Frame-Options restrictions
  - PostMessage bridge enables keyboard shortcuts across frame boundary
  - Full KeyPilot functionality available inside popover iframes
  - Automatic bridge initialization and handshake protocol
- **User Experience**: 
  - E key opens link in popover
  - ESC/E closes popover
  - Scroll shortcuts work inside popover
  - Seamless keyboard navigation within iframe

### Floating Keyboard reference
- **Purpose**: Interactive keyboard visualization with all keybindings
- **Features**:
  - Toggle with K key
  - Click keys to see detailed tooltips
  - Persistent visibility state
  - Early-injected shell prevents flicker
  - Matches popup.html theme

### Keybindings UI System
- **Purpose**: Consistent keyboard visualization across popup and content script
- **Features**:
  - Interactive tooltips on key hover/click
  - Responsive layout
  - Theme-aware styling
  - Reusable rendering function

### Onboarding and Tutorial System
- **Purpose**: Guide new users through KeyPilot features and keyboard shortcuts
- **Components**:
  - `OnboardingPanel`: Main onboarding interface
  - `PracticePopoverPanel`: Interactive practice exercises
  - `OnboardingManager`: Coordinates onboarding flow and state
- **Features**:
  - Progressive tutorial system
  - Interactive practice modes
  - Persistent onboarding state


## Future Enhancements

### Potential Improvements
- WebAssembly integration for performance
- Service worker caching for faster loads
- Advanced accessibility features
- Multi-language keyboard layouts
- Theme customization options
- Popover iframe resizing and positioning controls

---

**Built with**: ES6 modules, Chrome Extension Manifest V3
**Architecture**: Modular class-based system with early injection
**Performance**: Optimized for immediate visual feedback
**Compatibility**: Modern Chromium-based browsers

*Last updated: December 25, 2025*
