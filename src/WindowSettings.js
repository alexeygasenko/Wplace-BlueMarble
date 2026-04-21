import Overlay, { minimizeIconExpanded } from "./Overlay";

const closeIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

/** The overlay builder for the settings window in Blue Marble.
 * The logic for this window is managed in {@link SettingsManager}
 * @description This class handles the overlay UI for the settings window of the Blue Marble userscript.
 * @class WindowSettings
 * @since 0.91.11
 * @see {@link Overlay} for examples
 */
export default class WindowSettings extends Overlay {

  /** Constructor for the Settings window
   * @param {string} name - The name of the userscript
   * @param {string} version - The version of the userscript
   * @since 0.91.11
   * @see {@link Overlay#constructor} for examples
   */
  constructor(name, version) {
    super(name, version); // Executes the code in the Overlay constructor
    this.window = null; // Contains the *window* DOM tree
    this.windowID = 'bm-window-settings'; // The ID attribute for this window
    this.windowParent = document.body; // The parent of the window DOM tree
    this.windowStateKey = 'windowSettings'; // User setting key for the persisted window position
  }

  /** Spawns a Settings window.
   * If another settings window already exists, we DON'T spawn another!
   * Parent/child relationships in the DOM structure below are indicated by indentation.
   * @since 0.91.11
   */
  buildWindow() {

    // If a settings window already exists, close it
    if (document.querySelector(`#${this.windowID}`)) {
      this.#closeWindow();
      return;
    }

    this.window = this.addDiv({'id': this.windowID, 'class': 'bm-window'})
      .addDragbar()
        .addButton({'class': 'bm-button-circle', 'innerHTML': minimizeIconExpanded, 'aria-label': 'Minimize window "Settings"', 'data-button-status': 'expanded'}, (instance, button) => {
          button.onclick = () => instance.handleMinimization(button);
          button.ontouchend = () => {button.click()}; // Needed only to negate weird interaction with dragbar
        }).buildElement()
        .addDiv().buildElement() // Contains the minimized h1 element
        .addDiv({'class': 'bm-flex-center'})
          .addButton({'class': 'bm-button-circle', 'innerHTML': closeIcon, 'aria-label': 'Close window "Settings"'}, (instance, button) => {
            button.onclick = () => this.#closeWindow();
            button.ontouchend = () => {button.click();}; // Needed only to negate weird interaction with dragbar
          }).buildElement()
        .buildElement()
      .buildElement()
      .addDiv({'class': 'bm-window-content'})
        .addDiv({'class': 'bm-container bm-center-vertically'})
          .addHeader(1, {'textContent': 'Settings'}).buildElement()
        .buildElement()
        .addHr().buildElement()
        .addP({'textContent': 'Settings take 5 seconds to save.'}).buildElement()
        .addDiv({'class': 'bm-container bm-scrollable'}, (instance, div) => {
          // Each category in the settings window
          this.buildHighlight();
          this.buildTemplate();
        }).buildElement()
      .buildElement()
    .buildElement().buildOverlay(this.windowParent);

    this.#initializeWindowPositionPersistence();
  }

  /** Retrieves the persisted settings window state object.
   * @returns {Object | null}
   * @since 0.95.0
   */
  #getWindowState() {
    if (!this.userSettings) {return null;}
    this.userSettings[this.windowStateKey] ??= {};
    return this.userSettings[this.windowStateKey];
  }

  /** Immediately closes the settings window and saves its position.
   * @since 0.95.0
   */
  #closeWindow() {
    const windowElement = document.querySelector(`#${this.windowID}`);
    this.#saveWindowPosition(windowElement);
    windowElement?.remove();
  }

  /** Returns a viewport-safe position for the settings window.
   * @param {HTMLElement} windowElement
   * @param {number} x
   * @param {number} y
   * @returns {{x: number, y: number}}
   * @since 0.95.0
   */
  #clampWindowPosition(windowElement, x, y) {
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - windowElement.offsetWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - windowElement.offsetHeight - margin);
    return {
      x: Math.min(Math.max(Math.round(Number(x) || margin), margin), maxX),
      y: Math.min(Math.max(Math.round(Number(y) || margin), margin), maxY)
    };
  }

  /** Restores the persisted position for the settings window.
   * @param {HTMLElement} windowElement
   * @since 0.95.0
   */
  #restoreWindowPosition(windowElement) {
    const windowState = this.#getWindowState();
    if (!windowState || !windowElement) {return;}

    requestAnimationFrame(() => {
      if (!windowElement.isConnected) {return;}

      const x = Number(windowState.x);
      const y = Number(windowState.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {return;}

      const clampedPosition = this.#clampWindowPosition(windowElement, x, y);
      windowElement.style.left = '0px';
      windowElement.style.top = '0px';
      windowElement.style.right = '';
      windowElement.style.transform = `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`;

      if ((clampedPosition.x != x) || (clampedPosition.y != y)) {
        windowState.x = clampedPosition.x;
        windowState.y = clampedPosition.y;
        void this.saveUserStorageNow?.();
      }
    });
  }

  /** Saves the current position of the settings window.
   * @param {HTMLElement} windowElement
   * @since 0.95.0
   */
  #saveWindowPosition(windowElement) {
    const windowState = this.#getWindowState();
    if (!windowState || !windowElement?.isConnected) {return;}

    const rect = windowElement.getBoundingClientRect();
    const clampedPosition = this.#clampWindowPosition(windowElement, rect.left, rect.top);
    windowElement.style.left = '0px';
    windowElement.style.top = '0px';
    windowElement.style.right = '';
    windowElement.style.transform = `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`;

    windowState.x = clampedPosition.x;
    windowState.y = clampedPosition.y;

    void this.saveUserStorageNow?.();
  }

  /** Enables position persistence for the settings window.
   * @since 0.95.0
   */
  #initializeWindowPositionPersistence() {
    const windowElement = document.querySelector(`#${this.windowID}.bm-window`);
    if (!windowElement) {return;}

    this.#restoreWindowPosition(windowElement);

    this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`, {
      onEnd: ({element}) => this.#saveWindowPosition(element)
    });
  }

  /** Displays an error when a settings category fails to load.
   * @param {string} name - The name of the category
   * @since 0.91.11
   */
  #errorOverrideFailure(name) {
    this.window = this.addDiv({'class': 'bm-container'})
      .addHeader(2, {'textContent': name}).buildElement()
      .addHr().buildElement()
      .addP({'innerHTML': `An error occured loading the ${name} category. <code>SettingsManager</code> failed to override the ${name} function inside <code>WindowSettings</code>.`}).buildElement()
    .buildElement();
  }

  /** Builds the highlight section of the window.
   * This should be overriden by {@link SettingsManager}
   * @since 0.91.11
   */
  buildHighlight() {
    this.#errorOverrideFailure('Pixel Highlight');
  }

  /** Builds the template section of the window.
   * This should be overriden by {@link SettingsManager}
   * @since 0.91.68
   */
  buildTemplate() {
    this.#errorOverrideFailure('Template');
  }
}
