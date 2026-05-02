import ConfettiManager from "./confetttiManager";
import Overlay, { minimizeIconExpanded } from "./Overlay";
import { calculateRelativeLuminance, localizeNumber, localizePercent } from "./utils";

const closeIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const fullscreenIcon = '<svg class="bm-button-icon bm-button-icon-fullscreen" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4.5H4.5V8M16 4.5h3.5V8M19.5 16v3.5H16M8 19.5H4.5V16"/><path d="M4.8 4.8l5.1 5.1M19.2 4.8l-5.1 5.1M19.2 19.2l-5.1-5.1M4.8 19.2l5.1-5.1"/></g></svg>';
const windowedIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.8 4.8l5.2 5.2M19.2 4.8L14 10M19.2 19.2L14 14M4.8 19.2L10 14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M10 7.5V10H7.5M16.5 10H14V7.5M14 16.5V14h2.5M7.5 14H10v2.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const horizontalLayoutIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7.5h15M4.5 16.5h15"/><path d="M7.5 5v5M12 5v5M16.5 5v5M7.5 14v5M12 14v5M16.5 14v5"/></g></svg>';
const verticalLayoutIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4.5v15M16 4.5v15"/><path d="M5.5 7.5h5M5.5 12h5M5.5 16.5h5M13.5 7.5h5M13.5 12h5M13.5 16.5h5"/></g></svg>';
const incorrectHighlightIcon = '<svg class="bm-filter-highlight-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6.4"/><path d="M12 3.8V7M12 17v3.2M3.8 12H7M17 12h3.2"/><path d="m9.3 9.3 5.4 5.4M14.7 9.3l-5.4 5.4"/></g></svg>';

function localizeCompactDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} ${hour}:${minute}`;
}

/** The overlay builder for the color filter Blue Marble window.
 * @description This class handles the overlay UI for the color filter window of the Blue Marble userscript.
 * @class WindowFilter
 * @since 0.88.329
 * @see {@link Overlay} for examples
 */
export default class WindowFilter extends Overlay {

  /** Constructor for the color filter window
   * @param {*} executor - The executing class
   * @since 0.88.329
   * @see {@link Overlay#constructor}
   */
  constructor(executor) {
    super(executor.name, executor.version); // Executes the code in the Overlay constructor
    this.window = null; // Contains the *window* DOM tree
    this.windowID = 'bm-window-filter'; // The ID attribute for this window
    this.colorListID = 'bm-filter-flex'; // The ID attribute for the color list
    this.windowParent = document.body; // The parent of the window DOM tree
    this.settingsManager = executor.settingsManager ?? null; // Settings manager from the executor
    this.windowModeFlag = 'ftr-oWin'; // User setting flag for opening the filter in windowed mode
    this.windowStateKey = 'windowFilter'; // User setting key for the persisted window state
    this.windowResizeObserver = null; // Resize observer for the windowed mode
    this.windowViewportResizeHandler = null; // Resize handler for viewport changes
    this.windowHorizontalWheelHandler = null; // Wheel handler for horizontal color layout scrolling
    this.windowHorizontalWheelElement = null; // Scrollable element using the horizontal wheel handler
    this.windowSaveTimeout = null; // Debounce timer for resize persistence
    this.sortDropdownPointerHandler = null; // Outside-click handler for custom sort dropdowns
    this.sortDropdownKeyHandler = null; // Keyboard handler for custom sort dropdowns
    this.colorRefreshInterval = null; // Auto-refresh timer for live color statistics
    this.colorRefreshIntervalMS = 10000; // Refresh Color Filter statistics every 10 seconds
    this.windowMinWidth = 360; // Minimum width for the windowed filter
    this.windowMinHeight = 220; // Minimum height for the windowed filter
    this.windowHorizontalHeight = 170; // Fixed height for the horizontal windowed filter
    this.windowMaxWidth = 1000; // Maximum width for the windowed filter
    this.windowMaxHeight = 1400; // Maximum height for the windowed filter

    /** The templateManager instance currently being used. @type {TemplateManager} */
    this.templateManager = executor.apiManager?.templateManager;

    // Eye icons
    this.eyeOpen = '<svg class="bm-filter-eye-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.8 12s3.1-5 8.2-5 8.2 5 8.2 5-3.1 5-8.2 5-8.2-5-8.2-5Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
    this.eyeClosed = '<svg class="bm-filter-eye-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.6 9.8C6.1 8.3 8.6 7 12 7c5.1 0 8.2 5 8.2 5a15.2 15.2 0 0 1-2.2 2.7"/><path d="M14.1 16.7a8.3 8.3 0 0 1-2.1.3c-5.1 0-8.2-5-8.2-5a14.9 14.9 0 0 1 1.8-2.3"/><path d="M5 5l14 14"/><path d="M10.4 10.7a2.5 2.5 0 0 0 2.9 2.9"/></svg>';

    // Obtains the color palette Blue Marble currently uses
    const { palette: palette, LUT: _ } = this.templateManager.paletteBM;
    this.palette = palette;

    // Tile quantity information
    this.tilesLoadedTotal = 0; // Number of tiles that have been loaded in this session
    this.tilesTotal = 0; // Number of tiles total, across all templates

    // Pixel statistics
    this.allPixelsColor = new Map(); // The amount of pixels total per color as a Map
    this.allPixelsCorrect = new Map(); // The amount of correct pixels per color as a Map
    this.allPixelsCorrectTotal = 0; // Sums the pixels placed as "correct" per everything
    this.allPixelsTotal = 0; // Sums the pixels placed as "total" per everything
    this.timeRemaining = 0; // Calculates the date & time the user will complete the templates
    this.timeRemainingLocalized = ''; // The date & time the user will complete the templates in the date-time format of the user's device, as a string

    // Color list display settings
    this.sortPrimary = 'total'; // The last used primary sort option
    this.sortSecondary = 'descending'; // The last used secondary sort option
    this.showUnused = false; // Were unused colors shown the last time the user sorted the color list?
  }

  /** Builds the preferred filter window mode for the user.
   * @since 0.92.0
   */
  buildPreferredWindow() {
    if (this.#prefersWindowedMode()) {
      this.buildWindowed();
      return;
    }
    this.buildWindow();
  }

  /** Spawns a Color Filter window.
   * If another color filter window already exists, we DON'T spawn another!
   * Parent/child relationships in the DOM structure below are indicated by indentation.
   * @since 0.88.149
   */
  buildWindow() {

    // If a color filter wizard window already exists, close it
    if (document.querySelector(`#${this.windowID}`)) {
      this.#closeWindow();
      return;
    }
    
    // Creates a new color filter window
    this.window = this.addDiv({'id': this.windowID, 'class': 'bm-window'}, (instance, div) => {
      // div.onclick = (event) => {
      //   if (event.target.closest('button, a, input, select')) {return;} // Exit-early if interactive child was clicked
      //   div.parentElement.appendChild(div); // When the window is clicked on, bring to top
      // }
    }).addDragbar()
        .addButton({'class': 'bm-button-circle', 'innerHTML': minimizeIconExpanded, 'title': 'Minimize window "Color Filter"', 'aria-label': 'Minimize window "Color Filter"', 'data-button-status': 'expanded'}, (instance, button) => {
          button.onclick = () => instance.handleMinimization(button);
          button.ontouchend = () => {button.click()}; // Needed only to negate weird interaction with dragbar
        }).buildElement()
        .addDiv({'class': 'bm-filter-drag-title-slot'})
          .addHeader(1, {'class': 'bm-dragbar-title-persistent bm-filter-drag-title', 'textContent': 'Color Filter'}).buildElement()
        .buildElement()
        .addDiv({'class': 'bm-flex-center'})
          .addButton({'class': 'bm-button-circle', 'innerHTML': windowedIcon, 'title': 'Switch to windowed mode for "Color Filter"', 'aria-label': 'Switch to windowed mode for "Color Filter"'}, (instance, button) => {
            button.onclick = () => {
              this.#setWindowModePreference(true);
              this.#closeWindow(true);
              this.buildWindowed();
            };
            button.ontouchend = () => {button.click();}; // Needed only to negate weird interaction with dragbar
          }).buildElement()
          .addButton({'class': 'bm-button-circle', 'innerHTML': closeIcon, 'title': 'Close window "Color Filter"', 'aria-label': 'Close window "Color Filter"'}, (instance, button) => {
            button.onclick = () => this.#closeWindow();
            button.ontouchend = () => {button.click();}; // Needed only to negate weird interaction with dragbar
          }).buildElement()
        .buildElement()
      .buildElement()
      .addDiv({'class': 'bm-window-content'})
        .addHr({'class': 'bm-window-divider-top'}).buildElement()
        .addDiv({'class': 'bm-container bm-flex-between bm-center-vertically bm-filter-toolbar', 'style': 'gap: 1.5ch;'})
          .addButton({'class': 'bm-button-secondary', 'textContent': 'Hide All Colors'}, (instance, button) => {
            button.onclick = () => this.#selectColorList(false);
          }).buildElement()
          .addButton({'class': 'bm-button-secondary', 'textContent': 'Show All Colors'}, (instance, button) => {
            button.onclick = () => this.#selectColorList(true);
          }).buildElement()
        .buildElement()
        .addHr().buildElement()
        .addDiv({'class': 'bm-container bm-scrollable bm-filter-scrollable'})
          .addDiv({'class': 'bm-container bm-filter-insights'})
            .addDiv({'class': 'bm-filter-stat-grid'})
              .addDiv({'class': 'bm-filter-stat-card'})
                .addSpan({'class': 'bm-filter-stat-label', 'textContent': 'Tiles'}).buildElement()
                .addSpan({'id': 'bm-filter-tile-load', 'class': 'bm-filter-stat-value', 'textContent': '0 / ???'}).buildElement()
              .buildElement()
              .addDiv({'class': 'bm-filter-stat-card'})
                .addSpan({'class': 'bm-filter-stat-label', 'textContent': 'Correct'}).buildElement()
                .addSpan({'id': 'bm-filter-tot-correct', 'class': 'bm-filter-stat-value', 'textContent': '???'}).buildElement()
              .buildElement()
              .addDiv({'class': 'bm-filter-stat-card'})
                .addSpan({'class': 'bm-filter-stat-label', 'textContent': 'Total'}).buildElement()
                .addSpan({'id': 'bm-filter-tot-total', 'class': 'bm-filter-stat-value', 'textContent': '???'}).buildElement()
              .buildElement()
              .addDiv({'class': 'bm-filter-stat-card'})
                .addSpan({'class': 'bm-filter-stat-label', 'textContent': 'Remaining'}).buildElement()
                .addSpan({'id': 'bm-filter-tot-remaining', 'class': 'bm-filter-stat-value', 'textContent': '???'}).buildElement()
              .buildElement()
              .addDiv({'class': 'bm-filter-stat-card bm-filter-stat-card-wide'})
                .addSpan({'class': 'bm-filter-stat-label', 'textContent': 'Finish At'}).buildElement()
                .addSpan({'id': 'bm-filter-tot-completed', 'class': 'bm-filter-stat-value', 'textContent': '???'}).buildElement()
              .buildElement()
            .buildElement()
            .addHr().buildElement()
            .addForm({'class': 'bm-container bm-filter-sort-panel'})
              .addFieldset()
                .addLegend({'class': 'bm-filter-sort-heading', 'textContent': 'Sort Options'}).buildElement()
                .addDiv({'class': 'bm-container bm-filter-sort-row'})
                  .addSelect({'id': 'bm-filter-sort-primary', 'class': 'bm-filter-sort-select', 'name': 'sortPrimary', 'textContent': 'Show'}, (instance, label) => {
                    label.classList.add('bm-filter-sort-prefix');
                  })
                    .addOption({'value': 'id', 'textContent': 'color IDs'}).buildElement()
                    .addOption({'value': 'name', 'textContent': 'color names'}).buildElement()
                    .addOption({'value': 'premium', 'textContent': 'premium colors'}).buildElement()
                    .addOption({'value': 'percent', 'textContent': 'percentage'}).buildElement()
                    .addOption({'value': 'correct', 'textContent': 'correct pixels'}).buildElement()
                    .addOption({'value': 'incorrect', 'textContent': 'incorrect pixels'}).buildElement()
                    .addOption({'value': 'total', 'textContent': 'total pixels'}).buildElement()
                  .buildElement()
                  .addSelect({'id': 'bm-filter-sort-secondary', 'class': 'bm-filter-sort-select', 'name': 'sortSecondary', 'textContent': 'in'}, (instance, label) => {
                    label.classList.add('bm-filter-sort-prefix');
                  })
                    .addOption({'value': 'ascending', 'textContent': 'ascending'}).buildElement()
                    .addOption({'value': 'descending', 'textContent': 'descending'}).buildElement()
                  .buildElement()
                  .addSpan({'class': 'bm-filter-sort-suffix', 'textContent': 'order'}).buildElement()
                .buildElement()
                .addDiv({'class': 'bm-container'})
                  .addCheckbox({'id': 'bm-filter-show-unused', 'name': 'showUnused', 'textContent': 'Show unused colors'}, (instance, label) => {
                    label.classList.add('bm-filter-sort-checkbox');
                  }).buildElement()
                .buildElement()
              .buildElement()
              .addDiv({'class': 'bm-container bm-filter-sort-actions'})
                .addButton({'class': 'bm-button-primary', 'textContent': 'Sort Colors', 'type': 'submit'}, (instance, button) => {
                  button.onclick = (event) => {
                    event.preventDefault(); // Stop default form submission

                    // Get the form data
                    const formData = new FormData(document.querySelector(`#${this.windowID} form`));
                    const formValues = {};
                    for (const [input, value] of formData) {
                      formValues[input] = value;
                    }
                    console.log(`Primary: ${formValues['sortPrimary']}; Secondary: ${formValues['sortSecondary']}; Unused: ${formValues['showUnused'] == 'on'}`);
                    
                    // Sort the color list
                    this.#sortColorList(formValues['sortPrimary'], formValues['sortSecondary'], formValues['showUnused'] == 'on');
                  }
                }).buildElement()
              .buildElement()
            .buildElement()
          .buildElement()
          // Color list will appear here in the DOM tree
        .buildElement()
      .buildElement()
    .buildElement().buildOverlay(this.windowParent);

    // Creates dragging capability on the drag bar for dragging the window
    this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`);

    // Obtains the scrollable container to put the color filter in
    const scrollableContainer = document.querySelector(`#${this.windowID} .bm-container.bm-scrollable`);
    this.#initializeHorizontalScrollWheel(scrollableContainer);
    this.#initializeCustomSortDropdowns();
    this.#setWindowOpenState(true);
    
    // These run when the user opens the Color Filter window
    this.#buildColorList(scrollableContainer);
    this.#syncSortFormControls();
    this.#sortColorList(this.sortPrimary, this.sortSecondary, this.showUnused);

    // Displays some template statistics to the user
    this.updateInnerHTML('#bm-filter-tile-load', `${localizeNumber(this.tilesLoadedTotal)} / ${localizeNumber(this.tilesTotal)}`);
    this.updateInnerHTML('#bm-filter-tot-correct', localizeNumber(this.allPixelsCorrectTotal));
    this.updateInnerHTML('#bm-filter-tot-total', localizeNumber(this.allPixelsTotal));
    this.updateInnerHTML('#bm-filter-tot-remaining', `${localizeNumber((this.allPixelsTotal || 0) - (this.allPixelsCorrectTotal || 0))} (${localizePercent(((this.allPixelsTotal || 0) - (this.allPixelsCorrectTotal || 0)) / (this.allPixelsTotal || 1))})`);
    this.updateInnerHTML('#bm-filter-tot-completed', `<time datetime="${this.timeRemaining.toISOString().replace(/\.\d{3}Z$/, 'Z')}">${this.timeRemainingLocalized}</time>`);
    this.#startAutoRefresh();
  }

  /** Spawns a windowed Color Filter window.
   * If another color filter window already exists, we DON'T spawn another!
   * Parent/child relationships in the DOM structure below are indicated by indentation.
   * @since 0.90.35
   */
  buildWindowed() {

    // If a color filter wizard window already exists, close it
    if (document.querySelector(`#${this.windowID}`)) {
      this.#closeWindow();
      return;
    }

    // Creates a new windowed color filter window
    this.window = this.addDiv({
      'id': this.windowID,
      'class': 'bm-window bm-windowed',
      'style': `width: 360px; height: min(70vh, 32rem); min-width: ${this.windowMinWidth}px; min-height: ${this.windowMinHeight}px; max-width: min(${this.windowMaxWidth}px, calc(100vw - 16px)); max-height: min(${this.windowMaxHeight}px, calc(100vh - 16px));`
    })
      .addDragbar()
        .addButton({'class': 'bm-button-circle', 'innerHTML': minimizeIconExpanded, 'title': 'Minimize window "Color Filter"', 'aria-label': 'Minimize window "Color Filter"', 'data-button-status': 'expanded'}, (instance, button) => {
          button.onclick = () => {
            const windowedColorTotals = document.querySelector('#bm-filter-windowed-color-totals-dragbar');
            if (windowedColorTotals) {
              windowedColorTotals.style.display = (button.dataset['buttonStatus'] == 'expanded') ? 'none' : '';
            }
            instance.handleMinimization(button);
          };
          button.ontouchend = () => {button.click()}; // Needed only to negate weird interaction with dragbar
        }).buildElement()
        .addDiv()
          .addSpan({'id': 'bm-filter-windowed-color-totals-dragbar', 'class': 'bm-dragbar-text', 'style': 'font-weight: 700;'}).buildElement() // Contains correct / total pixel values
          .addHeader(1, {'class': 'bm-dragbar-title-persistent bm-filter-drag-title bm-filter-horizontal-drag-title', 'textContent': 'Color Filter'}).buildElement()
          // Minimized h1 element will appear here
        .buildElement() 
        .addDiv({'class': 'bm-flex-center'})
          .addButton({'id': 'bm-filter-layout-toggle', 'class': 'bm-button-circle bm-filter-layout-toggle', 'innerHTML': horizontalLayoutIcon, 'title': 'Switch color layout', 'aria-label': 'Switch to horizontal color layout'}, (instance, button) => {
            button.onclick = () => {
              const windowElement = button.closest(`#${this.windowID}`);
              const currentLayout = windowElement?.classList.contains('bm-filter-layout-horizontal') ? 'horizontal' : 'vertical';
              this.#applyWindowedColorLayout(currentLayout == 'horizontal' ? 'vertical' : 'horizontal');
            };
            button.ontouchend = () => {button.click();}; // Needed only to negate weird interaction with dragbar
          }).buildElement()
          .addButton({'class': 'bm-button-circle bm-filter-fullscreen-toggle', 'innerHTML': fullscreenIcon, 'title': 'Switch to fullscreen mode for "Color Filter"', 'aria-label': 'Switch to fullscreen mode for "Color Filter"'}, (instance, button) => {
            button.onclick = () => {
              this.#setWindowModePreference(false);
              this.#closeWindow(true);
              this.buildWindow();
            };
            button.ontouchend = () => {button.click();}; // Needed only to negate weird interaction with dragbar
          }).buildElement()
          .addButton({'class': 'bm-button-circle', 'innerHTML': closeIcon, 'title': 'Close window "Color Filter"', 'aria-label': 'Close window "Color Filter"'}, (instance, button) => {
            button.onclick = () => this.#closeWindow();
            button.ontouchend = () => {button.click();}; // Needed only to negate weird interaction with dragbar
          }).buildElement()
        .buildElement()
      .buildElement()
      .addDiv({'class': 'bm-window-content'})
        .addHr({'class': 'bm-window-divider-top'}).buildElement()
        .addDiv({'class': 'bm-container bm-center-vertically bm-filter-windowed-summary-row'})
          .addDiv({'class': 'bm-filter-windowed-summary'})
            .addSpan({'class': 'bm-filter-windowed-summary-label', 'textContent': 'Painted'}).buildElement()
            .addSpan({'id': 'bm-filter-windowed-color-totals-inline', 'class': 'bm-filter-windowed-summary-value', 'textContent': '0 / ???'}).buildElement()
          .buildElement()
        .buildElement()
        .addHr().buildElement()
        .addDiv({'class': 'bm-container bm-flex-between bm-center-vertically bm-filter-toolbar bm-filter-toolbar-vertical', 'style': 'gap: 1.5ch;'})
          .addButton({'class': 'bm-button-secondary', 'textContent': 'None', 'title': 'Hide all colors', 'aria-label': 'Hide all colors'}, (instance, button) => {
            button.onclick = () => this.#selectColorList(false);
          }).buildElement()
          .addButton({'class': 'bm-button-secondary', 'textContent': 'All', 'title': 'Show all colors', 'aria-label': 'Show all colors'}, (instance, button) => {
            button.onclick = () => this.#selectColorList(true);
          }).buildElement()
        .buildElement()
        .addDiv({'class': 'bm-filter-toolbar-horizontal'})
          .addButton({'class': 'bm-button-secondary', 'textContent': 'None', 'title': 'Hide all colors', 'aria-label': 'Hide all colors'}, (instance, button) => {
            button.onclick = () => this.#selectColorList(false);
          }).buildElement()
          .addButton({'class': 'bm-button-secondary', 'textContent': 'All', 'title': 'Show all colors', 'aria-label': 'Show all colors'}, (instance, button) => {
            button.onclick = () => this.#selectColorList(true);
          }).buildElement()
        .buildElement()
        .addHr().buildElement()
        .addDiv({'class': 'bm-container bm-scrollable bm-filter-scrollable'})
          // Color list will appear here
        .buildElement()
      .buildElement()
      .addDiv({
        'class': 'bm-resize-corner',
        'title': 'Resize Color Filter window',
        'aria-label': 'Resize Color Filter window',
        'role': 'presentation',
        'textContent': '◢',
        'style': 'position: absolute; right: 0; bottom: 0; width: 28px; height: 28px; display: flex; align-items: flex-end; justify-content: flex-end; padding-right: 4px; padding-bottom: 4px; box-sizing: border-box; z-index: 5; cursor: nwse-resize; pointer-events: auto; touch-action: none; user-select: none; font-size: 8px; line-height: 1; color: rgba(255,255,255,0.95); background: transparent; border: none; box-shadow: none;'
      }).buildElement()
    .buildElement().buildOverlay(this.windowParent);

    this.#applyWindowedColorLayout(this.#getWindowedColorLayout(), false);
    this.#initializeWindowedPersistence();

    // Obtains the scrollable container to put the color filter in
    const scrollableContainer = document.querySelector(`#${this.windowID} .bm-container.bm-scrollable`);
    this.#initializeHorizontalScrollWheel(scrollableContainer);
    this.#setWindowOpenState(true);
    
    // These run when the user opens the Color Filter window
    this.#buildColorList(scrollableContainer);
    this.#syncSortFormControls();
    this.#sortColorList(this.sortPrimary, this.sortSecondary, this.showUnused);
    this.#startAutoRefresh();
  }

  /** Retrieves the persisted window state object.
   * @returns {Object | null}
   * @since 0.92.0
   */
  #getWindowState() {
    if (!this.settingsManager) {return null;}
    this.settingsManager.userSettings[this.windowStateKey] ??= {};
    return this.settingsManager.userSettings[this.windowStateKey];
  }

  /** Returns whether the filter window should be restored on page load.
   * @returns {boolean}
   * @since 0.96.0
   */
  shouldAutoOpen() {
    const windowState = this.#getWindowState();
    return windowState?.isOpen !== false;
  }

  /** Persists whether the filter window is currently open.
   * @param {boolean} isOpen
   * @since 0.96.0
   */
  #setWindowOpenState(isOpen) {
    const windowState = this.#getWindowState();
    if (!windowState) {return;}
    windowState.isOpen = !!isOpen;
    void this.settingsManager?.saveUserStorageNow();
  }

  /** Returns whether the filter should open in windowed mode.
   * Defaults to windowed mode when no explicit preference was stored.
   * @returns {boolean}
   * @since 0.92.1
   */
  #prefersWindowedMode() {
    const windowState = this.#getWindowState();
    if (windowState?.mode == 'windowed') {return true;}
    if (windowState?.mode == 'fullscreen') {return false;}
    return true;
  }

  /** Updates the preferred window mode setting.
   * @param {boolean} shouldBeWindowed
   * @since 0.92.0
   */
  #setWindowModePreference(shouldBeWindowed) {
    const windowState = this.#getWindowState();
    if (windowState) {
      windowState.mode = shouldBeWindowed ? 'windowed' : 'fullscreen';
    }
    if (!this.settingsManager) {return;}
    this.settingsManager.toggleFlag(this.windowModeFlag, shouldBeWindowed);
    void this.settingsManager.saveUserStorageNow();
  }

  /** Returns the preferred color layout for the windowed filter.
   * @returns {'vertical' | 'horizontal'}
   * @since 0.95.0
   */
  #getWindowedColorLayout() {
    const windowState = this.#getWindowState();
    return windowState?.colorLayout == 'horizontal' ? 'horizontal' : 'vertical';
  }

  /** Returns the active color layout for the rendered window.
   * @param {HTMLElement} [windowElement]
   * @returns {'vertical' | 'horizontal'}
   * @since 0.95.0
   */
  #getActiveWindowedColorLayout(windowElement = document.querySelector(`#${this.windowID}.bm-windowed`)) {
    return windowElement?.classList.contains('bm-filter-layout-horizontal') ? 'horizontal' : 'vertical';
  }

  /** Returns the per-layout size object for the windowed filter.
   * @param {'vertical' | 'horizontal'} layout
   * @returns {{width?: number, height?: number} | null}
   * @since 0.95.0
   */
  #getWindowedLayoutSize(layout) {
    const windowState = this.#getWindowState();
    if (!windowState) {return null;}
    windowState.layoutSizes ??= {};
    windowState.layoutSizes[layout] ??= {};
    return windowState.layoutSizes[layout];
  }

  /** Returns the maximum window width for a color layout.
   * @param {'vertical' | 'horizontal'} layout
   * @returns {number}
   * @since 0.95.0
   */
  #getWindowLayoutMaxWidth(layout) {
    const viewportMaximum = window.innerWidth - 16;
    if (layout == 'horizontal') {return viewportMaximum;}
    return Math.min(this.windowMaxWidth, viewportMaximum);
  }

  /** Returns the minimum window height for a color layout.
   * @param {'vertical' | 'horizontal'} layout
   * @returns {number}
   * @since 0.95.0
   */
  #getWindowLayoutMinHeight(layout) {
    return layout == 'horizontal' ? this.windowHorizontalHeight : this.windowMinHeight;
  }

  /** Returns the maximum window height for a color layout.
   * @param {'vertical' | 'horizontal'} layout
   * @returns {number}
   * @since 0.95.0
   */
  #getWindowLayoutMaxHeight(layout) {
    const viewportMaximum = window.innerHeight - 16;
    if (layout == 'horizontal') {
      return Math.min(this.windowHorizontalHeight, viewportMaximum);
    }
    return Math.min(this.windowMaxHeight, viewportMaximum);
  }

  /** Persists only the size for the current color layout.
   * @param {HTMLElement} windowElement
   * @param {'vertical' | 'horizontal'} layout
   * @since 0.95.0
   */
  #saveWindowLayoutSize(windowElement, layout) {
    const layoutSize = this.#getWindowedLayoutSize(layout);
    if (!layoutSize || !windowElement?.isConnected) {return;}

    const rect = windowElement.getBoundingClientRect();
    layoutSize.width = this.#clampWindowDimension(rect.width, this.windowMinWidth, this.#getWindowLayoutMaxWidth(layout));
    layoutSize.height = layout == 'horizontal'
      ? this.#getWindowLayoutMaxHeight(layout)
      : this.#clampWindowDimension(rect.height, this.#getWindowLayoutMinHeight(layout), this.#getWindowLayoutMaxHeight(layout));
  }

  /** Restores the remembered size for a color layout.
   * @param {HTMLElement} windowElement
   * @param {'vertical' | 'horizontal'} layout
   * @since 0.95.0
   */
  #restoreWindowLayoutSize(windowElement, layout) {
    const layoutSize = this.#getWindowedLayoutSize(layout);
    if (!layoutSize || !windowElement?.isConnected) {return;}

    let width = Number(layoutSize.width);
    let height = Number(layoutSize.height);

    if (!Number.isFinite(width)) {
      width = layout == 'horizontal'
        ? Math.max(windowElement.getBoundingClientRect().width, Math.min(760, this.#getWindowLayoutMaxWidth(layout)))
        : Number(this.#getWindowState()?.width) || windowElement.getBoundingClientRect().width;
    }

    if (layout == 'horizontal') {
      height = this.#getWindowLayoutMaxHeight(layout);
    } else if (!Number.isFinite(height)) {
      height = Number(this.#getWindowState()?.height) || windowElement.getBoundingClientRect().height;
    }

    width = this.#clampWindowDimension(width, this.windowMinWidth, this.#getWindowLayoutMaxWidth(layout));
    height = this.#clampWindowDimension(height, this.#getWindowLayoutMinHeight(layout), this.#getWindowLayoutMaxHeight(layout));

    layoutSize.width = width;
    layoutSize.height = height;
    windowElement.style.width = `${width}px`;
    windowElement.style.height = `${height}px`;
  }

  /** Applies the color list layout in windowed mode.
   * @param {'vertical' | 'horizontal'} layout
   * @param {boolean} [shouldPersist=true]
   * @since 0.95.0
   */
  #applyWindowedColorLayout(layout, shouldPersist = true) {
    const normalizedLayout = layout == 'horizontal' ? 'horizontal' : 'vertical';
    const windowElement = document.querySelector(`#${this.windowID}.bm-windowed`);
    if (!windowElement) {return;}

    const previousLayout = this.#getActiveWindowedColorLayout(windowElement);
    if (shouldPersist && previousLayout != normalizedLayout) {
      this.#saveWindowLayoutSize(windowElement, previousLayout);
    }

    windowElement.classList.toggle('bm-filter-layout-horizontal', normalizedLayout == 'horizontal');
    windowElement.classList.toggle('bm-filter-layout-vertical', normalizedLayout != 'horizontal');

    const toggleButton = windowElement.querySelector('#bm-filter-layout-toggle');
    if (toggleButton) {
      const showsHorizontalLayout = normalizedLayout == 'horizontal';
      toggleButton.innerHTML = showsHorizontalLayout ? verticalLayoutIcon : horizontalLayoutIcon;
      toggleButton.title = showsHorizontalLayout ? 'Switch to vertical color layout' : 'Switch to horizontal color layout';
      toggleButton.ariaLabel = toggleButton.title;
      toggleButton.setAttribute('aria-pressed', showsHorizontalLayout ? 'true' : 'false');
    }

    const windowState = this.#getWindowState();
    if (windowState) {
      windowState.colorLayout = normalizedLayout;
    }
    this.updateColorList();
    this.#restoreWindowLayoutSize(windowElement, normalizedLayout);
    if (shouldPersist) {
      this.#saveWindowState(windowElement);
      void this.settingsManager?.saveUserStorageNow();
    }
  }

  /** Updates the visible sort controls to reflect the active sort state.
   * @since 0.92.1
   */
  #syncSortFormControls() {
    const sortPrimaryInput = document.querySelector(`#${this.windowID} #bm-filter-sort-primary`);
    const sortSecondaryInput = document.querySelector(`#${this.windowID} #bm-filter-sort-secondary`);
    const showUnusedInput = document.querySelector(`#${this.windowID} #bm-filter-show-unused`);

    if (sortPrimaryInput instanceof HTMLSelectElement) {
      sortPrimaryInput.value = this.sortPrimary;
      sortPrimaryInput.dispatchEvent(new Event('change', {'bubbles': true}));
    }
    if (sortSecondaryInput instanceof HTMLSelectElement) {
      sortSecondaryInput.value = this.sortSecondary;
      sortSecondaryInput.dispatchEvent(new Event('change', {'bubbles': true}));
    }
    if (showUnusedInput instanceof HTMLInputElement) {
      showUnusedInput.checked = this.showUnused;
    }
  }

  /** Enhances native sort selects into custom dropdowns while preserving form values.
   * @since 0.96.0
   */
  #initializeCustomSortDropdowns() {
    const sortSelects = Array.from(document.querySelectorAll(`#${this.windowID} .bm-filter-sort-select`));
    if (!sortSelects.length) {return;}

    for (const select of sortSelects) {
      if (!(select instanceof HTMLSelectElement) || (select.dataset['customized'] == 'true')) {continue;}

      const wrapper = document.createElement('div');
      wrapper.className = 'bm-filter-sort-dropdown';
      wrapper.dataset['inputId'] = select.id;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'bm-filter-sort-dropdown-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', `${select.id}-menu`);

      const triggerText = document.createElement('span');
      triggerText.className = 'bm-filter-sort-dropdown-text';
      trigger.appendChild(triggerText);

      const menu = document.createElement('div');
      menu.id = `${select.id}-menu`;
      menu.className = 'bm-filter-sort-dropdown-menu';
      menu.setAttribute('role', 'listbox');

      const updateDropdownState = () => {
        const selectedValue = select.value;
        const selectedOption = Array.from(select.options).find((option) => option.value == selectedValue) ?? select.options[0];
        triggerText.textContent = selectedOption?.textContent ?? '';

        for (const optionButton of menu.querySelectorAll('.bm-filter-sort-dropdown-option')) {
          const isSelected = optionButton.dataset['value'] == selectedValue;
          optionButton.classList.toggle('is-selected', isSelected);
          optionButton.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        }
      };

      const focusDropdownOption = (direction = 'selected') => {
        const optionButtons = Array.from(menu.querySelectorAll('.bm-filter-sort-dropdown-option'));
        if (!optionButtons.length) {return;}

        let targetIndex = optionButtons.findIndex((button) => button.classList.contains('is-selected'));
        if (targetIndex < 0) {targetIndex = 0;}

        if (direction === 'first') {targetIndex = 0;}
        else if (direction === 'last') {targetIndex = optionButtons.length - 1;}
        else if (typeof direction == 'number') {
          const activeIndex = optionButtons.findIndex((button) => button === document.activeElement);
          const baseIndex = activeIndex >= 0 ? activeIndex : targetIndex;
          targetIndex = (baseIndex + direction + optionButtons.length) % optionButtons.length;
        }

        optionButtons[targetIndex]?.focus();
      };

      const setOpenState = (shouldOpen) => {
        wrapper.classList.toggle('is-open', shouldOpen);
        trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        if (shouldOpen) {
          focusDropdownOption('selected');
        }
      };

      trigger.onclick = () => {
        const shouldOpen = !wrapper.classList.contains('is-open');
        this.#closeCustomSortDropdowns(shouldOpen ? wrapper : null);
        setOpenState(shouldOpen);
      };

      trigger.onkeydown = (event) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          if (!wrapper.classList.contains('is-open')) {
            this.#closeCustomSortDropdowns(wrapper);
            setOpenState(true);
          }
          focusDropdownOption(event.key == 'ArrowUp' ? 'last' : 'selected');
        } else if (event.key == 'Escape') {
          setOpenState(false);
        }
      };

      for (const option of Array.from(select.options)) {
        const optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = 'bm-filter-sort-dropdown-option';
        optionButton.dataset['value'] = option.value;
        optionButton.textContent = option.textContent;
        optionButton.setAttribute('role', 'option');
        optionButton.onclick = () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', {'bubbles': true}));
          setOpenState(false);
          trigger.focus();
        };
        optionButton.onkeydown = (event) => {
          if (event.key == 'ArrowDown') {
            event.preventDefault();
            focusDropdownOption(1);
          } else if (event.key == 'ArrowUp') {
            event.preventDefault();
            focusDropdownOption(-1);
          } else if (event.key == 'Home') {
            event.preventDefault();
            focusDropdownOption('first');
          } else if (event.key == 'End') {
            event.preventDefault();
            focusDropdownOption('last');
          } else if (event.key == 'Escape') {
            event.preventDefault();
            setOpenState(false);
            trigger.focus();
          } else if ((event.key == 'Enter') || (event.key == ' ')) {
            event.preventDefault();
            optionButton.click();
          }
        };
        menu.appendChild(optionButton);
      }

      select.classList.add('bm-filter-sort-native');
      select.tabIndex = -1;
      select.setAttribute('aria-hidden', 'true');
      select.dataset['customized'] = 'true';
      select.addEventListener('change', updateDropdownState);

      select.parentElement?.insertBefore(wrapper, select);
      wrapper.appendChild(select);
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
      updateDropdownState();
    }

    if (!this.sortDropdownPointerHandler) {
      this.sortDropdownPointerHandler = (event) => {
        if (!(event.target instanceof Element)) {
          this.#closeCustomSortDropdowns();
          return;
        }
        if (!event.target.closest(`#${this.windowID} .bm-filter-sort-dropdown`)) {
          this.#closeCustomSortDropdowns();
        }
      };
      document.addEventListener('pointerdown', this.sortDropdownPointerHandler);
    }

    if (!this.sortDropdownKeyHandler) {
      this.sortDropdownKeyHandler = (event) => {
        if (event.key == 'Escape') {
          this.#closeCustomSortDropdowns();
        }
      };
      document.addEventListener('keydown', this.sortDropdownKeyHandler);
    }
  }

  /** Closes custom sort dropdowns, optionally leaving one open.
   * @param {HTMLElement | null} [exceptDropdown=null]
   * @since 0.96.0
   */
  #closeCustomSortDropdowns(exceptDropdown = null) {
    const dropdowns = document.querySelectorAll(`#${this.windowID} .bm-filter-sort-dropdown`);
    for (const dropdown of dropdowns) {
      const shouldStayOpen = !!exceptDropdown && (dropdown === exceptDropdown);
      dropdown.classList.toggle('is-open', shouldStayOpen);

      const trigger = dropdown.querySelector('.bm-filter-sort-dropdown-trigger');
      if (trigger instanceof HTMLButtonElement) {
        trigger.setAttribute('aria-expanded', shouldStayOpen ? 'true' : 'false');
      }
    }
  }

  /** Removes global handlers used by custom sort dropdowns.
   * @since 0.96.0
   */
  #cleanupCustomSortDropdowns() {
    if (this.sortDropdownPointerHandler) {
      document.removeEventListener('pointerdown', this.sortDropdownPointerHandler);
      this.sortDropdownPointerHandler = null;
    }
    if (this.sortDropdownKeyHandler) {
      document.removeEventListener('keydown', this.sortDropdownKeyHandler);
      this.sortDropdownKeyHandler = null;
    }
  }

  /** Immediately closes the filter window and cleans up persistence observers.
   * @since 0.92.0
   */
  #closeWindow(preserveOpenState = false) {
    const windowElement = document.querySelector(`#${this.windowID}`);
    if (windowElement?.classList.contains('bm-windowed')) {
      this.#saveWindowState(windowElement);
    }
    if (!preserveOpenState) {
      this.#setWindowOpenState(false);
    }
    this.#stopAutoRefresh();
    this.#cleanupWindowPersistence();
    this.#cleanupCustomSortDropdowns();
    windowElement?.remove();
  }

  /** Starts the automatic Color Filter statistics refresh loop.
   * @since 0.92.1
   */
  #startAutoRefresh() {
    this.#stopAutoRefresh();
    this.colorRefreshInterval = setInterval(() => {
      if (!document.querySelector(`#${this.windowID}`)) {
        this.#stopAutoRefresh();
        return;
      }
      this.updateColorList();
    }, this.colorRefreshIntervalMS);
  }

  /** Stops the automatic Color Filter statistics refresh loop.
   * @since 0.92.1
   */
  #stopAutoRefresh() {
    if (!this.colorRefreshInterval) {return;}
    clearInterval(this.colorRefreshInterval);
    this.colorRefreshInterval = null;
  }

  /** Disconnects live observers used for window persistence.
   * @since 0.92.0
   */
  #cleanupWindowPersistence() {
    if (this.windowResizeObserver) {
      this.windowResizeObserver.disconnect();
      this.windowResizeObserver = null;
    }
    if (this.windowViewportResizeHandler) {
      window.removeEventListener('resize', this.windowViewportResizeHandler);
      this.windowViewportResizeHandler = null;
    }
    if (this.windowHorizontalWheelHandler && this.windowHorizontalWheelElement) {
      this.windowHorizontalWheelElement.removeEventListener('wheel', this.windowHorizontalWheelHandler);
      this.windowHorizontalWheelHandler = null;
      this.windowHorizontalWheelElement = null;
    }
    if (this.windowSaveTimeout) {
      clearTimeout(this.windowSaveTimeout);
      this.windowSaveTimeout = null;
    }
  }

  /** Returns a clamped dimension value for the window.
   * @param {number} size - The size in pixels
   * @param {number} minimum - Minimum allowed size
   * @param {number} maximum - Maximum allowed size
   * @returns {number}
   * @since 0.92.0
   */
  #clampWindowDimension(size, minimum, maximum) {
    const resolvedMaximum = Math.max(minimum, maximum);
    return Math.min(Math.max(Math.round(Number(size) || minimum), minimum), resolvedMaximum);
  }

  /** Returns a viewport-safe position for the window.
   * @param {HTMLElement} windowElement
   * @param {number} x
   * @param {number} y
   * @returns {{x: number, y: number}}
   * @since 0.92.0
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

  /** Applies the persisted size and position to the windowed filter.
   * @param {HTMLElement} windowElement
   * @since 0.92.0
   */
  #restoreWindowState(windowElement) {
    const windowState = this.#getWindowState();
    if (!windowState || !windowElement) {return;}

    const layout = this.#getWindowedColorLayout();
    const layoutSize = this.#getWindowedLayoutSize(layout);
    const width = Number(layoutSize?.width ?? windowState.width);
    const height = Number(layoutSize?.height ?? windowState.height);
    const hasWidth = Number.isFinite(width);
    const hasHeight = Number.isFinite(height);

    if (hasWidth) {
      const nextWidth = this.#clampWindowDimension(width, this.windowMinWidth, this.#getWindowLayoutMaxWidth(layout));
      layoutSize.width = nextWidth;
      windowState.width = nextWidth;
      windowElement.style.width = `${nextWidth}px`;
    }
    if (hasHeight) {
      const nextHeight = this.#clampWindowDimension(height, this.#getWindowLayoutMinHeight(layout), this.#getWindowLayoutMaxHeight(layout));
      layoutSize.height = nextHeight;
      windowState.height = nextHeight;
      windowElement.style.height = `${nextHeight}px`;
    }

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
        void this.settingsManager?.saveUserStorageNow();
      }
    });
  }

  /** Saves the current size and position of the windowed filter.
   * @param {HTMLElement} windowElement
   * @since 0.92.0
   */
  #saveWindowState(windowElement) {
    const windowState = this.#getWindowState();
    if (!windowState || !windowElement?.isConnected || !windowElement.classList.contains('bm-windowed')) {return;}
    if (windowElement.querySelector('.bm-dragbar button[data-button-status="collapsed"]')) {return;}

    const layout = this.#getActiveWindowedColorLayout(windowElement);
    const rect = windowElement.getBoundingClientRect();
    const width = this.#clampWindowDimension(rect.width, this.windowMinWidth, this.#getWindowLayoutMaxWidth(layout));
    const height = layout == 'horizontal'
      ? this.#getWindowLayoutMaxHeight(layout)
      : this.#clampWindowDimension(rect.height, this.#getWindowLayoutMinHeight(layout), this.#getWindowLayoutMaxHeight(layout));

    if (Math.round(rect.width) != width) {
      windowElement.style.width = `${width}px`;
    }
    if (Math.round(rect.height) != height) {
      windowElement.style.height = `${height}px`;
    }

    const clampedPosition = this.#clampWindowPosition(windowElement, rect.left, rect.top);
    windowElement.style.left = '0px';
    windowElement.style.top = '0px';
    windowElement.style.right = '';
    windowElement.style.transform = `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`;

    windowState.x = clampedPosition.x;
    windowState.y = clampedPosition.y;
    windowState.width = width;
    windowState.height = height;
    windowState.colorLayout = layout;

    const layoutSize = this.#getWindowedLayoutSize(layout);
    if (layoutSize) {
      layoutSize.width = width;
      layoutSize.height = height;
    }

    void this.settingsManager?.saveUserStorageNow();
  }

  /** Debounces persisting the current window size and position.
   * @param {HTMLElement} windowElement
   * @param {number} [delay=150]
   * @since 0.92.0
   */
  #scheduleWindowStateSave(windowElement, delay = 150) {
    if (this.windowSaveTimeout) {
      clearTimeout(this.windowSaveTimeout);
    }
    this.windowSaveTimeout = setTimeout(() => {
      this.windowSaveTimeout = null;
      this.#saveWindowState(windowElement);
    }, delay);
  }

  /** Enables persistence and resize handling for the windowed filter.
   * @since 0.92.0
   */
  #initializeWindowedPersistence() {
    const windowElement = document.querySelector(`#${this.windowID}.bm-window`);
    if (!windowElement) {return;}

    this.#cleanupWindowPersistence();
    this.#restoreWindowState(windowElement);

    this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`, {
      onEnd: ({element}) => this.#saveWindowState(element)
    });
    this.handleResize(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-resize-corner`, {
      minWidth: this.windowMinWidth,
      minHeight: () => this.#getWindowLayoutMinHeight(this.#getActiveWindowedColorLayout(windowElement)),
      maxHeight: () => this.#getWindowLayoutMaxHeight(this.#getActiveWindowedColorLayout(windowElement)),
      onEnd: ({element}) => this.#saveWindowState(element)
    });

    if (typeof ResizeObserver == 'function') {
      this.windowResizeObserver = new ResizeObserver(() => this.#scheduleWindowStateSave(windowElement));
      this.windowResizeObserver.observe(windowElement);
    }

    this.windowViewportResizeHandler = () => this.#scheduleWindowStateSave(windowElement, 0);
    window.addEventListener('resize', this.windowViewportResizeHandler);
  }

  /** Converts vertical wheel input into horizontal scrolling for the horizontal color layout.
   * @param {HTMLElement} scrollableContainer
   * @since 0.95.0
   */
  #initializeHorizontalScrollWheel(scrollableContainer) {
    if (!scrollableContainer) {return;}

    if (this.windowHorizontalWheelHandler && this.windowHorizontalWheelElement) {
      this.windowHorizontalWheelElement.removeEventListener('wheel', this.windowHorizontalWheelHandler);
    }

    this.windowHorizontalWheelElement = scrollableContainer;
    this.windowHorizontalWheelHandler = event => {
      const windowElement = scrollableContainer.closest(`#${this.windowID}.bm-windowed`);
      if (!windowElement?.classList.contains('bm-filter-layout-horizontal')) {return;}
      if (scrollableContainer.scrollWidth <= scrollableContainer.clientWidth) {return;}

      const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!horizontalDelta) {return;}

      scrollableContainer.scrollLeft += horizontalDelta;
      event.preventDefault();
    };

    scrollableContainer.addEventListener('wheel', this.windowHorizontalWheelHandler, {passive: false});
  }

  /** Creates the color list container.
   * @param {HTMLElement} parentElement - Parent element to add the color list to as a child
   * @since 0.88.222
   */
  #buildColorList(parentElement) {

    // Figures out if this window is fullscreen or windowed mode
    const parentWindow = parentElement.closest(`#${this.windowID}`);
    const isWindowedMode = parentWindow?.classList.contains('bm-windowed');
    const isHorizontalWindowedMode = isWindowedMode && parentWindow?.classList.contains('bm-filter-layout-horizontal');
    // Note: `undefined` is expected to behave as if `false`
    
    console.log(`Is Windowed Mode: ${isWindowedMode}`);

    const colorList = new Overlay(this.name, this.version);
    colorList.addDiv({'id': this.colorListID})
    // We leave it open so we can add children to the grid

    // Generated by #updateColorList()
    const colorStatistics = this.updateColorList();

    // For each color in the palette...
    for (const color of this.palette) {

      // Relative Luminance
      const lumin = calculateRelativeLuminance(color.rgb);

      // Calculates if white or black text would contrast better with the palette color
      let textColorForPaletteColorBackground = 
      (((1.05) / (lumin + 0.05)) > ((lumin + 0.05) / 0.05)) 
      ? 'white' : 'black';

      // However, if the color is "Transparent" (or there is no color ID), then we make the text color transparent
      if (!color.id) {
        textColorForPaletteColorBackground = 'transparent';
      }

      // Changes the luminance of the hover/focus button effect
      const bgEffectForButtons = (textColorForPaletteColorBackground == 'white') ? 'bm-button-hover-white' : 'bm-button-hover-black';
      const colorRGB = color.rgb?.map(channel => Number(channel) || 0).join(',');
      const colorCardText = ((color.id == -2) || (color.id == -1) || (color.id == 0))
        ? 'white'
        : textColorForPaletteColorBackground;
      const colorCardStyle = `--bm-filter-card-bg: rgb(${colorRGB}); --bm-filter-card-fg: ${colorCardText};`;

      // Generated by #updateColorList()
      const {
        colorCorrect: colorCorrect,
        colorCorrectLocalized: colorCorrectLocalized,
        colorPercent: colorPercent,
        colorTotal: colorTotal,
        colorTotalLocalized: colorTotalLocalized,
        colorIncorrect: colorIncorrect
      } = colorStatistics[color.id];

      const isColorHidden = !!(this.templateManager.shouldFilterColor.get(color.id) || false);
      const isIncorrectHighlightActive = this.templateManager.getIncorrectHighlightColorID?.() == color.id;
      const incorrectHighlightMode = isIncorrectHighlightActive ? this.templateManager.getIncorrectHighlightMode?.() : 'inactive';
      const incorrectHighlightLabel = this.#getIncorrectHighlightButtonLabel(color.name, incorrectHighlightMode);
      const hasNoPixels = Number(colorTotal) === 0;

      // Add the color to the color list DOM
      if (isWindowedMode) {

        // The star pattern for premium colors
        const styleBackgroundStar = `background-size: auto 100%; background-repeat: repeat-x; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50,5L79,91L2,39L98,39L21,91' fill='${textColorForPaletteColorBackground}' fill-opacity='.1'/></svg>");`;

        // Add windowed mode color DOM to color list
        colorList.addDiv({'class': 'bm-container bm-filter-color bm-flex-between',
          // Dataset
          'data-id': color.id,
          'data-name': color.name,
          'data-premium': +color.premium,
          'data-state': isColorHidden ? 'hidden' : 'shown',
          'data-highlight': incorrectHighlightMode,
          'data-correct': !Number.isNaN(parseInt(colorCorrect)) ? colorCorrect : '0',
          'data-total': colorTotal,
          'data-percent': (colorPercent.slice(-1) == '%') ? colorPercent.slice(0, -1) : '0',
          'data-incorrect': colorIncorrect || 0
        }, (instance, div) => this.#initializeColorBlockToggle(div, color))
          .addDiv({'class': 'bm-filter-container-rgb', 'style': `background-color: rgb(${color.rgb?.map(channel => Number(channel) || 0).join(',')});${color.premium ? styleBackgroundStar : ''}`})
            .addButton({
              'class': 'bm-button-trans bm-filter-color-visibility ' + bgEffectForButtons,
              'data-state': isColorHidden ? 'hidden' : 'shown',
              'aria-label': isColorHidden ? `Show the color ${color.name || ''} on templates.` : `Hide the color ${color.name || ''} on templates.`,
              'innerHTML': isColorHidden ? this.eyeClosed : this.eyeOpen,
              'style': `color: ${textColorForPaletteColorBackground};`},
              (instance, button) => {

                // When the button is clicked
                button.onclick = event => {
                  event.stopPropagation();
                  this.#toggleColorVisibility(button, color);
                }

                // Disables the "hide color" button if the color is "Transparent" (or no ID exists)
                if (!color.id) {button.disabled = true;}
                this.#syncColorToggleLabel(button, color);
              }
            ).buildElement()
            .addButton({
              'class': 'bm-button-trans bm-filter-color-highlight ' + bgEffectForButtons,
              'aria-label': incorrectHighlightLabel,
              'aria-pressed': isIncorrectHighlightActive ? 'true' : 'false',
              'title': incorrectHighlightLabel.replace(/\.$/, ''),
              'data-mode': incorrectHighlightMode,
              'innerHTML': incorrectHighlightIcon,
              'style': `color: ${textColorForPaletteColorBackground};`},
              (instance, button) => {
                button.onclick = event => {
                  event.stopPropagation();
                  this.#toggleIncorrectHighlightColor(button, color);
                };
                button.onkeydown = event => event.stopPropagation();
                if (!color.id) {button.disabled = true;}
              }
            ).buildElement()
            .addHeader(2, {'textContent': color.name, 'style': `color: ${((color.id == -1) || (color.id == 0)) ? 'white' : textColorForPaletteColorBackground}`}).buildElement()
            .addSmall({'class': 'bm-filter-color-pxl-cnt', 'innerHTML': hasNoPixels ? '-' : (isHorizontalWindowedMode ? `${colorCorrectLocalized}<br>out of ${colorTotalLocalized}` : `${colorCorrectLocalized} / ${colorTotalLocalized}`), 'style': `color: ${((color.id == -1) || (color.id == 0)) ? 'white' : textColorForPaletteColorBackground}; flex: 1 1 auto; text-align: right;`}).buildElement()
          .buildElement()
        .buildElement();
      } else {
        // Else we are in fullscreen mode.

        // Add fullscreen mode color DOM to color list
        colorList.addDiv({'class': 'bm-container bm-filter-color bm-flex-between',
          'style': colorCardStyle,
          'data-id': color.id,
          'data-name': color.name,
          'data-premium': +color.premium,
          'data-state': isColorHidden ? 'hidden' : 'shown',
          'data-highlight': incorrectHighlightMode,
          'data-correct': !Number.isNaN(parseInt(colorCorrect)) ? colorCorrect : '0',
          'data-total': colorTotal,
          'data-percent': (colorPercent.slice(-1) == '%') ? colorPercent.slice(0, -1) : '0',
          'data-incorrect': colorIncorrect || 0
        }, (instance, div) => this.#initializeColorBlockToggle(div, color))
          .addDiv({'class': 'bm-filter-premium-star', 'aria-hidden': 'true'}).buildElement()
          .addDiv({'class': 'bm-filter-color-main'})
            .addDiv({'class': 'bm-filter-container-rgb'})
              .addButton({
                'class': 'bm-button-trans bm-filter-color-visibility ' + bgEffectForButtons,
                'data-state': isColorHidden ? 'hidden' : 'shown',
                'aria-label': isColorHidden ? `Show the color ${color.name || ''} on templates.` : `Hide the color ${color.name || ''} on templates.`,
                'innerHTML': isColorHidden ? this.eyeClosed : this.eyeOpen,
                'style': `color: ${colorCardText};`},
                (instance, button) => {

                  // When the button is clicked
                  button.onclick = event => {
                    event.stopPropagation();
                    this.#toggleColorVisibility(button, color);
                  }

                  // Disables the "hide color" button if the color is "Transparent" (or no ID exists)
                  if (!color.id) {button.disabled = true;}
                  this.#syncColorToggleLabel(button, color);
                }
              ).buildElement()
              .addButton({
                'class': 'bm-button-trans bm-filter-color-highlight',
                'aria-label': incorrectHighlightLabel,
                'aria-pressed': isIncorrectHighlightActive ? 'true' : 'false',
                'title': incorrectHighlightLabel.replace(/\.$/, ''),
                'data-mode': incorrectHighlightMode,
                'innerHTML': incorrectHighlightIcon},
                (instance, button) => {
                  button.onclick = event => {
                    event.stopPropagation();
                    this.#toggleIncorrectHighlightColor(button, color);
                  };
                  button.onkeydown = event => event.stopPropagation();
                  if (!color.id) {button.disabled = true;}
                }
              ).buildElement()
            .buildElement()
            .addDiv({'class': 'bm-filter-color-title'})
              .addHeader(2, {'textContent': color.name}).buildElement()
            .buildElement()
          .buildElement()
          .addDiv({'class': 'bm-filter-color-meta'})
            .addDiv({'class': 'bm-filter-color-progress'})
              .addSpan({'class': 'bm-filter-color-pxl-cnt', 'innerHTML': hasNoPixels ? '-' : `${colorCorrectLocalized} /<br>${colorTotalLocalized}`}).buildElement()
              .addSmall({'class': 'bm-filter-color-pxl-desc', 'innerHTML': `${colorPercent} done<br>${((typeof colorIncorrect == 'number') && !isNaN(colorIncorrect)) ? colorIncorrect : '???'} off`}).buildElement()
            .buildElement()
          .buildElement()
        .buildElement();
      }
    }

    // Adds the colors to the color container in the filter window
    colorList.buildOverlay(parentElement);
  }

  /** Sorts the color list & hides unused colors
   * @param {string} sortPrimary - The name of the dataset attribute to sort by.
   * @param {string} sortSecondary - Secondary sort. It can be either 'ascending' or 'descending'.
   * @param {boolean} showUnused - Should unused colors be displayed in the list to the user?
   * @since 0.88.222
   */
  #sortColorList(sortPrimary, sortSecondary, showUnused) {

    // Update memorised sort settings
    this.sortPrimary = sortPrimary;
    this.sortSecondary = sortSecondary;
    this.showUnused = showUnused;

    const colorList = document.querySelector(`#${this.colorListID}`);

    const colors = Array.from(colorList.children);

    colors.sort((index, nextIndex) => {
      const indexValue = index.getAttribute('data-' + sortPrimary);
      const nextIndexValue = nextIndex.getAttribute('data-' + sortPrimary);

      const indexValueNumber = parseFloat(indexValue);
      const nextIndexValueNumber = parseFloat(nextIndexValue);

      const indexValueNumberIsNumber = !isNaN(indexValueNumber);
      const nextIndexValueNumberIsNumber = !isNaN(nextIndexValueNumber);

      // If the user wants to show unused colors...
      if (showUnused) {
        index.classList.remove('bm-color-hide'); // Show the color
      } else if (!Number(index.getAttribute('data-total'))) {
        // ...else if the user wants to hide unused colors, and this color is unused...
        
        index.classList.add('bm-color-hide'); // Hide the color
      }

      // If both index values are numbers...
      if (indexValueNumberIsNumber && nextIndexValueNumberIsNumber) {
        // Perform numeric comparison
        return sortSecondary === 'ascending' ? indexValueNumber - nextIndexValueNumber : nextIndexValueNumber - indexValueNumber;
      } else {
        // Otherwise, perform string comparison
        const indexValueString = indexValue.toLowerCase();
        const nextIndexValueString = nextIndexValue.toLowerCase();
        if (indexValueString < nextIndexValueString) return sortSecondary === 'ascending' ? -1 : 1;
        if (indexValueString > nextIndexValueString) return sortSecondary === 'ascending' ? 1 : -1;
        return 0;
      }
    });

    colors.forEach(color => colorList.appendChild(color));
  }

  /** (Un)selects all colors in the color list that are visible to the user.
   * @param {boolean} userWantsUnselect - Does the user want to unselect colors?
   * @since 0.88.222
   */
  #selectColorList(userWantsUnselect) {

    // Gets the colors
    const colorList = document.querySelector(`#${this.colorListID}`);
    const colors = Array.from(colorList.children);

    // For each color...
    for (const color of colors) {

      // Skip this color if it is hidden
      if (color.classList?.contains('bm-color-hide')) {continue;}

      // Gets the button to click
      const button = color.querySelector('.bm-filter-color-visibility');
      
      // Exits early if the button is in its proper state
      if ((button.dataset['state'] == 'hidden') && !userWantsUnselect) {continue;} // If the button is selected, and the user wants to select all buttons, then skip this one
      if ((button.dataset['state'] == 'shown') && userWantsUnselect) {continue;} // If the button is not selected, and the user wants to unselect all buttons, then skip this one
      
      button.click(); // If the button is not in its proper state, then we click it
    }
  }

  /** Updates the color toggle labels on the icon and the clickable color block.
   * @param {HTMLButtonElement} button - The color visibility button
   * @param {Object} color - Palette color metadata
   * @since 0.95.0
   */
  #syncColorToggleLabel(button, color) {
    const ariaLabel = (button.dataset['state'] == 'hidden')
      ? `Show the color ${color.name || ''} on templates.`
      : `Hide the color ${color.name || ''} on templates.`;

    button.ariaLabel = ariaLabel;

    const colorElement = button.closest('.bm-filter-color');
    colorElement?.setAttribute('aria-label', ariaLabel);
    colorElement?.setAttribute('data-state', button.dataset['state']);

  }

  /** Toggles a color from the clickable color block or its icon.
   * @param {HTMLButtonElement} button - The color visibility button
   * @param {Object} color - Palette color metadata
   * @since 0.95.0
   */
  #toggleColorVisibility(button, color) {
    if (!button || button.disabled || !color.id) {return;}

    button.style.textDecoration = 'none';
    button.disabled = true;

    if (button.dataset['state'] == 'shown') {
      button.innerHTML = this.eyeClosed;
      button.dataset['state'] = 'hidden';
      this.templateManager.setColorFiltered(color.id, true);
      this.#animateColorToggleIcon(button, 'hide');
    } else {
      button.dataset['state'] = 'shown';
      this.templateManager.setColorFiltered(color.id, false);
      this.#animateColorToggleIcon(button, 'show');
    }

    this.#syncColorToggleLabel(button, color);
    button.disabled = false;
    button.style.textDecoration = '';
  }

  /** Toggles incorrect-pixel highlighting for one template color.
   * @param {HTMLButtonElement} button - The color highlight button
   * @param {Object} color - Palette color metadata
   * @since 0.97.0
   */
  #toggleIncorrectHighlightColor(button, color) {
    if (!button || button.disabled || !color.id) {return;}

    this.templateManager.toggleIncorrectHighlightColor(color.id);
    this.#syncIncorrectHighlightButtons();
  }

  /** Returns the next-action label for the color highlight button.
   * @param {string} colorName
   * @param {'inactive' | 'incorrect' | 'missing'} mode
   * @returns {string}
   * @since 0.97.0
   */
  #getIncorrectHighlightButtonLabel(colorName, mode) {
    if (mode == 'incorrect') {
      return `Show only transparent pixels that should be ${colorName || 'this color'}.`;
    }
    if (mode == 'missing') {
      return `Stop highlighting ${colorName || 'this color'} pixels.`;
    }
    return `Highlight incorrect ${colorName || 'this color'} pixels.`;
  }

  /** Updates color highlight buttons and color-card state.
   * @since 0.97.0
   */
  #syncIncorrectHighlightButtons() {
    const highlightedColorID = this.templateManager.getIncorrectHighlightColorID?.();
    const highlightedMode = this.templateManager.getIncorrectHighlightMode?.() ?? 'incorrect';
    const buttons = document.querySelectorAll(`#${this.windowID} .bm-filter-color-highlight`);

    for (const button of buttons) {
      const colorElement = button.closest('.bm-filter-color');
      const colorID = Number(colorElement?.dataset['id']);
      const isActive = Number.isFinite(colorID) && (colorID == highlightedColorID);
      const colorName = colorElement?.dataset['name'] || '';
      const mode = isActive ? highlightedMode : 'inactive';
      const label = this.#getIncorrectHighlightButtonLabel(colorName, mode);

      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.dataset['mode'] = mode;
      button.ariaLabel = label;
      button.title = label.replace(/\.$/, '');
      colorElement?.setAttribute('data-highlight', mode);
    }
  }

  /** Animates the eye slash only for direct visibility toggles.
   * @param {HTMLButtonElement} button - The color visibility button
   * @param {'hide' | 'show'} direction - Which slash animation to play
   * @since 0.95.0
   */
  #animateColorToggleIcon(button, direction) {
    if (!button) {return;}

    const animateClass = direction == 'hide' ? 'bm-filter-eye-animate-hide' : 'bm-filter-eye-animate-show';
    button.classList.remove('bm-filter-eye-animate-hide', 'bm-filter-eye-animate-show');

    // Restart the class-driven SVG stroke animation when the same color is toggled repeatedly.
    void button.offsetWidth;

    button.classList.add(animateClass);

    let timeoutID = null;
    const finishAnimation = () => {
      window.clearTimeout(timeoutID);
      button.classList.remove(animateClass);

      if ((direction == 'show') && (button.dataset['state'] == 'shown')) {
        button.innerHTML = this.eyeOpen;
      }
    };

    button.addEventListener('animationend', finishAnimation, {once: true});
    timeoutID = window.setTimeout(finishAnimation, 280);
  }

  /** Makes a color block toggleable by pointer or keyboard.
   * @param {HTMLElement} colorElement - The color block element
   * @param {Object} color - Palette color metadata
   * @since 0.95.0
   */
  #initializeColorBlockToggle(colorElement, color) {
    if (!colorElement || !color.id) {return;}

    colorElement.classList.add('bm-filter-color-toggle');
    colorElement.tabIndex = 0;
    colorElement.setAttribute('role', 'button');

    colorElement.onclick = event => {
      if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) {return;}

      const button = colorElement.querySelector('.bm-filter-color-visibility');
      this.#toggleColorVisibility(button, color);
    };

    colorElement.onkeydown = event => {
      if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) {return;}
      if ((event.key != 'Enter') && (event.key != ' ')) {return;}

      event.preventDefault();
      colorElement.click();
    };
  }

  /** The information about a specific color on the palette.
   * @typedef {Object} ColorData
   * @property {number | string} colorTotal
   * @property {string} colorTotalLocalized
   * @property {number | string} colorCorrect
   * @property {string} colorCorrectLocalized
   * @property {string} colorPercent
   * @property {number} colorIncorrect
   */

  /** Updates the information inside the colors in the color list.
   * If the color list does not exist yet, it returns the color information instead.
   * This assumes the information inside each element is the same between fullscreen and windowed mode.
   * @since 0.90.60
   * @returns {Object.<number, ColorData>}
   */
  updateColorList() {

    this.#calculatePixelStatistics(); // Updates the pixel statistics in the class instance variables

    const colorList = document.querySelector(`#${this.colorListID}`);

    const colorStatistics = {};

    // For each color...
    for (const color of this.palette) {

      // Turns "total" color into a string of a number; "0" if unknown
      const colorTotal = this.allPixelsColor.get(color.id) ?? 0
      const colorTotalLocalized = localizeNumber(colorTotal);
      
      // This will be displayed if the total pixels for this color is zero
      let colorCorrect = 0;
      let colorCorrectLocalized = '0';
      let colorPercent = localizePercent(1);

      // This will be displayed if the total pixels for this color is non-zero
      if (colorTotal != 0) {

        // Determines the correct pixels, or the proper fallback
        colorCorrect = this.allPixelsCorrect.get(color.id) ?? '???';
        if ((typeof colorCorrect != 'number') && (this.tilesLoadedTotal == this.tilesTotal) && !!color.id) {
          colorCorrect = 0;
        }

        colorCorrectLocalized = (typeof colorCorrect == 'string') ? colorCorrect : localizeNumber(colorCorrect);
        colorPercent = isNaN(colorCorrect / colorTotal) ? '???' : localizePercent(colorCorrect / colorTotal);
      }
      // There are four outcomes:
      // 1. The correct pixel count is displayed, because there are correct pixels.
      // 2. There are NO correct pixels, and the color is not transparent, but since all tiles are loaded, we know that the correct pixel count is actually 0.
      // 3. There are NO correct pixels, and the color is not transparent, and not all tiles are loaded. We don't know if there are correct pixels or not, so we display "???" instead.
      // 4. There are NO correct pixels, and the color is transparent, so we display '???' because tracking the "Transparent" color is currently disabled.

      // Incorrect pixels for this color
      const colorIncorrect = parseInt(colorTotal) - parseInt(colorCorrect);

      colorStatistics[color.id] = {
        colorTotal: colorTotal,
        colorTotalLocalized: colorTotalLocalized,
        colorCorrect: colorCorrect,
        colorCorrectLocalized: colorCorrectLocalized,
        colorPercent: colorPercent,
        colorIncorrect: colorIncorrect
      }
    }

    const windowedDragbarTotals = document.querySelector('#bm-filter-windowed-color-totals-dragbar');
    const windowedInlineTotals = document.querySelector('#bm-filter-windowed-color-totals-inline');

    // Returns the number, unlocalized (no space to localize)
    // OR returns the three characters on either end of the string, with the middle replaced with an ellipse.
    // E.g. '1234567' or '123…678'
    const allCorrectCompact = (this.allPixelsCorrectTotal.toString().length > 7) ? this.allPixelsCorrectTotal.toString().slice(0, 2) + '…' + this.allPixelsCorrectTotal.toString().slice(-3) : this.allPixelsCorrectTotal.toString();
    const allTotalCompact = (this.allPixelsTotal.toString().length > 7) ? this.allPixelsTotal.toString().slice(0, 2) + '…' + this.allPixelsTotal.toString().slice(-3) : this.allPixelsTotal.toString();

    if (windowedDragbarTotals) {
      this.updateInnerHTML('#bm-filter-windowed-color-totals-dragbar', `${allCorrectCompact}/${allTotalCompact}`, true);
    }
    if (windowedInlineTotals) {
      this.updateInnerHTML('#bm-filter-windowed-color-totals-inline', `${localizeNumber(this.allPixelsCorrectTotal)} / ${localizeNumber(this.allPixelsTotal)}`, true);
    }

    this.updateInnerHTML('#bm-filter-tile-load', `${localizeNumber(this.tilesLoadedTotal)} / ${localizeNumber(this.tilesTotal)}`);
    this.updateInnerHTML('#bm-filter-tot-correct', localizeNumber(this.allPixelsCorrectTotal));
    this.updateInnerHTML('#bm-filter-tot-total', localizeNumber(this.allPixelsTotal));
    this.updateInnerHTML('#bm-filter-tot-remaining', `${localizeNumber((this.allPixelsTotal || 0) - (this.allPixelsCorrectTotal || 0))} (${localizePercent(((this.allPixelsTotal || 0) - (this.allPixelsCorrectTotal || 0)) / (this.allPixelsTotal || 1))})`);
    this.updateInnerHTML('#bm-filter-tot-completed', `<time datetime="${this.timeRemaining.toISOString().replace(/\.\d{3}Z$/, 'Z')}">${this.timeRemainingLocalized}</time>`);

    // Return early if the color list does not exist.
    // We can't update DOM elements that don't exist, so we exit now.
    if (!colorList) {return colorStatistics;}

    const colors = Array.from(colorList.children);

    // For each color...
    for (const color of colors) {

      const colorID = parseInt(color.dataset['id']);

      // Obtains the data to update then
      const {
        colorCorrect: colorCorrect,
        colorCorrectLocalized: colorCorrectLocalized,
        colorPercent: colorPercent,
        colorTotal: colorTotal,
        colorTotalLocalized: colorTotalLocalized,
        colorIncorrect: colorIncorrect
      } = colorStatistics[colorID];

      // Update the dataset
      color.dataset['correct'] = !Number.isNaN(parseInt(colorCorrect)) ? colorCorrect : '0';
      color.dataset['total'] = colorTotal;
      color.dataset['percent'] = (colorPercent.slice(-1) == '%') ? colorPercent.slice(0, -1) : '0';
      color.dataset['incorrect'] = colorIncorrect || 0;

      // Updates the pixel count if it exists
      const pixelCount = document.querySelector(`#${this.windowID} .bm-filter-color[data-id="${colorID}"] .bm-filter-color-pxl-cnt`);
      if (pixelCount) {
        const isWindowedPixelCount = !!pixelCount.closest(`#${this.windowID}.bm-windowed`);
        const isHorizontalWindowedPixelCount = !!pixelCount.closest(`#${this.windowID}.bm-windowed.bm-filter-layout-horizontal`);
        if (Number(colorTotal) === 0) {
          pixelCount.textContent = '-';
        } else if (isHorizontalWindowedPixelCount) {
          pixelCount.innerHTML = `${colorCorrectLocalized}<br>out of ${colorTotalLocalized}`;
        } else if (isWindowedPixelCount) {
          pixelCount.textContent = `${colorCorrectLocalized} / ${colorTotalLocalized}`;
        } else {
          pixelCount.innerHTML = `${colorCorrectLocalized} /<br>${colorTotalLocalized}`;
        }
      }

      // Updates the pixel description if it exists
      const pixelDesc = document.querySelector(`#${this.windowID} .bm-filter-color[data-id="${colorID}"] .bm-filter-color-pxl-desc`);
      if (pixelDesc) {pixelDesc.innerHTML = `${colorPercent} done<br>${((typeof colorIncorrect == 'number') && !isNaN(colorIncorrect)) ? colorIncorrect : '???'} off`;}
    }

    // Since the dataset has changed, we need to sort again
    // Because if the user wants to sort by pixel count, the order should change
    this.#sortColorList(this.sortPrimary, this.sortSecondary, this.showUnused);
  }

  /** Calculates all pixel statistics used in the color filter.
   * @since 0.90.34
   */
  #calculatePixelStatistics() {

    // Resets pixel totals to 0
    this.tilesLoadedTotal = 0;
    this.tilesTotal = 0;
    this.allPixelsTotal = 0;
    this.allPixelsCorrectTotal = 0;
    this.allPixelsCorrect = new Map();
    this.allPixelsColor = new Map();

    // Sum the pixel totals across all templates.
    // If there is no total for a template, it defaults to zero
    for (const template of this.templateManager.templatesArray) {

      const total = template.pixelCount?.total ?? 0;
      this.allPixelsTotal += total ?? 0; // Sums the pixels placed as "total" per everything

      const colors = template.pixelCount?.colors ?? new Map();

      // Sums the color pixels placed as "total" per color ID
      for (const [colorID, colorPixels] of colors) {
        const _colorPixels = Number(colorPixels) || 0; // Boilerplate
        const allPixelsColorSoFar = this.allPixelsColor.get(colorID) ?? 0; // The total color pixels for this color ID so far, or zero if none counted so far
        this.allPixelsColor.set(colorID, allPixelsColorSoFar + _colorPixels);
      }

      // Object that contains the tiles which contain Maps as correct pixels per tile as the value in the key-value pair
      const correctObject = template.pixelCount?.correct ?? {};

      this.tilesLoadedTotal += Object.keys(correctObject).length; // Sums the total loaded tiles per template
      this.tilesTotal += Object.keys(template.chunked).length; // Sums the total tiles per template

      // Sums the pixels placed as "correct" per color ID
      for (const map of Object.values(correctObject)) { // Per (loaded) tile per template
        for (const [colorID, correctPixels] of map) { // Per color per (loaded) tile per template
          const _correctPixels = Number(correctPixels) || 0; // Boilerplate
          this.allPixelsCorrectTotal += _correctPixels; // Sums the pixels placed as "correct" per everything
          const allPixelsCorrectSoFar = this.allPixelsCorrect.get(colorID) ?? 0; // The total correct pixels for this color ID so far, or zero if none counted so far
          this.allPixelsCorrect.set(colorID, allPixelsCorrectSoFar + _correctPixels);
        }
      }
    }

    console.log(`Tiles loaded: ${this.tilesLoadedTotal} / ${this.tilesTotal}`);

    // If the template is complete, and the pixel count is non-zero, and at least 1 template exists, and all template tiles have been loaded this session...
    if ((this.allPixelsCorrectTotal >= this.allPixelsTotal) && !!this.allPixelsTotal && (this.tilesLoadedTotal == this.tilesTotal)) {
      // Basically, only run if Blue Marble can confirm with 100% certanty that all (>0) templates are complete.
      
      // Create confetti in the color filter window
      const confettiManager = new ConfettiManager();
      confettiManager.createConfetti(document.querySelector(`#${this.windowID}`));
    }

    // Calculates the date & time the user will complete the templates
    this.timeRemaining = new Date(((this.allPixelsTotal - this.allPixelsCorrectTotal) * 30 * 1000) + Date.now());
    this.timeRemainingLocalized = localizeCompactDate(this.timeRemaining);
  }
}
