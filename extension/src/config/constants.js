/**
 * Application constants and configuration
 */
import { buildEffectiveKeybindings, DEFAULT_KEYBOARD_LAYOUT_ID, DEFAULT_KEYBOARD_HANDEDNESS } from './keyboard-layouts.js';

// Legacy export used across the codebase and by `extension/build.js`.
// Default layout + system layer. Runtime should recompute from active settings.
export const KEYBINDINGS = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID, DEFAULT_KEYBOARD_HANDEDNESS);

export const SELECTORS = {
  CLICKABLE: 'a[href], button, input, select, textarea',
  // Prefer IDL-backed checks via isTypingContext() when possible. These selectors
  // are best-effort for matches()/querySelector (note: bare <input> has no type attr).
  TEXT_INPUTS: 'input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], textarea',
  FOCUSABLE_TEXT: 'input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'
};

export const ARIA_ROLES = {
  CLICKABLE: ['link', 'button']
};

/**
 * Semantic categories for interactive hover/activation targets.
 * Hover UI, F-key feedback, and activation should branch on category — not treat
 * every clickable the same as a hyperlink.
 *
 * Priority when classifying (most specific first):
 *   text > slider > button > link > media > control > generic
 */
export const CLICKABLE_CATEGORY = {
  /** Nothing interactive under the pointer */
  NONE: 'none',
  /** Navigation: <a href>, role=link, data-kp-url rows */
  LINK: 'link',
  /** Discrete actions: <button>, role=button */
  BUTTON: 'button',
  /** Typing surfaces: text inputs, textarea, contenteditable */
  TEXT: 'text',
  /** Video/audio surface (thumbnail or player body) */
  MEDIA: 'media',
  /** Continuous value: range, role=slider, media scrub tracks */
  SLIDER: 'slider',
  /** Other form/ARIA controls: checkbox, radio, select, tab, switch, … */
  CONTROL: 'control',
  /** Non-semantic interactive (cursor:pointer, onclick, tracked click listener) */
  GENERIC: 'generic'
};

export const CSS_CLASSES = {
  CURSOR_HIDDEN: 'kpv2-cursor-hidden',
  FOCUS: 'kpv2-focus',
  DELETE: 'kpv2-delete',
  HIGHLIGHT: 'kpv2-highlight',
  HIDDEN: 'kpv2-hidden',
  RIPPLE: 'kpv2-ripple',
  FOCUS_OVERLAY: 'kpv2-focus-overlay',
  /**
   * Strategy B: in-target absolute focus ring — mounted as last child of the
   * clickable/host with local max z-index + 1. Co-located paint; scrolls with
   * the element. Preference order: A DOM outline → B this ring → C body fixed.
   */
  FOCUS_RING_INTARGET: 'kpv2-focus-ring-intarget',
  /** Temporary outline that scales up on F-click activation */
  FOCUS_PULSE: 'kpv2-focus-pulse',
  /** Temporary outline with a marquee/chaser light traveling the perimeter on F-click */
  FOCUS_MARQUEE: 'kpv2-focus-marquee',
  /** Temporary hard flash (strobe) on F-click activation */
  FOCUS_FLASH: 'kpv2-focus-flash',
  /** Temporary dashed border whose dashes chase around the perimeter on F-click */
  FOCUS_DASH: 'kpv2-focus-dash',
  /** Temporary frame that scales (pop then shrink) when copying an image under cursor */
  IMAGE_COPY_PULSE: 'kpv2-image-copy-pulse',
  DELETE_OVERLAY: 'kpv2-delete-overlay',
  /**
   * Shared inspector-mode hover chrome (Delete, Cols, future pick tools).
   * Kind-specific colors applied via CSS vars / inline styles.
   */
  INSPECTOR: 'kpv2-inspector',
  INSPECTOR_OVERLAY: 'kpv2-inspector-overlay',
  /** Top-right companion instruction while inspector pick is active (like highlight mode) */
  INSPECTOR_MODE_INDICATOR: 'kpv2-inspector-mode-indicator',
  /** @deprecated prefer INSPECTOR + kind; kept for style/compat during transition */
  COLS: 'kpv2-cols',
  COLS_OVERLAY: 'kpv2-cols-overlay',
  /** Applied multicol layout on the chosen target */
  COLS_ACTIVE: 'kpv2-cols-active',
  /** Page-mode markers on html/body while whole-page columns are active */
  COLS_PAGE: 'kpv2-cols-page',
  /** Widget shell wrapping a columnized target (outline + slip chrome) */
  COLS_SHELL: 'kpv2-cols-shell',
  /** Content region inside the shell that holds the target */
  COLS_BODY: 'kpv2-cols-body',
  /** Placeholder left in flow when shell is promoted to a popover */
  COLS_PLACEHOLDER: 'kpv2-cols-placeholder',
  /** Slip-edit chrome (NLE-style content window scrubber) */
  COLS_SLIP_BAR: 'kpv2-cols-slip-bar',
  COLS_SLIP_TRACK: 'kpv2-cols-slip-track',
  COLS_SLIP_KNOB: 'kpv2-cols-slip-knob',
  COLS_SLIP_LABEL: 'kpv2-cols-slip-label',
  /** Slip-bar action: promote columns widget to floating popover */
  COLS_EXPAND_BTN: 'kpv2-cols-expand-btn',
  /** Slip-bar action: clear columns / restore element */
  COLS_CLOSE_BTN: 'kpv2-cols-close-btn',
  HIGHLIGHT_OVERLAY: 'kpv2-highlight-overlay',
  HIGHLIGHT_SELECTION: 'kpv2-highlight-selection',
  /** Persistent outline for elements added in cumulative inspector pick */
  INSPECTOR_PICKED: 'kpv2-inspector-picked',
  INSPECTOR_PICKED_OVERLAY: 'kpv2-inspector-picked-overlay',
  INSPECTOR_UNION_OVERLAY: 'kpv2-inspector-union-overlay',
  TEXT_FIELD_GLOW: 'kpv2-text-field-glow',
  VIEWPORT_MODAL_FRAME: 'kpv2-viewport-modal-frame',
  ESC_EXIT_LABEL: 'kpv2-esc-exit-label',
  TEXT_FOCUS_INPUT: 'kpv2-text-focus-input',
  TEXT_FOCUS_INPUT_PARENT: 'kpv2-text-focus-input-parent',
  /** Modifier: focused text field uses left-edge 10px pulsating bar (default style). */
  TEXT_FOCUS_LEFT_EDGE: 'kpv2-text-focus-left-edge',
  TEXT_HOVER_INPUT: 'kpv2-text-hover-input',
  TEXT_HOVER_INPUT_PARENT: 'kpv2-text-hover-input-parent',

  /** Canvas-based focus/delete overlay host (OverlayManager) */
  CANVAS_OVERLAY: 'kpv2-canvas-overlay',
  /** CSS custom-properties focus/delete overlay host (OverlayManager) */
  CSS_PROPS_OVERLAY: 'kpv2-css-props-overlay',

  // Omnibox overlay UI
  OMNIBOX_BACKDROP: 'kpv2-omnibox-backdrop',
  OMNIBOX_PANEL: 'kpv2-omnibox-panel',
  OMNIBOX_INPUT: 'kpv2-omnibox-input',
  OMNIBOX_SUGGESTIONS: 'kpv2-omnibox-suggestions',
  OMNIBOX_SUGGESTION: 'kpv2-omnibox-suggestion',
  OMNIBOX_EMPTY: 'kpv2-omnibox-empty',

  // PopupManager (shared backdrop for modals/popups that should blur the page)
  POPUP_BACKDROP: 'kpv2-popup-backdrop'
};

export const ELEMENT_IDS = {
  CURSOR: 'kpv2-cursor',
  STYLE: 'kpv2-style'
};

export const Z_INDEX = {
  // Utility layers (occasionally used for measurement elements)
  PAGE_BEHIND: -1,
  DEFAULT: 1,

  // Keep all KeyPilot UI comfortably above typical site z-index values.
  // Note: Many browsers effectively clamp very large z-index values; using a
  // high-but-safe base avoids accidental collisions and keeps ordering clear.
  _BASE: 2147483000,

  // Low-ish KeyPilot overlays
  VIEWPORT_MODAL_FRAME: 2147483010,
  HIGHLIGHT_SELECTION: 2147483015,

  // PopupManager layers (kept BELOW click overlays so the green click rectangle can sit above popups)
  POPUP_BACKDROP: 2147483009,
  POPUP_PANEL_BASE: 2147483012,
  POPUP_PANEL_MAX: 2147483017,

  // Focus/delete/highlight overlays
  OVERLAYS_BELOW_2: 2147483018,
  OVERLAYS_BELOW: 2147483019,
  OVERLAYS: 2147483020,
  OVERLAYS_ABOVE: 2147483021,

  // macOS-style control strip (upper-left; stays at top; below walkthrough in z-order)
  CONTROL_STRIP: 2147483025,

  // Onboarding walkthrough (top-left, stacked below the control strip on screen).
  // z-index above the strip so if they ever overlap the panel wins; still below
  // green hover/click overlays and floating keyboard help.
  ONBOARDING_PANEL: 2147483026,

  // Cols Toggle slip-edit bar (bottom of viewport; below keyboard help / cursor)
  COLS_SLIP_BAR: 2147483030,

  // Iframe-based popover modal (Open Popover)
  POPOVER_IFRAME_MODAL: 2147483035,

  // Notifications / message overlays
  MESSAGE_BOX: 2147483040,
  DEBUG_HUD: 2147483041,
  NOTIFICATION: 2147483040,

  // Omnibox overlay (should sit above most UI, but below keyboard help + cursor)
  OMNIBOX: 2147483042,

  // Floating keyboard reference + key-click tooltip (above page UI, below cursor)
  FLOATING_KEYBOARD_HELP: 2147483045,
  KEYBINDINGS_POPOVER: 2147483046,
  // Per-key floating config panel (above sticky key popover, below cursor)
  KEY_ACTION_CONFIG: 2147483047,
  // Compact Keyboard Layout Config palette (beside Reference while editing)
  KEYBOARD_LAYOUT_CONFIG: 2147483048,
  // Click-to-place arrow (fallback when Popover API unavailable)
  LAYOUT_PLACE_ARROW: 2147483052,

  // Cursor sits above chrome; click ripple is above even that so the
  // expanding circles always remain visible.
  CURSOR: 2147483050,
  RIPPLE: 2147483051
};

/**
 * Scroll distances / behavior for page / popover keyboard scrolling (defaults).
 * Runtime values can be overridden via Settings (`kp_settings_v1.scroll`).
 * Used by key handlers and popover iframe bridges.
 *
 * C / V (half-page) and Z / X (to edge) use cursor-aware scrolling
 * (`scroll-at-point.js`): nested overflow under the pointer first (vertical,
 * or horizontal when that container scrolls on X), then the document. Iframes
 * are forwarded via the light frame-click-agent (KP_FRAME_SCROLL).
 *
 * Cross-frame pointer/focus: child agents post KP_FRAME_POINTER so top lastMouse
 * stays accurate over iframes; KP_FRAME_FOCUS_RECLAIM returns keyboard ownership
 * to the top frame after a manual click into an embed (e.g. Issuu reader).
 */
export const SCROLL = Object.freeze({
  /** Legacy large page step (popover parent→iframe PAGE_UP/DOWN path) */
  PAGE_PX: 800,
  /** C / V: smaller step (default = prior 400px × 1.25) */
  HALF_PAGE_PX: 500,
  /** Default CSS scroll-behavior for keyboard scrolling */
  BEHAVIOR: 'smooth'
});

export const MODES = {
  NONE: 'none',
  /**
   * Shared element-pick inspector (DOM inspector style).
   * Concrete tool is state.inspectorKind (see INSPECTOR_KIND).
   * Used by Delete Mode, Cols Toggle, and future pick tools.
   */
  INSPECTOR: 'inspector',
  /**
   * @deprecated Use MODES.INSPECTOR + INSPECTOR_KIND.DELETE.
   * Kept so older status strings / comparisons still resolve if needed.
   */
  DELETE: 'delete',
  /**
   * @deprecated Use MODES.INSPECTOR + INSPECTOR_KIND.COLS.
   */
  COLS: 'cols',
  TEXT_FOCUS: 'text_focus',
  HIGHLIGHT: 'highlight',
  POPOVER: 'popover',
  OMNIBOX: 'omnibox'
};

/**
 * Inspector tool kinds while mode === MODES.INSPECTOR.
 * Register visuals/behavior in modules/inspector-mode.js.
 */
export const INSPECTOR_KIND = Object.freeze({
  DELETE: 'delete',
  COLS: 'cols',
  /** Cumulative element pick for Rectangle Select (Y) alternate mode */
  RECTANGLE_PICK: 'rectangle_pick'
});

/**
 * Semantic HTML tags used as selection granularity for Y element-rectangle mode.
 * Deepest intersecting match wins when both ancestor and descendant qualify.
 */
export const ELEMENT_SELECT_TAGS = Object.freeze([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'li', 'blockquote', 'pre', 'code',
  'article', 'section', 'aside', 'header', 'footer', 'main', 'nav',
  'a', 'img', 'figure', 'figcaption', 'picture', 'video', 'audio', 'svg',
  'td', 'th', 'dt', 'dd', 'caption', 'summary', 'label'
]);

// Cursor behavior mode (Settings label for CUSTOM_CURSORS is "Crosshair"):
// - NO_CUSTOM_CURSORS: KeyPilot does not override the page cursor at all.
// - CUSTOM_CURSORS: KeyPilot applies its crosshair (or other) cursor overrides.
export const CURSOR_MODE = Object.freeze({
  NO_CUSTOM_CURSORS: 'NO-CUSTOM-CURSORS',
  CUSTOM_CURSORS: 'CUSTOM-CURSORS'
});

/**
 * System UI font for KeyPilot chrome injected into host pages.
 * Pin this on popovers/titlebars so site body fonts (e.g. freight-text-pro) cannot leak in.
 * Single declaration — the content bundle is one IIFE scope (no per-module consts of the same name).
 */
export const KP_UI_FONT =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const COLORS = {
  // Primary cursor colors
  FOCUS_GREEN: 'rgba(0,180,0,0.95)',
  FOCUS_GREEN_BRIGHT: 'rgba(0,128,0,0.95)',
  DELETE_RED: 'rgba(220,0,0,0.95)',
  /** Cols Toggle accent (purple, distinct from delete red / highlight blue) */
  COLS_PURPLE: 'rgba(156,39,176,0.95)',
  COLS_PURPLE_BRIGHT: 'rgba(186,104,200,0.95)',
  HIGHLIGHT_BLUE: 'rgba(0,120,255,0.95)',
  ORANGE: '#ff8c00',
  // Focus overlay (alternate) colors (used to visually distinguish DOM-hover targeting mode)
  FOCUS_BLUE: 'rgba(33,150,243,0.95)',

  // Text and background colors
  TEXT_WHITE_PRIMARY: 'rgba(255,255,255,0.95)',
  TEXT_WHITE_SECONDARY: 'rgba(255,255,255,0.8)',
  TEXT_GREEN_BRIGHT: '#6ced2b',

  // Background colors
  MESSAGE_BG_BROWN: '#ad6007',
  MESSAGE_BG_GREEN: '#10911b',

  // Border and shadow colors
  ORANGE_BORDER: 'rgba(255,140,0,0.4)',
  ORANGE_SHADOW: 'rgba(255,140,0,0.45)',
  ORANGE_SHADOW_DARK: 'rgba(255,140,0,0.8)',
  ORANGE_SHADOW_LIGHT: 'rgba(255,140,0,0.3)',
  GREEN_SHADOW: 'rgba(0,180,0,0.45)',
  GREEN_SHADOW_BRIGHT: 'rgba(0,180,0,0.5)',
  BLUE_SHADOW: 'rgba(33,150,243,0.35)',
  BLUE_SHADOW_BRIGHT: 'rgba(33,150,243,0.45)',
  DELETE_SHADOW: 'rgba(220,0,0,0.35)',
  DELETE_SHADOW_BRIGHT: 'rgba(220,0,0,0.45)',
  COLS_SHADOW: 'rgba(156,39,176,0.35)',
  COLS_SHADOW_BRIGHT: 'rgba(156,39,176,0.5)',
  HIGHLIGHT_SHADOW: 'rgba(0,120,255,0.35)',
  HIGHLIGHT_SHADOW_BRIGHT: 'rgba(0,120,255,0.45)',
  BLACK_SHADOW: 'rgba(40, 40, 40, 0.7)',

  // Ripple effect colors
  RIPPLE_GREEN: 'rgba(0,200,0,0.35)',
  RIPPLE_GREEN_MID: 'rgba(0,200,0,0.22)',
  RIPPLE_GREEN_TRANSPARENT: 'rgba(0,200,0,0)',

  // Flash animation colors
  FLASH_GREEN: 'rgba(0,255,0,1)',
  FLASH_GREEN_SHADOW: 'rgba(0,255,0,0.8)',
  FLASH_GREEN_GLOW: 'rgba(0,255,0,0.9)',

  // Image-copy pulse (distinct from green F-click pulse)
  IMAGE_COPY_FRAME: 'rgba(33,150,243,0.95)',
  IMAGE_COPY_FRAME_SHADOW: 'rgba(33,150,243,0.55)',
  IMAGE_COPY_FRAME_GLOW: 'rgba(100,180,255,0.75)',
  IMAGE_COPY_FILL: 'rgba(33,150,243,0.14)',
  IMAGE_COPY_FLASH: 'rgba(255,255,255,0.45)',

  // Notification colors
  NOTIFICATION_SUCCESS: '#4CAF50',
  NOTIFICATION_ERROR: '#f44336',
  NOTIFICATION_WARNING: '#ff9800',
  NOTIFICATION_INFO: '#2196F3',
  NOTIFICATION_SHADOW: 'rgba(0, 0, 0, 0.15)',

  // Text field glow
  TEXT_FIELD_GLOW: 'rgba(255,165,0,0.8)',

  // Highlight selection colors
  HIGHLIGHT_SELECTION_BG: 'rgba(0,120,255,0.3)',
  HIGHLIGHT_SELECTION_BORDER: 'rgba(0,120,255,0.6)',

  // New colors for ESC exit labels
  ORANGE_BG: 'rgba(255, 165, 0, 0.9)',
  ORANGE_TEXT: '#fff',
  ORANGE_BORDER: '#d35400',
  FOCUS_GREEN_BG: 'rgba(46, 204, 113, 0.9)',
  FOCUS_GREEN_BG_T2: 'rgba(46, 204, 113, 0.4)',
  FOCUS_GREEN_TEXT: '#fff',
  FOCUS_GREEN: '#27ae60',
  FOCUS_BLUE_BG_T2: 'rgba(33,150,243,0.25)'
};

// Legacy scale-based cursor storage (keypilot_cursor_size / keypilot_cursor_visible)
// was removed. Cursor appearance lives in kp_settings_v1 via settings-manager
// (clickMode.cursor + cursorMode).

export const RECTANGLE_SELECTION = {
  // Visual rectangle settings
  MIN_WIDTH: 3,           // Minimum rectangle width to show (pixels)
  MIN_HEIGHT: 3,          // Minimum rectangle height to show (pixels)
  MIN_DRAG_DISTANCE: 5,   // Minimum drag distance to start selection (pixels)

  // Visual feedback settings
  SHOW_IMMEDIATE_FEEDBACK: true,        // Show rectangle for any movement
  HIDE_ZERO_SIZE: false,                // Don't hide zero-size rectangles

  // Performance limits (should match browser capabilities)
  MAX_AREA_PIXELS: 50000000,           // 50M pixels (e.g., 10000x5000) - very generous limit
  MAX_TEXT_NODES: 10000,               // Maximum text nodes to process - matches browser selection limits
  ENABLE_AREA_LIMIT: false,            // Disable area limiting by default - browsers handle large selections fine
  ENABLE_NODE_LIMIT: true,             // Keep node limit as safety measure for DOM traversal performance

  // Performance notes:
  // - Area limits are disabled by default because browsers can handle enormous text selections
  // - Node limits remain enabled to prevent DOM traversal performance issues on complex pages
  // - These limits only apply to rectangle selection, not manual browser selection
  // - The clipboard is typically the real limiting factor, not the selection itself
};

export const EDGE_ONLY_SELECTION = {
  // Smart Targeting Options
  SMART_TARGETING: {
    ENABLED: true,                     // Enable smart element targeting
    TEXT_ELEMENT_TAGS: [               // HTML tags that commonly contain text
      'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'td', 'th', 'a', 'strong', 'em', 'b', 'i', 'u',
      'blockquote', 'pre', 'code', 'label', 'legend', 'article',
      'section', 'header', 'footer', 'main', 'aside', 'nav'
    ],
    SKIP_ELEMENT_TAGS: [               // HTML tags to skip (non-text elements)
      'img', 'video', 'audio', 'canvas', 'svg', 'iframe',
      'script', 'style', 'noscript', 'object', 'embed'
    ],
    MIN_TEXT_LENGTH: 1,                // Minimum text content length to consider
    CHECK_COMPUTED_STYLE: true,        // Check if element is visible via computed style
    INCLUDE_ARIA_LABELS: true,         // Include elements with aria-label/aria-labelledby
    MAX_ELEMENTS_TO_OBSERVE: 5000,     // Maximum elements to observe simultaneously
  },

  // Character Detection Settings
  CHARACTER_DETECTION: {
    ENABLED: true,                     // Enable edge-level character detection
    USE_RANGE_API: true,               // Use Range API for precise character positioning
    CACHE_CHARACTER_POSITIONS: true,   // Cache character positions using WeakMap
    CHARACTER_CACHE_SIZE: 1000,        // Maximum characters to cache per element
    BOUNDARY_DETECTION_PRECISION: 1,   // Pixel precision for boundary detection
    BATCH_CHARACTER_PROCESSING: true,  // Process characters in batches
    CHARACTER_BATCH_SIZE: 50,          // Number of characters to process per batch
    MAX_CHARACTERS_PER_ELEMENT: 10000, // Maximum characters to process per element
  },

  // Cache Configuration
  CACHE_CONFIGURATION: {
    ELEMENT_CACHE_SIZE: 1000,          // Maximum number of elements to cache
    CHARACTER_CACHE_SIZE: 5000,        // Maximum number of character positions to cache
    CACHE_CLEANUP_THRESHOLD: 800,      // Start cleanup when cache reaches this size
    CACHE_CLEANUP_BATCH_SIZE: 200,     // Number of entries to remove during cleanup
    ENABLE_PREDICTIVE_CACHING: true,   // Pre-cache elements likely to intersect
    PREDICTIVE_CACHE_DISTANCE: 100,    // Distance in pixels to pre-cache elements
    CACHE_TTL_MS: 30000,               // Time-to-live for cached entries (30 seconds)
    ENABLE_CACHE_COMPRESSION: false,   // Enable cache compression (experimental)
  },

  // Performance Monitoring Configuration
  PERFORMANCE_MONITORING: {
    ENABLED: false,                     // Enable performance monitoring
    MONITORING_INTERVAL: 1000,         // How often to check performance (ms)
    COLLECT_DETAILED_METRICS: true,    // Collect detailed performance metrics
    TRACK_CACHE_EFFICIENCY: true,      // Track cache hit/miss ratios
    TRACK_PROCESSING_TIME: true,       // Track processing time per operation
    TRACK_MEMORY_USAGE: true,          // Track memory usage
    PERFORMANCE_LOG_INTERVAL: 5000,    // How often to log performance stats (ms)
    ENABLE_PERFORMANCE_ALERTS: true,   // Enable performance degradation alerts
  },

  // Fallback Configuration
  FALLBACK_CONFIGURATION: {
    ENABLED: true,                     // Enable automatic fallback
    FALLBACK_THRESHOLD_MS: 15,         // Fall back to spatial if processing exceeds this
    MAX_CONSECUTIVE_FAILURES: 3,       // Max failures before fallback
    FALLBACK_RECOVERY_ATTEMPTS: 5,     // Attempts to recover from fallback
    FALLBACK_RECOVERY_DELAY: 2000,     // Delay between recovery attempts (ms)
    ENABLE_GRACEFUL_DEGRADATION: true, // Enable graceful performance degradation
    FALLBACK_TO_SPATIAL_METHOD: true,  // Fallback to spatial intersection method
  },

  // Performance Thresholds
  MAX_PROCESSING_TIME_MS: 10,          // Maximum time for edge processing (ms)
  MAX_ELEMENTS_PER_UPDATE: 50,         // Maximum elements to process per update
  FALLBACK_THRESHOLD_MS: 15,           // Fall back to spatial if processing exceeds this
  CACHE_HIT_RATIO_THRESHOLD: 0.7,     // Minimum acceptable cache hit ratio

  // Memory Management
  MAX_MEMORY_USAGE_MB: 50,             // Maximum memory usage for edge-only processing
  MEMORY_CHECK_INTERVAL: 5000,        // How often to check memory usage (ms)
  ENABLE_MEMORY_MONITORING: true,     // Monitor memory usage and cleanup
  GARBAGE_COLLECTION_THRESHOLD: 0.8,  // Trigger cleanup at 80% of memory limit

  // Processing Options
  INTERSECTION_OBSERVER_THRESHOLDS: [0, 0.1, 0.5, 1.0], // Multiple thresholds for granular updates
  BATCH_PROCESSING_SIZE: 10,           // Process elements in batches of this size
  ENABLE_ADAPTIVE_PROCESSING: true,    // Adjust processing based on page complexity
  FRAME_RATE_TARGET: 60,               // Target frame rate during drag operations

  // Adaptive Processing Settings (Task 2.1)
  PAGE_COMPLEXITY_ANALYSIS: {
    ENABLE_COMPLEXITY_ANALYSIS: false,   // Enable page complexity analysis
    ELEMENT_COUNT_THRESHOLD_LOW: 500,   // Low complexity threshold
    ELEMENT_COUNT_THRESHOLD_HIGH: 2000, // High complexity threshold
    DOM_DEPTH_THRESHOLD_LOW: 10,        // Low DOM depth threshold
    DOM_DEPTH_THRESHOLD_HIGH: 20,       // High DOM depth threshold
    TEXT_NODE_DENSITY_THRESHOLD: 0.3,   // Text node density threshold
    COMPLEXITY_CHECK_INTERVAL: 10000,   // How often to analyze page complexity (ms)
  },

  FRAME_RATE_PROCESSING: {
    TARGET_FPS: 60,                     // Target frame rate during drag operations
    FRAME_TIME_BUDGET_MS: 16.67,        // Time budget per frame (1000ms / 60fps)
    PROCESSING_TIME_BUDGET_MS: 8,       // Max processing time per frame
    FRAME_RATE_MONITORING_WINDOW: 10,   // Number of frames to monitor for rate calculation
    MIN_ACCEPTABLE_FPS: 30,             // Minimum acceptable frame rate
    FRAME_RATE_ADJUSTMENT_FACTOR: 0.8,  // Reduce processing when frame rate drops
  },

  BATCH_PROCESSING: {
    ENABLE_BATCH_PROCESSING: true,      // Enable batch processing optimization
    DEFAULT_BATCH_SIZE: 5,              // Default batch size for processing
    MAX_BATCH_SIZE: 20,                 // Maximum batch size
    MIN_BATCH_SIZE: 1,                  // Minimum batch size
    BATCH_TIMEOUT_MS: 4,                // Maximum time to wait for batch completion
    ADAPTIVE_BATCH_SIZING: true,        // Adjust batch size based on performance
  },

  QUALITY_ADJUSTMENTS: {
    ENABLE_QUALITY_ADJUSTMENTS: true,   // Enable quality adjustments based on available time
    HIGH_QUALITY_TIME_THRESHOLD: 5,     // Time threshold for high quality processing (ms)
    MEDIUM_QUALITY_TIME_THRESHOLD: 10,  // Time threshold for medium quality processing (ms)
    LOW_QUALITY_PROCESSING_LIMIT: 20,   // Maximum elements to process in low quality mode
    QUALITY_ADJUSTMENT_HYSTERESIS: 2,   // Frames to wait before quality adjustment
  },

  // Predictive Caching Settings (Task 2.2)
  PREDICTIVE_CACHING: {
    ENABLE_PREDICTIVE_CACHING: true,    // Enable predictive caching strategies
    ENABLE_USER_BEHAVIOR_ANALYSIS: true, // Analyze user behavior patterns
    ENABLE_VIEWPORT_BASED_CACHING: true, // Cache based on viewport position
    ENABLE_SCROLL_PREDICTION: true,     // Predict scroll direction and cache ahead

    // User behavior analysis
    BEHAVIOR_PATTERN_WINDOW: 20,        // Number of recent interactions to analyze
    INTERACTION_TIMEOUT_MS: 2000,       // Time between interactions to consider separate
    MIN_PATTERN_CONFIDENCE: 0.6,        // Minimum confidence to act on patterns
    PATTERN_ANALYSIS_INTERVAL: 5000,    // How often to analyze patterns (ms)

    // Viewport-based caching
    VIEWPORT_CACHE_MARGIN: 200,         // Pixels beyond viewport to cache
    VIEWPORT_CACHE_SECTORS: 9,          // Divide viewport into sectors for caching
    CACHE_WARMING_DISTANCE: 300,        // Distance ahead to warm cache (pixels)
    VIEWPORT_UPDATE_THROTTLE: 100,      // Throttle viewport updates (ms)

    // Scroll prediction
    SCROLL_VELOCITY_SAMPLES: 5,         // Number of scroll samples for velocity calculation
    SCROLL_PREDICTION_DISTANCE: 500,    // Distance to predict ahead (pixels)
    MIN_SCROLL_VELOCITY: 50,            // Minimum velocity to trigger prediction (px/s)
    SCROLL_DIRECTION_THRESHOLD: 10,     // Pixels to determine scroll direction

    // Cache preloading
    PRELOAD_BATCH_SIZE: 10,             // Elements to preload per batch
    PRELOAD_THROTTLE_MS: 50,            // Throttle between preload batches
    MAX_PRELOAD_ELEMENTS: 100,          // Maximum elements to preload
    PRELOAD_PRIORITY_THRESHOLD: 0.7,    // Confidence threshold for high priority preload
  },

  // Debug and Monitoring
  ENABLE_PERFORMANCE_LOGGING: false,    // Log detailed performance metrics
  ENABLE_CACHE_METRICS: false,          // Track cache hit/miss ratios
  ENABLE_MEMORY_LOGGING: false,        // Log memory usage (can be verbose)
  PERFORMANCE_LOG_INTERVAL: 5000,     // How often to log performance stats (ms)
};

// Performance monitoring removed

export const FEATURE_FLAGS = {
  // Rectangle Selection Method
  // Prefer caretRangeFromPoint (browser-native drag semantics). Edge-only IntersectionObserver
  // is off by default: a non-ancestor fixed root never reports intersections, so selection
  // stayed empty and completeSelection would not exit highlight mode.
  USE_INTELLIGENT_RECTANGLE_SELECTION: true, // Use browser-native caret selection instead of spatial intersection
  USE_NATIVE_SELECTION_API: true, // Use document.caretRangeFromPoint for efficient selection

  // Edge-Only Processing Control (experimental / heavy; off by default — see USE_EDGE_ONLY_SELECTION)
  ENABLE_EDGE_ONLY_PROCESSING: false,  // Use edge-only intersection processing
  EDGE_ONLY_FALLBACK_ENABLED: true,    // Allow fallback to spatial method if edge-only fails
  FORCE_EDGE_ONLY_MODE: false,         // Force edge-only processing even if performance degrades
  ENABLE_EDGE_ONLY_CACHE: true,        // Enable text node caching for edge-only processing

  // Enhanced RectangleIntersectionObserver Integration (Task 2)
  ENABLE_ENHANCED_RECTANGLE_OBSERVER: false, // Master flag for enhanced integration (Task 2.1, 2.2, 2.3)

  // Edge-Only Processing Feature Flags (Task 1.1)
  USE_EDGE_ONLY_SELECTION: false,        // Off: broken root/target relationship; use caret/spatial instead
  ENABLE_SMART_TARGETING: true,          // Enable smart element targeting
  ENABLE_CHARACTER_DETECTION: true,      // Enable edge-level character detection
  ENABLE_SELECTION_CACHING: true,        // Enable text node caching
  ENABLE_AUTOMATIC_FALLBACK: true,       // Auto-fallback on performance issues
  ENABLE_EDGE_BATCH_PROCESSING: true,    // Batch intersection updates
  ENABLE_PREDICTIVE_CACHING: false,      // Predictive caching off with edge-only stack
  DETAILED_EDGE_LOGGING: false,          // Detailed debug logging for edge processing (off for ship)
  EDGE_CACHE_SIZE_MANAGEMENT: true,      // Enable cache size management
  EDGE_ADAPTIVE_PROCESSING: true,        // Enable adaptive processing
  ENABLE_TEXT_ELEMENT_FILTER: true,      // Enable TextElementFilter class
  ENABLE_EDGE_CHARACTER_DETECTOR: true,  // Enable EdgeCharacterDetector class

  // Selection behavior options
  RECTANGLE_SELECTION_FALLBACK_TO_SPATIAL: true, // Fall back to spatial method if intelligent method fails
  RECTANGLE_SELECTION_SCAN_STEP: 8, // Pixel step size for boundary scanning (performance vs accuracy)
  RECTANGLE_SELECTION_MAX_SCAN_TIME: 50, // Maximum time in ms to spend scanning for boundaries

  // Clipboard options
  ENABLE_RICH_TEXT_CLIPBOARD: true, // Copy both plain text and HTML formatting to clipboard
  RICH_TEXT_FALLBACK_TO_PLAIN: true, // Fall back to plain text if rich text copying fails

  // UI feature flags
  SHOW_WINDOW_OUTLINE: false, // Show window outline during text mode

  // When true, KP_NEW_TAB opens pages/newtab.html. When false, opens Chrome's
  // default new tab (omit url → chrome://newtab). Custom NTP page stays in the
  // repo for later / Firefox; chrome_url_overrides is not declared in manifest.
  USE_CUSTOM_NEWTAB_PAGE: false,

  // Hover/click targeting strategy (product decision: DOM-hover only)
  // Permanent primary path: attach DOM hover listeners and drive `state.focusEl` from
  // browser-native hover targeting. RBush spatial indexing is retired (vendor removed;
  // residual index code is no-op / isolated). Activation (F) still falls back to
  // elementFromPoint if nothing is hovered.
  ENABLE_DOM_HOVER_LISTENERS: true,

  // Interactive element discovery (TreeWalker + MutationObserver + IntersectionObserver +
  // spatial culling) was built to feed RBush hit-testing. With DOM-hover as the primary
  // path it is unnecessary idle/main-thread work on every page. Keep false unless
  // re-enabling a spatial index / fixed-overlay hit-test backend.
  ENABLE_INTERACTIVE_DISCOVERY: false,

  // Wrap EventTarget.prototype.addEventListener to track click handlers for
  // non-semantic "JS-only" clickables. Costs a small tax on every listener
  // registration in the content-script world. Default on to preserve hover of
  // onclick-less delegated widgets; set false if profiling shows it matters.
  ENABLE_CLICK_LISTENER_TRACKING: true,

  // ---- Focus-ring paint (DOM-hover) ----
  // Preference order (see extension/reference-info/focus-ring-paint.md):
  //   A = DOM outline on the paint target (default; cheapest)
  //   B = in-target absolute ring (local max z-index + 1) when A cannot show
  //   C = body fixed overlay when B cannot mount (replaced elements, etc.)
  //
  // ENABLE_FOCUS_CLIP_INSET: while still on A, grade outline-offset from
  //   clip-ancestor free room: offset = clamp(minRoom - stroke, -stroke, +2).
  //   Mild bleed → mild inset (e.g. 1px room, 3px stroke → -2), not a jump
  //   to B/C. Does not mutate page overflow (that broke IMDb carousels).
  //
  // ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION: paint on a same-size clip ancestor
  //   instead of the target. Default OFF: on IMDb this promotes off
  //   <a.ipc-lockup-overlay> onto .ipc-poster so the real clickable never shows
  //   data-kp-focus.
  //
  // ENABLE_IN_TARGET_FOCUS_RING: allow strategy B when A cannot show a ring —
  //   inject position:absolute ring as last child of host (z-index maxLocal+1,
  //   border-radius from host). Falls back to strategy C if the host cannot
  //   accept children (replaced elements, etc.).
  ENABLE_FOCUS_CLIP_INSET: true,
  ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION: false,
  ENABLE_IN_TARGET_FOCUS_RING: true,

  // Debug and development flags
  DEBUG_RECTANGLE_SELECTION: false, // Enable detailed logging for rectangle selection
  DEBUG_EDGE_ONLY_PROCESSING: false, // Enable detailed logging for edge-only processing
  SHOW_SELECTION_METHOD_IN_UI: false, // Show which selection method was used in notifications
  DEBUG_RECTANGLE_HUD: false, // Show live rectangle debugging HUD with coordinates and calls
  ENABLE_DEBUG_PANEL: false, // Enable upper-right debug panel showing performance metrics
  // Interactive HUD for shadow-DOM hover paint (msn.com / archive.org).
  // Shows leaf under pointer, resolved hover/paint targets, auto A/B/C choice,
  // and lets you force A / B / C. Toggle: Alt+/ (or keyPilot.setShadowRootDebugHud).
  DEBUG_SHADOW_ROOT_HUD: false
};