/**
 * Application state management
 */
import { MODES } from '../config/constants.js';

export class StateManager {
  constructor() {
    this.state = {
      mode: MODES.NONE,
      lastMouse: { x: 0, y: 0 },
      focusEl: null,
      /**
       * Shared inspector hover target (Delete, Cols, future pick tools).
       * Only meaningful while mode === MODES.INSPECTOR.
       */
      inspectorEl: null,
      /** @type {string|null} INSPECTOR_KIND value while in inspector mode */
      inspectorKind: null,
      highlightEl: null,
      highlightStartPosition: null,
      currentSelection: null,
      isInitialized: false,
      popoverOpen: false,
      popoverUrl: null
    };
    
    this.subscribers = new Set();
  }

  getState() {
    return { ...this.state };
  }

  setState(updates) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify subscribers of state changes
    this.notifySubscribers(prevState, this.state);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers(prevState, newState) {
    for (const callback of this.subscribers) {
      try {
        callback(newState, prevState);
      } catch (error) {
        console.error('State subscriber error:', error);
      }
    }
  }

  // Convenience methods
  setMode(mode) {
    this.setState({ mode });
  }

  setMousePosition(x, y) {
    this.setState({ lastMouse: { x, y } });
  }

  setFocusElement(element) {
    this.setState({ focusEl: element });
  }

  setInspectorElement(element) {
    this.setState({ inspectorEl: element });
  }

  /**
   * Enter shared inspector pick mode for a tool kind.
   * @param {string} kind INSPECTOR_KIND value
   */
  enterInspector(kind) {
    this.setState({
      mode: MODES.INSPECTOR,
      inspectorKind: kind || null,
      inspectorEl: null,
      // Clear normal focus hover so green click chrome doesn't fight inspector outline
      focusEl: null
    });
  }

  /**
   * Exit inspector pick mode without clearing sticky page effects.
   */
  exitInspector() {
    this.setState({
      mode: MODES.NONE,
      inspectorKind: null,
      inspectorEl: null
    });
  }

  setHighlightElement(element) {
    this.setState({ highlightEl: element });
  }

  setHighlightStartPosition(position) {
    this.setState({ highlightStartPosition: position });
  }

  setCurrentSelection(selection) {
    this.setState({ currentSelection: selection });
  }

  setPopoverOpen(isOpen, url = null) {
    if (isOpen) {
      this.setState({ 
        mode: MODES.POPOVER,  // Set mode when opening
        // Popovers are modal: stop tracking/clicking background page elements.
        // Clearing focus/inspector immediately also hides hover chrome until the
        // user moves the mouse over popover UI.
        focusEl: null,
        inspectorEl: null,
        inspectorKind: null,
        popoverOpen: isOpen, 
        popoverUrl: url 
      });
    } else {
      this.setState({ 
        mode: MODES.NONE,  // Reset mode when closing
        popoverOpen: false, 
        popoverUrl: null 
      });
    }
  }

  clearElements() {
    this.setState({ 
      focusEl: null, 
      inspectorEl: null,
      highlightEl: null,
      highlightStartPosition: null,
      currentSelection: null
    });
  }

  isInspectorMode() {
    return this.state.mode === MODES.INSPECTOR;
  }

  /**
   * @param {string} kind
   * @returns {boolean}
   */
  isInspectorKind(kind) {
    return this.state.mode === MODES.INSPECTOR && this.state.inspectorKind === kind;
  }

  /** @deprecated prefer isInspectorKind(INSPECTOR_KIND.DELETE) */
  isDeleteMode() {
    return this.isInspectorKind('delete') || this.state.mode === MODES.DELETE;
  }

  /** @deprecated prefer isInspectorKind(INSPECTOR_KIND.COLS) */
  isColsMode() {
    return this.isInspectorKind('cols') || this.state.mode === MODES.COLS;
  }

  isHighlightMode() {
    return this.state.mode === MODES.HIGHLIGHT;
  }

  isTextFocusMode() {
    return this.state.mode === MODES.TEXT_FOCUS;
  }

  isPopoverMode() {
    return this.state.mode === MODES.POPOVER;
  }

  reset() {
    this.setState({
      mode: MODES.NONE,
      focusEl: null,
      inspectorEl: null,
      inspectorKind: null,
      highlightEl: null,
      highlightStartPosition: null,
      currentSelection: null,
      popoverOpen: false,
      popoverUrl: null
    });
  }
}
