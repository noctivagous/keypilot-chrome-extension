/**
 * Application constants and configuration
 */
export const KEYBINDINGS = {
  ACTIVATE: {
    keys: ['f', 'F'],
    handler: 'handleActivateKey',
    label: 'Click Element',
    description: 'Click Element',
    keyLabel: 'F',
    keyboardClass: 'key-activate',
    row: 2,
    displayKey: 'F'
  },
  ACTIVATE_NEW_TAB: {
    keys: ['g', 'G'],
    handler: 'handleActivateNewTabOverKey',
    label: 'Click Tab Over',
    description: 'Open Link in New Tab (Background, like middle click)',
    keyLabel: 'G',
    keyboardClass: 'key-activate-new-over',
    row: 2,
    displayKey: 'G'
  },
  ACTIVATE_NEW_TAB_OVER: {
    keys: ['b', 'B'],
    handler: 'handleActivateNewTabKey',
    label: 'Click New Tab',
    description: 'Click New Tab',
    keyLabel: 'B',
    keyboardClass: 'key-activate-new',
    row: 2,
    displayKey: 'B'
  },
  BACK: {
    keys: ['d', 'D'],
    handler: 'handleBackKey',
    label: 'Go Back',
    description: 'Go Back (History)',
    keyLabel: 'D',
    keyboardClass: 'key-back',
    row: 2,
    displayKey: 'D'
  },
  BACK2: {
    keys: ['s', 'S'],
    handler: 'handleBackKey',
    label: 'Go Back',
    description: 'Go Back (History)',
    keyLabel: 'S',
    keyboardClass: 'key-back',
    row: 2,
    displayKey: 'S'
  },
  FORWARD: {
    keys: ['r', 'R'],
    handler: 'handleForwardKey',
    label: 'Go Forward',
    description: 'Go Forward (History)',
    keyLabel: 'R',
    keyboardClass: 'key-forward',
    row: 1,
    displayKey: 'R'
  },
  DELETE: {
    keys: ['Backspace'],
    handler: 'handleDeleteKey',
    label: 'Delete Mode',
    description: 'Delete Mode',
    keyLabel: 'Backspace',
    keyboardClass: 'key-delete',
    row: 2,
    displayKey: 'Backspace'
  },
  /*
  HIGHLIGHT: {
    keys: ['h', 'H'],
    handler: 'handleHighlightKey',
    label: 'Highlight',
    description: 'Select Text Mode (Character)',
    keyLabel: 'H',
    keyboardClass: 'key-highlight',
    row: 2,
    displayKey: 'H'
  },*/
  /*
  RECTANGLE_HIGHLIGHT: {
    keys: ['y', 'Y'],
    handler: 'handleRectangleHighlightKey',
    label: 'Rect Highlight',
    description: 'Select Text Mode (Rectangle)',
    keyLabel: 'Y',
    keyboardClass: 'key-rect-highlight',
    row: 1,
    displayKey: 'Y'
  },*/
  TAB_LEFT: {
    keys: ['q', 'Q'],
    handler: 'handleTabLeftKey',
    label: 'Tab Left',
    description: 'Move To Previous Tab',
    keyLabel: 'Q',
    keyboardClass: 'key-gray',
    row: 1,
    displayKey: 'Q'
  },
  TAB_RIGHT: {
    keys: ['w', 'W'],
    handler: 'handleTabRightKey',
    label: 'Tab Right',
    description: 'Move To Next Tab',
    keyLabel: 'W',
    keyboardClass: 'key-gray',
    row: 1,
    displayKey: 'W'
  },
  ROOT: {
    keys: ['`', 'Backquote'],
    matchOn: ['key', 'code'],
    handler: 'handleRootKey',
    label: 'Go to Site Root',
    description: 'Go to Site Root',
    keyLabel: '`',
    keyboardClass: null,
    row: null,
    displayKey: '`'
  },
  CLOSE_TAB: {
    keys: ['a', 'A'],
    handler: 'handleCloseTabKey',
    label: 'Close Tab',
    description: 'Close Tab',
    keyLabel: 'A',
    keyboardClass: 'key-close-tab',
    row: 3,
    displayKey: 'A'
  },
  CANCEL: {
    keys: ['Escape'],
    handler: 'cancelModes',
    label: 'Exit Focus',
    description: 'Exit Focus',
    keyLabel: 'Esc',
    keyboardClass: null,
    row: null,
    displayKey: 'Esc'
  },
  PAGE_UP_INSTANT: {
    keys: ['c', 'C'],
    handler: 'handleInstantPageUp',
    label: 'Page Up Fast',
    description: 'Page Up (Instant)',
    keyLabel: 'C',
    keyboardClass: 'key-scroll',
    row: 3,
    displayKey: 'C'
  },
  PAGE_DOWN_INSTANT: {
    keys: ['v', 'V'],
    handler: 'handleInstantPageDown',
    label: 'Page Down Fast',
    description: 'Page Down (Instant)',
    keyLabel: 'V',
    keyboardClass: 'key-scroll',
    row: 3,
    displayKey: 'V'
  },
  PAGE_TOP: {
    keys: ['z', 'Z'],
    handler: 'handlePageTop',
    label: 'Scroll To Top',
    description: 'Scroll to Top',
    keyLabel: 'Z',
    keyboardClass: 'key-scroll',
    row: 3,
    displayKey: 'Z'
  },
  PAGE_BOTTOM: {
    keys: ['x', 'X'],
    handler: 'handlePageBottom',
    label: 'Scroll To Bottom',
    description: 'Scroll to Bottom',
    keyLabel: 'X',
    keyboardClass: 'key-scroll',
    row: 3,
    displayKey: 'X'
  },
  NEW_TAB: {
    keys: ['t', 'T'],
    handler: 'handleNewTabKey',
    label: 'New Tab',
    description: 'Open New Tab',
    keyLabel: 'T',
    keyboardClass: 'key-gray',
    row: 1,
    displayKey: 'T'
  },
  OPEN_POPOVER: {
    keys: ['e', 'E'],
    handler: 'handleOpenPopover',
    label: 'Open Popover',
    description: 'Open Link in Popover',
    keyLabel: 'E',
    keyboardClass: 'key-open-popover',
    row: 2,
    displayKey: 'E'
  },
  OPEN_SETTINGS_POPOVER: {
    keys: ["'", 'Quote'],
    matchOn: ['key', 'code'],
    handler: 'handleToggleSettingsPopover',
    label: 'Settings',
    description: 'Open KeyPilot Settings',
    keyLabel: "'",
    keyboardClass: null,
    row: null,
    displayKey: "'"
  },
  OMNIBOX: {
    keys: ['l', 'L'],
    handler: 'handleOpenOmnibox',
    label: 'Omnibox',
    description: 'Open Omnibox (Address Bar Overlay)',
    keyLabel: 'L',
    keyboardClass: 'key-orange',
    row: 2,
    displayKey: 'L'
  },
  TAB_HISTORY: {
    keys: ['j', 'J'],
    handler: 'handleToggleTabHistoryPopover',
    label: 'Tab History',
    description: 'Open Tab History (Branch-Retaining)',
    keyLabel: 'J',
    keyboardClass: 'key-gray',
    row: 2,
    displayKey: 'J'
  },
  TOGGLE_KEYBOARD_HELP: {
    keys: ['k', 'K'],
    handler: 'handleToggleKeyboardHelp',
    label: 'KB Reference',
    description: 'Show/Hide the floating KeyPilot keyboard reference',
    keyLabel: 'K',
    keyboardClass: 'key-purple',
    row: 2,
    displayKey: 'K'
  }
};

export const SELECTORS = {
  CLICKABLE: 'a[href], button, input, select, textarea',
  TEXT_INPUTS: 'input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"], textarea',
  FOCUSABLE_TEXT: 'input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"], textarea, [contenteditable="true"]'
};

export const ARIA_ROLES = {
  CLICKABLE: ['link', 'button']
};

export const CSS_CLASSES = {
  CURSOR_HIDDEN: 'kpv2-cursor-hidden',
  FOCUS: 'kpv2-focus',
  DELETE: 'kpv2-delete',
  HIGHLIGHT: 'kpv2-highlight',
  HIDDEN: 'kpv2-hidden',
  RIPPLE: 'kpv2-ripple',
  FOCUS_OVERLAY: 'kpv2-focus-overlay',
  DELETE_OVERLAY: 'kpv2-delete-overlay',
  HIGHLIGHT_OVERLAY: 'kpv2-highlight-overlay',
  HIGHLIGHT_SELECTION: 'kpv2-highlight-selection',
  TEXT_FIELD_GLOW: 'kpv2-text-field-glow',
  VIEWPORT_MODAL_FRAME: 'kpv2-viewport-modal-frame',
  ACTIVE_TEXT_INPUT_FRAME: 'kpv2-active-text-input-frame',
  ESC_EXIT_LABEL: 'kpv2-esc-exit-label',

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

  // Floating keyboard reference + its key-click tooltip popover
  FLOATING_KEYBOARD_HELP: 1000000,
  KEYBINDINGS_POPOVER: 1000010,

  // Iframe-based popover modal (Open Popover)
  POPOVER_IFRAME_MODAL: 2147483035,

  // Notifications / message overlays
  MESSAGE_BOX: 2147483040,
  DEBUG_HUD: 2147483041,
  NOTIFICATION: 2147483040,

  // Omnibox overlay (should sit above most UI, but below the cursor)
  OMNIBOX: 2147483042,

  // Onboarding walkthrough panel (top-left)
  // Keep BELOW the green hover/click overlays so rectangles + countdown label stay visible.
  ONBOARDING_PANEL: 2147483017,

  // Cursor should remain above everything else.
  CURSOR: 2147483050
};

export const MODES = {
  NONE: 'none',
  DELETE: 'delete',
  TEXT_FOCUS: 'text_focus',
  HIGHLIGHT: 'highlight',
  POPOVER: 'popover',
  OMNIBOX: 'omnibox'
};

// Cursor behavior mode:
// - NO_CUSTOM_CURSORS: KeyPilot does not override the page cursor at all.
// - CUSTOM_CURSORS: KeyPilot applies its cursor styling/overrides (current legacy behavior).
export const CURSOR_MODE = Object.freeze({
  NO_CUSTOM_CURSORS: 'NO-CUSTOM-CURSORS',
  CUSTOM_CURSORS: 'CUSTOM-CURSORS'
});

export const COLORS = {
  // Primary cursor colors
  FOCUS_GREEN: 'rgba(0,180,0,0.95)',
  FOCUS_GREEN_BRIGHT: 'rgba(0,128,0,0.95)',
  DELETE_RED: 'rgba(220,0,0,0.95)',
  HIGHLIGHT_BLUE: 'rgba(0,120,255,0.95)',
  ORANGE: '#ff8c00',

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
  DELETE_SHADOW: 'rgba(220,0,0,0.35)',
  DELETE_SHADOW_BRIGHT: 'rgba(220,0,0,0.45)',
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
  FOCUS_GREEN: '#27ae60'
};

export const CURSOR_SETTINGS = {
  DEFAULT_SIZE: 1.0,
  MIN_SIZE: 0.5,
  MAX_SIZE: 2.0,
  SIZE_STEP: 0.1,
  DEFAULT_VISIBLE: true,
  STORAGE_KEYS: {
    SIZE: 'keypilot_cursor_size',
    VISIBLE: 'keypilot_cursor_visible'
  }
};

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
  USE_INTELLIGENT_RECTANGLE_SELECTION: true, // Use browser-native selection logic instead of spatial intersection
  USE_NATIVE_SELECTION_API: true, // Use document.caretRangeFromPoint for efficient selection

  // Edge-Only Processing Control
  ENABLE_EDGE_ONLY_PROCESSING: true,   // Use edge-only intersection processing
  EDGE_ONLY_FALLBACK_ENABLED: true,    // Allow fallback to spatial method if edge-only fails
  FORCE_EDGE_ONLY_MODE: false,         // Force edge-only processing even if performance degrades
  ENABLE_EDGE_ONLY_CACHE: true,        // Enable text node caching for edge-only processing

  // Enhanced RectangleIntersectionObserver Integration (Task 2)
  ENABLE_ENHANCED_RECTANGLE_OBSERVER: true, // Master flag for enhanced integration (Task 2.1, 2.2, 2.3)

  // Edge-Only Processing Feature Flags (Task 1.1)
  USE_EDGE_ONLY_SELECTION: true,         // Enable edge-only processing
  ENABLE_SMART_TARGETING: true,          // Enable smart element targeting
  ENABLE_CHARACTER_DETECTION: true,      // Enable edge-level character detection
  ENABLE_SELECTION_CACHING: true,        // Enable text node caching
  ENABLE_AUTOMATIC_FALLBACK: true,       // Auto-fallback on performance issues
  ENABLE_EDGE_BATCH_PROCESSING: true,    // Batch intersection updates
  ENABLE_PREDICTIVE_CACHING: true,       // Enable predictive caching
  DETAILED_EDGE_LOGGING: true,           // Detailed debug logging for edge processing
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

  // Debug and development flags
  DEBUG_RECTANGLE_SELECTION: false, // Enable detailed logging for rectangle selection
  DEBUG_EDGE_ONLY_PROCESSING: false, // Enable detailed logging for edge-only processing
  SHOW_SELECTION_METHOD_IN_UI: false, // Show which selection method was used in notifications
  DEBUG_RECTANGLE_HUD: false, // Show live rectangle debugging HUD with coordinates and calls
  ENABLE_DEBUG_PANEL: false // Enable upper-right debug panel showing performance metrics
};