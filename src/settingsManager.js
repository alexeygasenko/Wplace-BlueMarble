import WindowSettings from "./WindowSettings";

/** SettingsManager class for handling user settings and making them persist between sessions.
 * Logic for {@link WindowSettings} is managed here.
 * @class SettingsManager
 * @since 0.91.11
 * @examples
 * {
 *   "uuid": "497dcba3-ecbf-4587-a2dd-5eb0665e6880",
 *   "telemetry": 1,
 *   "flags": ["willHighlight", "openWindowed"],
 *   "highlight": [[1,0,-1],[1,-1,0],[2,1,0],[1,0,1]],
 *   "filter": [-2,0,4,5,6,29,63]
 * }
 */
export default class SettingsManager extends WindowSettings {

  /** Constructor for the SettingsManager class
   * @param {string} name - The name of the userscript
   * @param {string} version - The version of the userscript
   * @param {Object} userSettings - The user settings as an object
   * @since 0.91.11
   */
  constructor(name, version, userSettings) {
    super(name, version); // Executes WindowSettings constructor
    
    this.userSettings = userSettings; // User settings as an Object

    this.lastUpdateTime = 0; // When this unix timestamp is within the last 5 seconds, we should save this.userSettings to storage
  }

  // This is one of the most insane OOP setups I have ever laid my eyes on

  /** Builds the "highlight" category of the settings window
   * @since 0.91.18
   * @see WindowSettings#buildHighlight
   */
  buildHighlight() {

    // Constructs the category and adds it to the window
    this.window = this.addDiv({'class': 'bm-container'})
      .addHeader(2, {'textContent': 'Pixel Highlight'}).buildElement()
      .addHr().buildElement()
      .addDiv({'style': 'margin-left: 1.5ch;'})
        .addP({'id': 'bm-highlight-grid-label', 'textContent': 'Create a custom pattern:'}).buildElement()
        .addDiv({'class': 'bm-highlight-grid', 'role': 'group', 'aria-labelledby': 'bm-highlight-grid-label'})
          .addButton({'data-status': 'Disabled', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [-1, -1]);}).buildElement()
          .addButton({'data-status': 'Incorrect', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [0, -1]);}).buildElement()
          .addButton({'data-status': 'Disabled', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [1, -1]);}).buildElement()
          .addButton({'data-status': 'Incorrect', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [-1, 0]);}).buildElement()
          .addButton({'data-status': 'Template', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [0, 0]);}).buildElement()
          .addButton({'data-status': 'Incorrect', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [1, 0]);}).buildElement()
          .addButton({'data-status': 'Disabled', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [-1, 1]);}).buildElement()
          .addButton({'data-status': 'Incorrect', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [0, 1]);}).buildElement()
          .addButton({'data-status': 'Disabled', 'aria-label': 'Sub-pixel disabled'}, (instance, button) => {button.onclick = () => this.#updateHighlightSettings(button, [1, 1]);}).buildElement()
        .buildElement()
      .buildElement()
    .buildElement();

    // TODO: First-time load of highlight settings from user storage
  }

  /** Updates the display of the highlight buttons in the settings window.
   * Additionally, it will update user settings with the new selection.
   * @param {HTMLButtonElement} button - The button that was pressed
   * @param {Array<number, number>} coords - The relative coordinates of the button
   */
  #updateHighlightSettings(button, coords) {

    console.log(coords);

    button.disabled = true; // Disabled the button until we are done

    const status = button.dataset['status']; // Obtains the current status of the button

    /** Obtains the old highlight storage, or sets it to default. @type {Array<number[]>} */
    const userStorageOld = this.userSettings?.highlight || [[1, 0, 1], [2, 0, 0], [1, -1, 0], [1, 1, 0], [1, 0, -1]];

    let userStorageChange = [2, 0, 0]; // The new change to the user storage

    const userStorageNew = userStorageOld; // The old storage with the new change

    console.log(userStorageOld);

    // For each different type of status...
    switch (status) {

      // If the button was in the "Disabled" state
      case 'Disabled':

        // Change to "Incorrect"
        button.dataset['status'] = 'Incorrect';
        button.ariaLabel = 'Sub-pixel incorrect';
        userStorageChange = [1, ...coords];
        break;
      
      // If the button was in the "Incorrect" state
      case 'Incorrect':

        // Change to "Template"
        button.dataset['status'] = 'Template';
        button.ariaLabel = 'Sub-pixel template';
        userStorageChange = [2, ...coords];
        break;
      
      // If the button was in the "Template" state
      case 'Template':

        // Change to "Disabled"
        button.dataset['status'] = 'Disabled';
        button.ariaLabel = 'Sub-pixel disabled';
        userStorageChange = [0, ...coords];
        break;
    }

    console.log(userStorageChange);

    // Finds the index of the pixel to change
    const indexOfChange = userStorageOld.findIndex(([, x, y]) => ((x == userStorageChange[1]) && (y == userStorageChange[2])));

    console.log(indexOfChange);

    // If the new sub-pixel state is NOT disabled
    if (userStorageChange[0] != 0) {

      // If a sub-pixel was found...
      if (indexOfChange != -1) {
        userStorageNew[indexOfChange] = userStorageChange;
      } else {
        userStorageNew.push(userStorageChange);
      }
    } else if (indexOfChange != -1) {
      // Else, it is disabled. We want to remove it if it exists.
      userStorageNew.splice(indexOfChange, 1); // Removes 1 index from the array at the index of the pixel change
    }

    console.log(userStorageNew);

    this.userSettings['highlight'] = userStorageNew;
    // TODO: Add timer update here

    button.disabled = false; // Reenables the button since we are done
  }
}