import SettingsManager from "./settingsManager";
import Template from "./Template";
import { base64ToUint8, colorpaletteForBlueMarble, consoleError, consoleLog, consoleWarn, localizeNumber, numberToEncoded, sleep, viewCanvasInNewTab } from "./utils";
import WindowMain from "./WindowMain";
import WindowWizard from "./WindowWizard";

/** Manages the template system.
 * This class handles all external requests for template modification, creation, and analysis.
 * It serves as the central coordinator between template instances and the user interface.
 * @class TemplateManager
 * @since 0.55.8
 * @example
 * // JSON structure for a template made in schema version 2.0.0.
 * // Note: The pixel "colors" Object contains more than 2 keys.
 * // Note: The template tiles are stored as base64 PNG images.
 * {
 *   "whoami": "BlueMarble",
 *   "scriptVersion": "1.13.0",
 *   "schemaVersion": "2.0.0",
 *   "templates": {
 *     "0 $Z": {
 *       "name": "My Template",
 *       "enabled": true,
 *       "pixels": {
 *         "total": 40399,
 *         "colors": {
 *           "-2": 40000,
 *           "0": 399
 *         }
 *       }
 *       "tiles": {
 *         "1231,0047,183,593": "iVBORw0KGgoAAAANSUhEUgAA",
 *         "1231,0048,183,000": "AAAFCAYAAACNbyblAAAAHElEQVQI12P4"
 *       }
 *     },
 *     "1 $Z": {
 *       "name": "My Template",
 *       "URL": "https://github.com/SwingTheVine/Wplace-BlueMarble/blob/main/dist/assets/Favicon.png",
 *       "URLType": "template",
 *       "enabled": false,
 *       "pixels": {
 *         "total": 40399,
 *         "colors": {
 *           "-2": 40000,
 *           "0": 399
 *         }
 *       }
 *       "tiles": {
 *         "375,1846,276,188": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
 *         "376,1846,000,188": "data:image/png;AAAFCAYAAACNbyblAAAAHElEQVQI12P4"
 *       }
 *     }
 *   }
 * }
 * @example
 * // JSON structure for a template made in schema version 1.0.0.
 * // Note: The template tiles are stored as base64 PNG images.
 * {
 *   "whoami": "BlueMarble",
 *   "scriptVersion": "1.13.0",
 *   "schemaVersion": "1.0.0",
 *   "templates": {
 *     "0 $Z": {
 *       "name": "My Template",
 *       "enabled": true,
 *       "coords": "2000, 230, 45, 201"
 *       "palette": {
 *         "0,0,0": {
 *            "count": 123,
 *            "enabled": true
 *         },
 *         "255,255,255": {
 *            "count": 1315,
 *            "enabled": false
 *         }
 *       }
 *       "tiles": {
 *         "1231,0047,183,593": "iVBORw0KGgoAAAANSUhEUgAA",
 *         "1231,0048,183,000": "AAAFCAYAAACNbyblAAAAHElEQVQI12P4"
 *       }
 *     }
 *   }
 * }
 */
export default class TemplateManager {

  /** The constructor for the {@link TemplateManager} class.
   * @param {string} name - The name of the userscript
   * @param {string} version - The version of the userscript (SemVer as string)
   * @since 0.55.8
   */
  constructor(name, version) {

    // Meta
    this.name = name; // Name of userscript
    this.version = version; // Version of userscript
    this.windowMain = null; // The main instance of the Overlay class
    this.settingsManager = null; // The main instance of the SettingsManager class
    this.schemaVersion = '2.0.0'; // Version of JSON schema
    this.userID = null; // The ID of the current user
    this.encodingBase = '!#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~'; // Characters to use for encoding/decoding
    this.tileSize = 1000; // The number of pixels in a tile. Assumes the tile is square
    this.drawMult = 3; // The enlarged size for each pixel. E.g. when "3", a 1x1 pixel becomes a 1x1 pixel inside a 3x3 area. MUST BE ODD
    this.paletteTolerance = 3; // Tolerance for how close an RGB value has to be in order to be considered a color. A tolerance of "3" means the sum of the RGB can be up to 3 away from the actual value.
    this.paletteBM = colorpaletteForBlueMarble(this.paletteTolerance); // Retrieves the color palette BM will use as an Object containing multiple Uint32Arrays
    
    // Template
    this.template = null; // The template image.
    this.templateState = ''; // The state of the template ('blob', 'proccessing', 'template', etc.)
    /** An Array of Template classes @type {Array<Template>} */
    this.templatesArray = []; // All Template instnaces currently loaded (Template)
    this.templatesJSON = null; // All templates currently loaded (JSON)
    this.templatesShouldBeDrawn = true; // Should ALL templates be drawn to the canvas?
    this.templatePixelsCorrect = null; // An object where the keys are the tile coords, and the values are Maps (BM palette color IDs) containing the amount of correctly placed pixels for that tile in this template
    /** Will contain all color ID's to filter @type {Map<number, boolean>} */
    this.shouldFilterColor = new Map();
    this.highlightIncorrectColorID = null; // Restricts incorrect-pixel highlighting to one template color when set
    this.highlightIncorrectMode = 'incorrect'; // Either "incorrect" or "missing" when color-specific highlighting is active
  }

  /** Updates the stored instance of the main window.
   * @param {WindowMain} windowMain - The main window instance
   * @since 0.91.54
   */
  setWindowMain(windowMain) {
    this.windowMain = windowMain;
  }

  /** Updates the stored instance of the SettingsManager.
   * @param {SettingsManager} settingsManager - The settings manager instance
   * @since 0.91.54
   */
  setSettingsManager(settingsManager) {
    this.settingsManager = settingsManager;
    this.#restoreFilteredColorsFromSettings();
  }

  /** Restores hidden colors from persisted user settings.
   * @since 0.92.1
   */
  #restoreFilteredColorsFromSettings() {
    const storedFilter = this.settingsManager?.userSettings?.filter;
    const filteredColors = Array.isArray(storedFilter) ? storedFilter : [];

    this.shouldFilterColor.clear();

    for (const colorID of filteredColors) {
      const parsedColorID = Number(colorID);
      if (!Number.isFinite(parsedColorID)) {continue;}
      this.shouldFilterColor.set(parsedColorID, true);
    }
  }

  /** Persists hidden colors to user settings storage.
   * @since 0.92.1
   */
  #persistFilteredColors() {
    if (!this.settingsManager) {return;}

    this.settingsManager.userSettings.filter = Array.from(this.shouldFilterColor.keys())
      .map(colorID => Number(colorID))
      .filter(colorID => Number.isFinite(colorID))
      .sort((a, b) => a - b);

    void this.settingsManager.saveUserStorageNow();
  }

  /** Updates whether a palette color should be hidden on the canvas.
   * @param {number} colorID
   * @param {boolean} shouldHide
   * @since 0.92.1
   */
  setColorFiltered(colorID, shouldHide) {
    const parsedColorID = Number(colorID);
    if (!Number.isFinite(parsedColorID)) {return;}

    if (shouldHide) {
      this.shouldFilterColor.set(parsedColorID, true);
    } else {
      this.shouldFilterColor.delete(parsedColorID);
    }

    this.#persistFilteredColors();
  }

  /** Returns the color currently used to restrict incorrect-pixel highlighting.
   * @returns {number | null}
   * @since 0.97.0
   */
  getIncorrectHighlightColorID() {
    return this.highlightIncorrectColorID;
  }

  /** Returns the active color-specific highlight mode.
   * @returns {'incorrect' | 'missing'}
   * @since 0.97.0
   */
  getIncorrectHighlightMode() {
    return this.highlightIncorrectMode;
  }

  /** Restricts incorrect-pixel highlighting to one template color, or clears the restriction.
   * @param {number | null} colorID
   * @param {'incorrect' | 'missing'} [mode='incorrect']
   * @returns {number | null}
   * @since 0.97.0
   */
  setIncorrectHighlightColor(colorID, mode = 'incorrect') {
    if ((colorID === null) || (typeof colorID == 'undefined')) {
      this.highlightIncorrectColorID = null;
      this.highlightIncorrectMode = 'incorrect';
      return this.highlightIncorrectColorID;
    }

    const parsedColorID = Number(colorID);
    if (!Number.isFinite(parsedColorID) || (parsedColorID == 0)) {return this.highlightIncorrectColorID;}

    this.highlightIncorrectColorID = parsedColorID;
    this.highlightIncorrectMode = mode == 'missing' ? 'missing' : 'incorrect';
    return this.highlightIncorrectColorID;
  }

  /** Cycles the color currently used to restrict incorrect-pixel highlighting.
   * The cycle is: off -> all incorrect pixels -> missing transparent pixels -> off.
   * @param {number} colorID
   * @returns {{colorID: number | null, mode: 'incorrect' | 'missing'}}
   * @since 0.97.0
   */
  toggleIncorrectHighlightColor(colorID) {
    const parsedColorID = Number(colorID);
    if (!Number.isFinite(parsedColorID) || (parsedColorID == 0)) {
      return {colorID: this.highlightIncorrectColorID, mode: this.highlightIncorrectMode};
    }

    if (this.highlightIncorrectColorID != parsedColorID) {
      this.setIncorrectHighlightColor(parsedColorID, 'incorrect');
    } else if (this.highlightIncorrectMode == 'incorrect') {
      this.setIncorrectHighlightColor(parsedColorID, 'missing');
    } else {
      this.setIncorrectHighlightColor(null);
    }

    return {colorID: this.highlightIncorrectColorID, mode: this.highlightIncorrectMode};
  }

  /** Creates the JSON object to store templates in
   * @returns {{ whoami: string, scriptVersion: string, schemaVersion: string, templates: Object }} The JSON object
   * @since 0.65.4
   */
  async createJSON() {
    return {
      "whoami": this.name.replace(' ', ''), // Name of userscript without spaces
      "scriptVersion": this.version, // Version of userscript
      "schemaVersion": this.schemaVersion, // Version of JSON schema
      "templates": {} // The templates
    };
  }

  /** Creates the template from the inputed file blob
   * @param {File} blob - The file blob to create a template from
   * @param {string} name - The display name of the template
   * @param {Array<number, number, number, number>} coords - The coordinates of the top left corner of the template
   * @since 0.65.77
   */
  async createTemplate(blob, name, coords) {

    // Creates the JSON object if it does not already exist
    if (!this.templatesJSON) {this.templatesJSON = await this.createJSON(); console.log(`Creating JSON...`);}

    this.windowMain.handleDisplayStatus(`Creating template at ${coords.join(', ')}...`);

    // Creates a new template instance
    const template = new Template({
      displayName: name,
      sortID: 0, // Object.keys(this.templatesJSON.templates).length || 0, // Uncomment this to enable multiple templates (1/2)
      authorID: numberToEncoded(this.userID || 0, this.encodingBase),
      file: blob,
      coords: coords
    });

    // Does the user want to skip transparent tiles while creating templates?
    const shouldSkipTransTiles = !this.settingsManager?.userSettings?.flags?.includes('hl-noSkip');

    // Does the user want to aggressively skip transparent tiles while creating templates?
    const shouldAggSkipTransTiles = this.settingsManager?.userSettings?.flags?.includes('hl-agSkip');

    console.log(`Should Skip: ${shouldSkipTransTiles}; Should Agg Skip: ${shouldAggSkipTransTiles}`);
    
    const { templateTiles, templateTilesBuffers } = await template.createTemplateTiles(this.tileSize, this.paletteBM, shouldSkipTransTiles, shouldAggSkipTransTiles); // Chunks the tiles
    
    template.chunked = templateTiles; // Stores the chunked tile bitmaps

    // Converts total pixel Object/Map variables into JSON-ready format
    const _pixels = { "total": template.pixelCount.total, "colors": Object.fromEntries(template.pixelCount.colors) }

    // Appends a child into the templates object
    // The child's name is the number of templates already in the list (sort order) plus the encoded player ID
    this.templatesJSON.templates[`${template.sortID} ${template.authorID}`] = {
      "name": template.displayName, // Display name of template
      "coords": coords.join(', '), // The coords of the template
      "enabled": true,
      "pixels": _pixels, // The total pixels in the template
      "tiles": templateTilesBuffers // Stores the chunked tile buffers
    };

    this.templatesArray = []; // Remove this to enable multiple templates (2/2)
    this.templatesArray.push(template); // Pushes the Template object instance to the Template Array

    this.windowMain.handleDisplayStatus(`Template created at ${coords.join(', ')}!`);

    console.log(Object.keys(this.templatesJSON.templates).length);
    console.log(this.templatesJSON);
    console.log(this.templatesArray);
    console.log(JSON.stringify(this.templatesJSON));

    await this.#storeTemplates();
  }

  /** Generates a {@link Template} class instance from the JSON object template.
   * {@link createTemplate()} will create a class instance and save to template storage.
   * `#loadTemplate()` will create a class instance without saving to the template storage.
   * @param {Object} template - The template to load
   * @since 0.88.504
   */
  #loadTemplate(templateObject) {

    // Calculates the pixel count
    const pixelCount = {
      total: templateObject.pixels?.total,
      colors: new Map(Object.entries(templateObject.pixels?.colors || {}).map(([key, value]) => [Number(key), value]))
    };

    // Creates the template
    const template = new Template({
      displayName: templateObject.displayName,
      sortID: Object.keys(this.templatesJSON.templates).length || 0,
      authorID: numberToEncoded(this.userID || 0, this.encodingBase),
      pixelCount: pixelCount,
      chunked: templateObject.tiles
    });

    template.calculateCoordsFromChunked(); // Updates `Template.coords`

    this.templatesArray.push(template);
  }

  /** Stores the JSON object of the loaded templates into TamperMonkey (GreaseMonkey) storage.
   * @since 0.72.7
   */
  async #storeTemplates() {
    GM.setValue('bmTemplates', JSON.stringify(this.templatesJSON));
  }

  /** Deletes a template from the JSON object.
   * Also delete's the corrosponding {@link Template} class instance
   */
  deleteTemplate() {

  }

  /** Disables the template from view
   */
  async disableTemplate() {

    // Creates the JSON object if it does not already exist
    if (!this.templatesJSON) {this.templatesJSON = await this.createJSON(); console.log(`Creating JSON...`);}


  }

  /** Downloads all templates loaded.
   * @since 0.88.499
   */
  async downloadAllTemplates() {

    consoleLog(`Downloading all templates...`);

    console.log(this.templatesArray);

    // For each template loaded...
    for (const template of this.templatesArray) {

      await this.downloadTemplate(template); // Downloads the template

      await sleep(500); // Avoids download throttling from the browser
    }
  }

  /** Downloads all templates from Blue Marble's template storage.
   * @since 0.88.474
   */
  async downloadAllTemplatesFromStorage() {

    // Templates in user storage
    const templates = JSON.parse(GM_getValue('bmTemplates', '{}'))?.templates;

    console.log(templates);

    // If there is at least one template loaded...
    if (Object.keys(templates).length > 0) {

      // For each template loaded...
      for (const [key, template] of Object.entries(templates)) {

        // If the template is a direct child of the templates Object...
        if (templates.hasOwnProperty(key)) {
          
          // Downloads the template using a dummy Template instance
          await this.downloadTemplate(new Template({
            displayName: template.name,
            sortID: key.split(' ')?.[0],
            authorID: key.split(' ')?.[1],
            chunked: template.tiles
          }));

          await sleep(500); // Avoids download throttling from the browser
        }
      }
    }
  }

  /** Downloads the template passed-in.
   * @param {Template} template - The template class instance to download
   * @since 0.88.499
   */
  async downloadTemplate(template) {

    template.calculateCoordsFromChunked(); // Updates `Template.coords`

    // Constructs the file name to download as
    const templateFileName = `${template.coords.join('-')}_${template.displayName.replaceAll(' ', '-')}`;

    // Converts `Template.chunked` to a blob
    const blob = await this.convertTemplateToBlob(template);

    // Downloads the template
    await GM.download({
      url: URL.createObjectURL(blob),
      name: templateFileName + '.png',
      conflictAction: 'uniquify',
      onload: () => {consoleLog(`Download of template '${templateFileName}' complete!`);},
      onerror: (error, details) => {consoleError(`Download of template '${templateFileName}' failed because ${error}! Details: ${details}`);},
      ontimeout: () => {consoleWarn(`Download of template '${templateFileName}' has timed out!`);}
    });
  }

  /** Converts a Template class instance into a Blob. 
   * Specifically, this takes `Template.chunked` and converts it to a Blob.
   * @since 0.88.504
   * @returns {Promise<Blob>} A Promise of a Blob PNG image of the template
   */
  async convertTemplateToBlob(template) {

    console.log(template);

    const templateTiles64 = template.chunked; // Tiles of template image as base 64

    // Sorts the keys of the tiles (Object -> Array)
    const templateTileKeysSorted = Object.keys(templateTiles64).sort();

    // Turns the base64 tiles into Images
    const templateTilesImageSorted = await Promise.all(templateTileKeysSorted.map(tileKey => convertBase64ToImage(templateTiles64[tileKey])));

    // Absolute pixel coordinates for smallest (top left) and largest (bottom right) pixel coordinates
    let absoluteSmallestX = Infinity;
    let absoluteSmallestY = Infinity;
    let absoluteLargestX = 0;
    let absoluteLargestY = 0;

    // Calculates the minimum and maximum (X, Y) absolute coordinates
    templateTileKeysSorted.forEach((key, index) => {

      // Deconstructs the tile coordinates
      const [tileX, tileY, pixelX, pixelY] = key.split(',').map(Number);

      const tileImage = templateTilesImageSorted[index]; // Obtains the image for this tile

      // Calculates the absolute pixel coordinates for this tile
      const absoluteX = (tileX * this.tileSize) + pixelX;
      const absoluteY = (tileY * this.tileSize) + pixelY;

      // Record the smallest/largest absolute coordinates if and only if this tile is the smallest/largest. Otherwise, use previous best
      absoluteSmallestX = Math.min(absoluteSmallestX, absoluteX);
      absoluteSmallestY = Math.min(absoluteSmallestY, absoluteY);
      absoluteLargestX = Math.max(absoluteLargestX, absoluteX + (tileImage.width / this.drawMult));
      absoluteLargestY = Math.max(absoluteLargestY, absoluteY + (tileImage.height / this.drawMult));
    })

    console.log(`Absolute coordinates: (${absoluteSmallestX}, ${absoluteSmallestY}) and (${absoluteLargestX}, ${absoluteLargestY})`);

    // Calculates the template/canvas width and height
    const templateWidth = absoluteLargestX - absoluteSmallestX;
    const templateHeight = absoluteLargestY - absoluteSmallestY;
    const canvasWidth = templateWidth * this.drawMult;
    const canvasHeight = templateHeight * this.drawMult;

    console.log(`Template Width: ${templateWidth}\nTemplate Height: ${templateHeight}\nCanvas Width: ${canvasWidth}\nCanvas Height: ${canvasHeight}`);

    // Creates a new canvas the size of the template
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    // For each tile...
    templateTileKeysSorted.forEach((key, index) => {

      // Deconstructs the tile coordinates
      const [tileX, tileY, pixelX, pixelY] = key.split(',').map(Number);

      const tileImage = templateTilesImageSorted[index]; // Obtains the image for this tile

      // Calculates the absolute pixel coordinates for this tile
      const absoluteX = (tileX * this.tileSize) + pixelX;
      const absoluteY = (tileY * this.tileSize) + pixelY;

      console.log(`Drawing tile (${tileX}, ${tileY}, ${pixelX}, ${pixelY}) (${absoluteX}, ${absoluteY}) at (${absoluteX - absoluteSmallestX}, ${absoluteY - absoluteSmallestY}) on the canvas...`);

      // Draws the tile to the canvas
      context.drawImage(tileImage, (absoluteX - absoluteSmallestX) * this.drawMult, (absoluteY - absoluteSmallestY) * this.drawMult, tileImage.width, tileImage.height);
    })

    // The expanded template is now on the canvas

    context.globalCompositeOperation = "destination-over"; // Draw under the canvas (new draws only show in place of transparent pixels)

    // Extends the template vertically to create columns
    context.drawImage(canvas, 0, -1);
    context.drawImage(canvas, 0, 1);

    // Extends the columns horizontally to become a solid template
    context.drawImage(canvas, -1, 0);
    context.drawImage(canvas, 1, 0);

    const smallCanvas = new OffscreenCanvas(templateWidth, templateHeight);
    const smallContext = smallCanvas.getContext("2d");

    smallContext.imageSmoothingEnabled = false; // Forces nearest neighbor scaling algorithm

    // Downscale the template
    smallContext.drawImage(
      canvas,
      0, 0, templateWidth * this.drawMult, templateHeight * this.drawMult, // Source image size
      0, 0, templateWidth, templateHeight // Small canvas size
    );

    // Returns a blob
    return smallCanvas.convertToBlob({ type: 'image/png' });

    /** Turns a chunked base 64 string template tile into an Image template tile
     * @param {string} base64 - Base64 string of image data (without URI header)
     * @since 0.88.474
     * @returns {Promise} Promise to load a new Image()
     */
    function convertBase64ToImage(base64) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = "data:image/png;base64," + base64;
      });
    }
  }

  /** Draws all templates on the specified tile.
   * This method handles the rendering of template overlays on individual tiles.
   * @param {File} tileBlob - The pixels that are placed on a tile
   * @param {Array<number>} tileCoords - The tile coordinates [x, y]
   * @since 0.65.77
   */
  async drawTemplateOnTile(tileBlob, tileCoords) {

    // Returns early if no templates should be drawn
    if (!this.templatesShouldBeDrawn) {return tileBlob;}

    const drawSize = this.tileSize * this.drawMult; // Calculate draw multiplier for scaling

    // Format tile coordinates with proper padding for consistent lookup
    tileCoords = tileCoords[0].toString().padStart(4, '0') + ',' + tileCoords[1].toString().padStart(4, '0');

    console.log(`Searching for templates in tile: "${tileCoords}"`);

    const templateArray = this.templatesArray; // Stores a copy for sorting
    console.log(templateArray);

    // Sorts the array of Template class instances. 0 = first = lowest draw priority
    templateArray.sort((a, b) => {return a.sortID - b.sortID;});

    console.log(templateArray);

    // Retrieves the relavent template tile blobs
    const templatesToDraw = templateArray
      .map(template => {
        const matchingTiles = Object.keys(template.chunked).filter(tile =>
          tile.startsWith(tileCoords)
        );

        if (matchingTiles.length === 0) {return null;} // Return null when nothing is found

        // Retrieves the blobs of the templates for this tile
        const matchingTileBlobs = matchingTiles.map(tile => {

          const coords = tile.split(','); // [x, y, x, y] Tile/pixel coordinates
          
          return {
            instance: template,
            bitmap: template.chunked[tile],
            chunked32: template.chunked32?.[tile],
            tileCoords: [coords[0], coords[1]],
            pixelCoords: [coords[2], coords[3]]
          }
        });

        return matchingTileBlobs?.[0];
      })
    .filter(Boolean);

    console.log(templatesToDraw);

    const templateCount = templatesToDraw?.length || 0; // Number of templates to draw on this tile
    console.log(`templateCount = ${templateCount}`);

    if (templateCount > 0) {
      
      // Calculate total pixel count for templates actively being displayed in this tile
      const totalPixels = templateArray
        .filter(template => {
          // Filter templates to include only those with tiles matching current coordinates
          // This ensures we count pixels only for templates actually being rendered
          const matchingTiles = Object.keys(template.chunked).filter(tile =>
            tile.startsWith(tileCoords)
          );
          return matchingTiles.length > 0;
        })
        .reduce((sum, template) => sum + (template.pixelCount.total || 0), 0);
      
      // Format pixel count with locale-appropriate thousands separators for better readability
      // Examples: "1,234,567" (US), "1.234.567" (DE), "1 234 567" (FR)
      const pixelCountFormatted = localizeNumber(totalPixels);
      
      // Display status information about the templates being rendered
      this.windowMain.handleDisplayStatus(
        `Displaying ${templateCount} template${templateCount == 1 ? '' : 's'}.\nTotal pixels: ${pixelCountFormatted}`
      );
    } else {
      //this.overlay.handleDisplayStatus(`Displaying ${templateCount} templates.`);
      this.windowMain.handleDisplayStatus(`Sleeping\nVersion: ${this.version}`);
      return tileBlob; // No templates are on this tile. Return the original tile early
    }
    
    const tileBitmap = await createImageBitmap(tileBlob);

    const canvas = new OffscreenCanvas(drawSize, drawSize);
    const context = canvas.getContext('2d');

    context.imageSmoothingEnabled = false; // Nearest neighbor

    // Tells the canvas to ignore anything outside of this area
    context.beginPath();
    context.rect(0, 0, drawSize, drawSize);
    context.clip();

    context.clearRect(0, 0, drawSize, drawSize); // Draws transparent background
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize); // Draw tile to canvas

    const tileBeforeTemplates = context.getImageData(0, 0, drawSize, drawSize);
    const tileBeforeTemplates32 = new Uint32Array(tileBeforeTemplates.data.buffer);

    // Obtains the highlight pattern
    const highlightPattern = this.settingsManager?.userSettings?.highlight || [[2, 0, 0]];
    // The code demands that a highlight pattern always exists.
    // Therefore, to disable highlighting, the highlight pattern is `[[2, 0, 0]]`.
    // `[[2, 0, 0]]` is special, and will skip the highlighting code altogether.
    // As a side-effect, the template will always display while enabled.
    // You can't disable all sub-pixels in order to hide the template.

    // Contains the first index of the highlight pattern.
    const highlightPatternIndexZero = highlightPattern?.[0];
    // This is so we can later determine if the pattern is the preset "None"

    // Should highlighting be disabled?
    const highlightDisabled = (
      (highlightPattern?.length == 1)
      && (highlightPatternIndexZero?.[0] == 2)
      && (highlightPatternIndexZero?.[1] == 0)
      && (highlightPatternIndexZero?.[2] == 0)
    )
    const incorrectHighlightColorID = this.getIncorrectHighlightColorID();
    const hasIncorrectHighlightColor = Number.isFinite(incorrectHighlightColorID);
    const incorrectHighlightMode = this.getIncorrectHighlightMode();
    const fallbackHighlightPattern = [[1, 0, 1], [2, 0, 0], [1, -1, 0], [1, 1, 0], [1, 0, -1]];
    const effectiveHighlightPattern = (highlightDisabled && hasIncorrectHighlightColor) ? fallbackHighlightPattern : highlightPattern;
    
    // For each template in this tile, draw them.
    for (const template of templatesToDraw) {
      console.log(`Template:`);
      console.log(template);

      const templateHasErased = !!template.instance.pixelCount?.colors?.get(-1); // Does this template have Erased (#deface) pixels?

      // Obtains the template (for only this tile) as a Uint32Array
      let templateBeforeFilter32 = template.chunked32.slice();
      // Remove the `.slice()` and colors, once disabled, can never be re-enabled

      const coordXtoDrawAt = Number(template.pixelCoords[0]) * this.drawMult;
      const coordYtoDrawAt = Number(template.pixelCoords[1]) * this.drawMult;

      // Draws the template to the tile if there are no colors to filter, and there are no Erased pixels
      if ((this.shouldFilterColor.size == 0) && !templateHasErased) {
        context.drawImage(template.bitmap, coordXtoDrawAt, coordYtoDrawAt);
      }

      // If we failed to get the template for this tile, we use a shoddy, buggy, failsafe
      if (!templateBeforeFilter32) {
        const templateBeforeFilter = context.getImageData(coordXtoDrawAt, coordYtoDrawAt, template.bitmap.width, template.bitmap.height);
        templateBeforeFilter32 = new Uint32Array(templateBeforeFilter.data.buffer);
      }

      // Take the pre-filter template ImageData + the pre-filter tile ImageData, and use that to calculate the correct pixels
      const timer = Date.now();
      const {
        correctPixels: pixelsCorrect,
        filteredTemplate: templateAfterFilter
      } = this.#calculateCorrectPixelsOnTile_And_FilterTile({
        tile: tileBeforeTemplates32,
        template: templateBeforeFilter32,
        templateInfo: [coordXtoDrawAt, coordYtoDrawAt, template.bitmap.width, template.bitmap.height],
        highlightPattern: effectiveHighlightPattern,
        highlightDisabled: highlightDisabled && !hasIncorrectHighlightColor,
        highlightColorID: incorrectHighlightColorID,
        highlightMode: incorrectHighlightMode
      });

      let pixelsCorrectTotal = 0;
      const transparentColorID = 0;

      // For each color with correct pixels placed for this template...
      for (const [color, total] of pixelsCorrect) {

        if (color == transparentColorID) {continue;} // Skip Transparent color

        pixelsCorrectTotal += total; // Add the current total for this color to the summed total of all correct
      }

      // If there are colors to filter, then we draw the filtered template on the canvas
      // Or, if there are Erased (#deface) pixels, then we draw the modified template on the canvas
      // Or, if the user has enabled highlighting, then we draw the modified template on the canvas
      if ((this.shouldFilterColor.size != 0) || templateHasErased || !highlightDisabled || hasIncorrectHighlightColor) {
        console.log('Colors to filter: ', this.shouldFilterColor);
        //context.putImageData(new ImageData(new Uint8ClampedArray(templateAfterFilter.buffer), template.bitmap.width, template.bitmap.height), coordXtoDrawAt, coordYtoDrawAt);
        context.drawImage(await createImageBitmap(new ImageData(new Uint8ClampedArray(templateAfterFilter.buffer), template.bitmap.width, template.bitmap.height)), coordXtoDrawAt, coordYtoDrawAt);
      }

      console.log(`Finished calculating correct pixels & filtering colors for the tile ${tileCoords} in ${(Date.now() - timer) / 1000} seconds!\nThere are ${pixelsCorrectTotal} correct pixels.`);

      // If "correct" does not exist as a key of the object "pixelCount", we create it
      if (typeof template.instance.pixelCount['correct'] == 'undefined') {
        template.instance.pixelCount['correct'] = {};
      }

      // Adds the correct pixel Map to the template instance
      template.instance.pixelCount['correct'][tileCoords] = pixelsCorrect;
    }

    return await canvas.convertToBlob({ type: 'image/png' });
  }

  /** Imports the JSON object, and appends it to any JSON object already loaded
   * @param {string} json - The JSON string to parse
   */
  async importJSON(json) {

    console.log(`Importing JSON...`);
    console.log(json);

    // If the passed in JSON is a Blue Marble template object...
    if (json?.whoami == 'BlueMarble') {
      await this.#parseBlueMarble(json); // ...parse the template object as Blue Marble
    }
  }

  /** Parses the Blue Marble JSON object
   * @param {string} json - The JSON string to parse
   * @since 0.72.13
   */
  async #parseBlueMarble(json) {

    console.log(`Parsing BlueMarble...`);

    const templates = json.templates;

    console.log(`BlueMarble length: ${Object.keys(templates).length}`);

    const schemaVersion = json?.schemaVersion;
    const schemaVersionArray = schemaVersion.split(/[-\.\+]/); // SemVer -> string[]
    const schemaVersionBleedingEdge = this.schemaVersion.split(/[-\.\+]/); // SemVer -> string[]
    const scriptVersion = json?.scriptVersion;

    console.log(`BlueMarble Template Schema: ${schemaVersion}; Script Version: ${scriptVersion}`);

    // If MAJOR version is up-to-date...
    if (schemaVersionArray[0] == schemaVersionBleedingEdge[0]) {

      // If MINOR version is NOT up-to-date...
      if (schemaVersionArray[1] != schemaVersionBleedingEdge[1]) {

        // Spawns a new Template Wizard
        const windowWizard = new WindowWizard(this.name, this.version, this.schemaVersion, this);
        windowWizard.buildWindow();
      }

      // Load using the latest schema loader. It will be fine, probably...
      this.templatesArray = await loadSchema({
        tileSize: this.tileSize,
        drawMult: this.drawMult,
        templatesArray: this.templatesArray
      });

    } else if (schemaVersionArray[0] < schemaVersionBleedingEdge[0]) {
      // Else if the MAJOR verison is out-of-date

      // Spawns a new Template Wizard
      const windowWizard = new WindowWizard(this.name, this.version, this.schemaVersion, this);
      windowWizard.buildWindow();
    
    } else {
      // We don't know what the schema is. Unsupported?

      this.windowMain.handleDisplayError(`Template version ${schemaVersion} is unsupported.\nUse Blue Marble version ${scriptVersion} or load a new template.`);
    }

    /** Loads schema of Blue Marble template storage
     * @param {Object} params - Object containing parameters
     * @param {number} params.tileSize - Size of tile
     * @param {number} params.drawMult - Tile scale multiplier
     * @param {Array<Template>} params.templatesArray - Array of Template instances
     * @since 0.88.434
     */
    async function loadSchema({
      tileSize: tileSize,
      drawMult: drawMult,
      templatesArray: templatesArray
    }) {

      // Run only if there are templates saved
      if (Object.keys(templates).length > 0) {
  
        // For each template...
        for (const template in templates) {
  
          const templateKey = template; // The identification key for the template. E.g., "0 $Z"
          const templateValue = templates[template]; // The actual content of the template
          console.log(`Template Key: ${templateKey}`);
  
          if (templates.hasOwnProperty(template)) {
  
            const templateKeyArray = templateKey.split(' '); // E.g., "0 $Z" -> ["0", "$Z"]
            const sortID = Number(templateKeyArray?.[0]); // Sort ID of the template
            const authorID = templateKeyArray?.[1] || '0'; // User ID of the person who exported the template
            const displayName = templateValue.name || `Template ${sortID || ''}`; // Display name of the template
            //const coords = templateValue?.coords?.split(',').map(Number); // "1,2,3,4" -> [1, 2, 3, 4]
  
            const pixelCount = {
              total: templateValue.pixels?.total,
              colors: new Map(Object.entries(templateValue.pixels?.colors || {}).map(([key, value]) => [Number(key), value]))
            };
  
            const tilesbase64 = templateValue.tiles;
            const templateTiles = {}; // Stores the template bitmap tiles for each tile.
            const templateTiles32 = {}; // Stores the template Uint32Array tiles for each tile.
  
            const actualTileSize = tileSize * drawMult;
  
            for (const tile in tilesbase64) {
              console.log(tile);
              if (tilesbase64.hasOwnProperty(tile)) {
                const encodedTemplateBase64 = tilesbase64[tile];
                const templateUint8Array = base64ToUint8(encodedTemplateBase64); // Base 64 -> Uint8Array
  
                const templateBlob = new Blob([templateUint8Array], { type: "image/png" }); // Uint8Array -> Blob
                const templateBitmap = await createImageBitmap(templateBlob) // Blob -> Bitmap
                templateTiles[tile] = templateBitmap;
  
                // Converts to Uint32Array
                const canvas = new OffscreenCanvas(actualTileSize, actualTileSize);
                const context = canvas.getContext('2d');
                context.drawImage(templateBitmap, 0, 0);
                const imageData = context.getImageData(0, 0, templateBitmap.width, templateBitmap.height);
                templateTiles32[tile] = new Uint32Array(imageData.data.buffer);
              }
            }
  
            // Creates a new Template class instance
            const template = new Template({
              displayName: displayName,
              sortID: sortID || this.templatesArray?.length || 0,
              authorID: authorID || '',
              //coords: coords,
            });
            template.pixelCount = pixelCount;
            template.chunked = templateTiles;
            template.chunked32 = templateTiles32;
            
            templatesArray.push(template);
            console.log(this.templatesArray);
            console.log(`^^^ This ^^^`);
          }
        }
      }

      return templatesArray
    }
  }

  /** Parses the OSU! Place JSON object
   */
  #parseOSU() {

  }

  /** Sets the `templatesShouldBeDrawn` boolean to a value.
   * @param {boolean} value - The value to set the boolean to
   * @since 0.73.7
   */
  setTemplatesShouldBeDrawn(value) {
    this.templatesShouldBeDrawn = value;
  }

  /** Calculates the correct pixels on this tile.
   * In addition, this function filters colors based on user input.
   * In addition, this function modifies colors to properly display (#deface).
   * In addition, this function modifies incorrect pixels to display highlighting.
   * This function has multiple purposes only to reduce iterations of scans over every pixel on the template.
   * @param {Object} params - Object containing all parameters
   * @param {Uint32Array} params.tile - The tile without templates as a Uint32Array
   * @param {Uint32Array} params.template - The template without filtering as a Uint32Array
   * @param {Array<Number, Number, Number, Number>} params.templateInfo - Information about template location and size
   * @param {Array<number[]>} params.highlightPattern - The highlight pattern selected by the user
   * @param {boolean} params.highlightDisabled - Should highlighting be disabled?
   * @param {number | null} params.highlightColorID - Restricts highlighting to one template color when set
   * @param {'incorrect' | 'missing'} params.highlightMode - Which color-specific highlight mode to use
   * @returns {{correctPixels: Map<number, number>, filteredTemplate: Uint32Array}} A Map containing the color IDs (keys) and how many correct pixels there are for that color (values)
   */
  #calculateCorrectPixelsOnTile_And_FilterTile({
    tile: tile32, 
    template: template32, 
    templateInfo: templateInformation,
    highlightPattern: highlightPattern,
    highlightDisabled: highlightDisabled,
    highlightColorID: highlightColorID = null,
    highlightMode: highlightMode = 'incorrect'
  }) {

    // Size of a pixel in actuality
    const pixelSize = this.drawMult;

    // Tile information
    const tileWidth = this.tileSize * pixelSize;
    const tileHeight = tileWidth;
    const tilePixelOffsetY = -1; // Shift off of target template pixel to target on tile. E.g. "-1" would be the pixel above the template pixel on the tile
    const tilePixelOffsetX = 0; // Shift off of target template pixel to target on tile. E.g. "-1" would be the pixel to the left of the template pixel on the tile

    // Template information
    const templateCoordX = templateInformation[0];
    const templateCoordY = templateInformation[1];
    const templateWidth = templateInformation[2];
    const templateHeight = templateInformation[3];
    const tolerance = this.paletteTolerance;

    //console.log(`TemplateX: ${templateCoordX}\nTemplateY: ${templateCoordY}\nStarting Row:${templateCoordY+tilePixelOffsetY}\nStarting Column:${templateCoordX+tilePixelOffsetX}`);

    // Obtains if the user wants to highlight tile pixels that are transparent, but the template pixel is not
    const shouldTransparentTilePixelsBeHighlighted = !this.settingsManager?.userSettings?.flags?.includes('hl-noTrans');
    // The actual logic of this boolean is "should all pixels be highlighted"
    const hasHighlightColorFilter = Number.isFinite(highlightColorID);

    const { palette: _, LUT: lookupTable } = this.paletteBM; // Obtains the palette and LUT

    // Makes a copy of the color palette Blue Marble uses, turns it into a Map, and adds data to count the amount of each color
    const _colorpalette = new Map(); // Temp color palette
    const incorrectHighlightColors = {
      cyan: 0xFFFFE774,
      blue: 0xFFFFB681,
      yellow: 0xFF5CFFFF,
      coral: 0xFF5252FF,
      white: 0xFFFFFFFF
    };
    const incorrectHighlightPhase = Math.floor(Date.now() / 150);
    const incorrectHighlights = [];
    const maxIncorrectHighlightMarkers = 900;
    const incorrectHighlightBucketSize = pixelSize * 10;
    const incorrectHighlightBuckets = new Set();
    const missingHighlightBucketSize = pixelSize * 16;
    const missingHighlightBuckets = new Map();
    const queueIncorrectHighlight = ({row, column, color}) => {
      if (incorrectHighlights.length >= maxIncorrectHighlightMarkers) {return;}

      const bucketKey = `${Math.floor(row / incorrectHighlightBucketSize)},${Math.floor(column / incorrectHighlightBucketSize)}`;
      if (incorrectHighlightBuckets.has(bucketKey)) {return;}

      incorrectHighlightBuckets.add(bucketKey);
      incorrectHighlights.push({
        row: row,
        column: column,
        color: color
      });
    };
    const queueMissingHighlight = ({row, column, color}) => {
      const bucketRow = Math.floor(row / missingHighlightBucketSize);
      const bucketColumn = Math.floor(column / missingHighlightBucketSize);
      const bucketKey = `${bucketRow},${bucketColumn}`;
      const bucket = missingHighlightBuckets.get(bucketKey);

      if (bucket) {
        bucket.minRow = Math.min(bucket.minRow, row);
        bucket.maxRow = Math.max(bucket.maxRow, row);
        bucket.minColumn = Math.min(bucket.minColumn, column);
        bucket.maxColumn = Math.max(bucket.maxColumn, column);
        bucket.count++;
        return;
      }

      missingHighlightBuckets.set(bucketKey, {
        bucketRow: bucketRow,
        bucketColumn: bucketColumn,
        bucketSize: missingHighlightBucketSize,
        minRow: row,
        maxRow: row,
        minColumn: column,
        maxColumn: column,
        count: 1,
        color: color
      });
    };

    // For each center pixel...
    for (let templateRow = 1; templateRow < templateHeight; templateRow += pixelSize) {
      for (let templateColumn = 1; templateColumn < templateWidth; templateColumn += pixelSize) {
        // ROWS ARE VERTICAL. "ROWS" AS IN, LIKE ON A SPREADSHEET
        // COLUMNS ARE HORIZONTAL. "COLUMNS" AS IN, LIKE ON A SPREADSHEET
        // THE FIFTH ROW IS FIVE DOWN FROM THE ZEROTH ROW
        // THE THIRD COLUMN IS TO THE RIGHT OF THE FIRST COLUMN

        // The pixel on the tile to target (1 pixel above the template)
        const tileRow = (templateCoordY + templateRow) + tilePixelOffsetY; // (Template offset + current row) - 1
        const tileColumn = (templateCoordX + templateColumn) + tilePixelOffsetX; // Template offset + current column
        
        // Retrieves the targeted pixels
        const tilePixelAbove = tile32[(tileRow * tileWidth) + tileColumn];
        const templatePixel = template32[(templateRow * templateWidth) + templateColumn];

        // Obtains the alpha channel of the targeted pixels
        const templatePixelAlpha = (templatePixel >>> 24) & 0xFF;
        const tilePixelAlpha = (tilePixelAbove >>> 24) & 0xFF;

        // Finds the best matching color ID for the template pixel. If none is found, default to "-2"
        const bestTemplateColorID = lookupTable.get(templatePixel) ?? -2;

        // Finds the best matching color ID for the tile pixel. If none is found, default to "-2"
        const bestTileColorID = lookupTable.get(tilePixelAbove) ?? -2;

        // -----     COLOR FILTER      -----
        // If this pixel on the template is a color the user wants to hide on the canvas...
        if (this.shouldFilterColor.get(bestTemplateColorID)) {

          // Sets template pixel to match tile background (which removes the template pixel from the user's view)
          template32[(templateRow * templateWidth) + templateColumn] = tilePixelAbove;
        }
        // -----  END OF COLOR FILTER  -----

        // -----        ERASED         -----
        // If this pixel on the template is the Erased (#deface) color...
        if (bestTemplateColorID == -1) {

          const blackTrans = 0x20000000; // Black translucent color for Erased pixels

          // If Erased color should be filtered
          if (this.shouldFilterColor.get(bestTemplateColorID)) {
            template32[(templateRow * templateWidth) + templateColumn] = 0x00000000; // Center (black, 0% opacity)
          } else {
            // Don't filter Erased color

            // If the tile row and tile column are even,
            // Or the tile row and tile column are odd...
            if (((tileRow / pixelSize) & 1) == ((tileColumn / pixelSize) & 1)) {

              // Sets the template pixels to be a semi-transparent, black grid
              template32[(templateRow * templateWidth) + templateColumn] = blackTrans; // Center
              template32[((templateRow - 1) * templateWidth) + (templateColumn - 1)] = blackTrans; // Top Left
              template32[((templateRow - 1) * templateWidth) + (templateColumn + 1)] = blackTrans; // Top Right
              template32[((templateRow + 1) * templateWidth) + (templateColumn - 1)] = blackTrans; // Bottom Left
              template32[((templateRow + 1) * templateWidth) + (templateColumn + 1)] = blackTrans; // Bottom Right
            } else {
              // Else, either the row or column is odd, and the other is even.

              // Sets the template pixels to the the inverse of a semi-transparent, black grid
              template32[(templateRow * templateWidth) + templateColumn] = 0x00000000; // Center (black, 0% opacity)
              template32[((templateRow - 1) * templateWidth) + (templateColumn)] = blackTrans; // Top Center
              template32[((templateRow + 1) * templateWidth) + (templateColumn)] = blackTrans; // Bottom Center
              template32[((templateRow) * templateWidth) + (templateColumn - 1)] = blackTrans; // Middle Left
              template32[((templateRow) * templateWidth) + (templateColumn + 1)] = blackTrans; // Middle Right
            }
          }
        }
        // -----     END OF ERASED     -----

        // -----     HIGHLIGHTING      -----

        const shouldHighlightSelectedColorMismatch = hasHighlightColorFilter
          && (tilePixelAlpha > tolerance)
          && (highlightMode == 'incorrect')
          && (
            ((bestTemplateColorID == highlightColorID) && (bestTileColorID != bestTemplateColorID))
            || ((bestTileColorID == highlightColorID) && (bestTemplateColorID != highlightColorID))
          );
        const shouldHighlightSelectedColorMissing = hasHighlightColorFilter
          && (highlightMode == 'missing')
          && (bestTemplateColorID == highlightColorID)
          && (templatePixelAlpha > tolerance)
          && (tilePixelAlpha <= tolerance);
        const shouldHighlightGeneralMismatch = !hasHighlightColorFilter
          && (templatePixelAlpha > tolerance)
          && (bestTileColorID != bestTemplateColorID);

        // If highlighting is enabled, AND the template pixel does not match the tile pixel
        if (!highlightDisabled && (shouldHighlightSelectedColorMismatch || shouldHighlightSelectedColorMissing || shouldHighlightGeneralMismatch)) {

          // If the tile pixel is NOT transparent, OR the user wants to highlight transparent pixels
          if ((hasHighlightColorFilter && (shouldHighlightSelectedColorMissing || (tilePixelAlpha > tolerance))) || (!hasHighlightColorFilter && (shouldTransparentTilePixelsBeHighlighted || (tilePixelAlpha > tolerance)))) {

            // Obtains the template color of this pixel
            const templatePixelColor = (templatePixelAlpha > tolerance)
              ? template32[(templateRow * templateWidth) + templateColumn]
              : tilePixelAbove;
            // This will retrieve the tile background instead if the color is filtered!

            if (hasHighlightColorFilter) {
              (highlightMode == 'missing' ? queueMissingHighlight : queueIncorrectHighlight)({
                row: templateRow,
                column: templateColumn,
                color: templatePixelColor
              });
              continue;
            }

            // For each of the 9 subpixels inside the pixel...
            for (const subpixelPattern of highlightPattern) {

              // Deconstructs the sub pixel
              const [subpixelState, subpixelColumnDelta, subpixelRowDelta] = subpixelPattern;
              // "Delta" because the coordinate of the sub-pixel is relative to the center of the pixel

              // Obtains the subpixel color to use
              const subpixelColor = (subpixelState != 0) ? ((subpixelState != 1) ? templatePixelColor : 0xFF0000FF) : 0x00000000;
              // 0 = Transparent (black)
              // 1 = Red (#FF0000)
              // 2 = Template (matches template or hides if filtered)

              // Sets the subpixel to match the color on the highlight pattern
              template32[((templateRow + subpixelRowDelta) * templateWidth) + (templateColumn + subpixelColumnDelta)] = subpixelColor;
            }
          }
        }

        // -----  END OF HIGHLIGHTING  -----

        // If the template pixel is Erased, and the tile pixel is transparent...
        if ((bestTemplateColorID == -1) && (tilePixelAbove <= tolerance)) {

          // Increments the count by 1 for the Erased (#deface) color.
          // If the color ID has not been counted yet, default to 1
          const colorIDcount = _colorpalette.get(bestTemplateColorID);
          _colorpalette.set(bestTemplateColorID, colorIDcount ? colorIDcount + 1 : 1);
          continue;
        }
        // If the code passes this point, the pixel is not a correct Erased color.

        // If either pixel is transparent...
        if ((templatePixelAlpha <= tolerance) || (tilePixelAlpha <= tolerance)) {
          continue; // ...we skip it. We can't match the RGB color of transparent pixels.
        }
        // If the code passes this point, both pixels are opaque & not Erased.

        // If the template pixel does not match the tile pixel, then the pixel is skipped after highlighting.
        if (bestTileColorID != bestTemplateColorID) {
          continue;
        }
        // If the code passes this point, the template pixel matches the tile pixel.

        // Increments the count by 1 for the best matching color ID (which can be negative).
        // If the color ID has not been counted yet, default to 1
        const colorIDcount = _colorpalette.get(bestTemplateColorID);
        _colorpalette.set(bestTemplateColorID, colorIDcount ? colorIDcount + 1 : 1);
      }
    }

    if (hasHighlightColorFilter && (highlightMode == 'missing')) {
      const missingHighlightClusters = this.#buildMissingHighlightClusters(missingHighlightBuckets, 96);
      for (const cluster of missingHighlightClusters) {
        this.#drawMissingHighlightCluster({
          template: template32,
          templateWidth: templateWidth,
          templateHeight: templateHeight,
          cluster: cluster,
          colors: incorrectHighlightColors,
          phase: incorrectHighlightPhase,
          pixelSize: pixelSize
        });
      }
    } else {
      for (const highlight of incorrectHighlights) {
        this.#drawIncorrectHighlightMarker({
          template: template32,
          templateWidth: templateWidth,
          templateHeight: templateHeight,
          row: highlight.row,
          column: highlight.column,
          centerColor: highlight.color,
          colors: incorrectHighlightColors,
          phase: incorrectHighlightPhase
        });
      }
    }

    console.log(`List of template pixels that match the tile:`);
    console.log(_colorpalette);
    return { correctPixels: _colorpalette, filteredTemplate: template32 };
  }

  /** Builds connected blob bounds for dense missing-pixel highlighting.
   * @param {Map<string, Object>} bucketMap
   * @param {number} maxClusters
   * @returns {Array<Object>}
   * @since 0.97.0
   */
  #buildMissingHighlightClusters(bucketMap, maxClusters) {
    if (!bucketMap?.size) {return [];}

    const visited = new Set();
    const clusters = [];
    const neighborDeltas = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];

    for (const [bucketKey, startBucket] of bucketMap) {
      if (visited.has(bucketKey)) {continue;}

      const queue = [startBucket];
      const cluster = {
        minRow: startBucket.minRow,
        maxRow: startBucket.maxRow,
        minColumn: startBucket.minColumn,
        maxColumn: startBucket.maxColumn,
        count: 0,
        color: startBucket.color,
        buckets: []
      };
      visited.add(bucketKey);

      for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
        const bucket = queue[queueIndex];
        cluster.minRow = Math.min(cluster.minRow, bucket.minRow);
        cluster.maxRow = Math.max(cluster.maxRow, bucket.maxRow);
        cluster.minColumn = Math.min(cluster.minColumn, bucket.minColumn);
        cluster.maxColumn = Math.max(cluster.maxColumn, bucket.maxColumn);
        cluster.count += bucket.count;
        cluster.buckets.push(bucket);

        for (const [rowDelta, columnDelta] of neighborDeltas) {
          const neighborKey = `${bucket.bucketRow + rowDelta},${bucket.bucketColumn + columnDelta}`;
          if (visited.has(neighborKey)) {continue;}

          const neighbor = bucketMap.get(neighborKey);
          if (!neighbor) {continue;}

          visited.add(neighborKey);
          queue.push(neighbor);
        }
      }

      clusters.push(cluster);
    }

    return clusters
      .sort((a, b) => b.count - a.count)
      .slice(0, maxClusters);
  }

  /** Draws one soft contour around a cluster of missing pixels.
   * @param {Object} params
   * @param {Uint32Array} params.template
   * @param {number} params.templateWidth
   * @param {number} params.templateHeight
   * @param {Object} params.cluster
   * @param {Object} params.colors
   * @param {number} params.phase
   * @param {number} params.pixelSize
   * @since 0.97.0
   */
  #drawMissingHighlightCluster({
    template: template32,
    templateWidth: templateWidth,
    templateHeight: templateHeight,
    cluster: cluster,
    colors: colors,
    phase: phase,
    pixelSize: pixelSize
  }) {
    const padding = pixelSize * 2;
    const outerThickness = Math.max(1, Math.round(pixelSize * 0.58));
    const innerThickness = Math.max(1, Math.round(pixelSize * 0.36));
    const innerInset = pixelSize * 2;
    const softColors = {
      cyan: 0xC8FFFB00,
      magenta: 0xB8FF33FF
    };

    const setPixel = (row, column, color) => {
      if ((row < 0) || (row >= templateHeight) || (column < 0) || (column >= templateWidth)) {return;}
      template32[(row * templateWidth) + column] = color;
    };

    const contourColor = (isInner = false) => {
      return isInner ? softColors.magenta : softColors.cyan;
    };

    const drawHorizontal = (row, startColumn, endColumn, thickness, isInner = false) => {
      if (startColumn > endColumn) {return;}
      for (let column = startColumn; column <= endColumn; column++) {
        for (let offset = -thickness; offset <= thickness; offset++) {
          setPixel(row + offset, column, contourColor(isInner));
        }
      }
    };

    const drawVertical = (column, startRow, endRow, thickness, isInner = false) => {
      if (startRow > endRow) {return;}
      for (let row = startRow; row <= endRow; row++) {
        for (let offset = -thickness; offset <= thickness; offset++) {
          setPixel(row, column + offset, contourColor(isInner));
        }
      }
    };

    const bucketSet = new Set(cluster.buckets.map(bucket => `${bucket.bucketRow},${bucket.bucketColumn}`));
    const hasBucket = (bucket, rowDelta, columnDelta) => bucketSet.has(`${bucket.bucketRow + rowDelta},${bucket.bucketColumn + columnDelta}`);
    const drawBucketBoundary = ({bucket, inset = 0, thickness = outerThickness, isInner = false}) => {
      const bucketTop = bucket.bucketRow * bucket.bucketSize;
      const bucketLeft = bucket.bucketColumn * bucket.bucketSize;
      const bucketBottom = bucketTop + bucket.bucketSize - 1;
      const bucketRight = bucketLeft + bucket.bucketSize - 1;
      const top = Math.max(0, Math.floor(bucketTop - padding));
      const bottom = Math.min(templateHeight - 1, Math.ceil(bucketBottom + padding));
      const left = Math.max(0, Math.floor(bucketLeft - padding));
      const right = Math.min(templateWidth - 1, Math.ceil(bucketRight + padding));

      if (!hasBucket(bucket, -1, 0)) {
        drawHorizontal(top + inset, left, right, thickness, isInner);
      }
      if (!hasBucket(bucket, 1, 0)) {
        drawHorizontal(bottom - inset, left, right, thickness, isInner);
      }
      if (!hasBucket(bucket, 0, -1)) {
        drawVertical(left + inset, top, bottom, thickness, isInner);
      }
      if (!hasBucket(bucket, 0, 1)) {
        drawVertical(right - inset, top, bottom, thickness, isInner);
      }
    };

    for (const bucket of cluster.buckets) {
      drawBucketBoundary({bucket: bucket});
      if (bucket.count >= 3) {
        drawBucketBoundary({
          bucket: bucket,
          inset: innerInset,
          thickness: innerThickness,
          isInner: true
        });
      }
    }
  }

  /** Returns the same Uint32 RGBA color with a new alpha channel.
   * @param {number} color
   * @param {number} alpha
   * @returns {number}
   * @since 0.97.0
   */
  #withAlpha(color, alpha) {
    return (color & 0x00FFFFFF) | ((Math.max(0, Math.min(255, alpha)) & 0xFF) << 24);
  }

  /** Draws a loud marker around one incorrect pixel for color-specific highlighting.
   * @param {Object} params
   * @param {Uint32Array} params.template
   * @param {number} params.templateWidth
   * @param {number} params.templateHeight
   * @param {number} params.row
   * @param {number} params.column
   * @param {number} params.centerColor
   * @param {Object} params.colors
   * @param {number} params.phase
   * @since 0.97.0
   */
  #drawIncorrectHighlightMarker({
    template: template32,
    templateWidth: templateWidth,
    templateHeight: templateHeight,
    row: templateRow,
    column: templateColumn,
    centerColor: centerColor,
    colors: colors,
    phase: phase
  }) {
    const setSubpixel = (rowDelta, columnDelta, color) => {
      const row = templateRow + rowDelta;
      const column = templateColumn + columnDelta;
      if ((row < 0) || (row >= templateHeight) || (column < 0) || (column >= templateWidth)) {return;}
      template32[(row * templateWidth) + column] = color;
    };

    const pixelSize = this.drawMult;
    const radiusPixels = 10 + (phase % 4);
    const waveRadius = radiusPixels * pixelSize;
    const innerRadius = Math.max(pixelSize * 3, waveRadius - (pixelSize * 4));
    const midRadius = Math.max(pixelSize * 2, waveRadius - (pixelSize * 2));
    const outerRingThickness = pixelSize * 0.52;
    const midRingThickness = pixelSize * 0.46;
    const innerRingThickness = pixelSize * 0.4;
    const spokeHalfThickness = Math.max(0, Math.floor(pixelSize * 0.22));
    const phaseIsEven = (phase & 1) == 0;
    const phaseModThree = phase % 3;

    const crossStart = Math.max(1, pixelSize);
    const crossEnd = Math.max(crossStart + 1, pixelSize * 2);
    for (let offset = crossStart; offset <= crossEnd; offset++) {
      setSubpixel(-offset, 0, colors.yellow);
      setSubpixel(offset, 0, colors.yellow);
      setSubpixel(0, -offset, colors.yellow);
      setSubpixel(0, offset, colors.yellow);
    }

    for (let rowDelta = -waveRadius; rowDelta <= waveRadius; rowDelta++) {
      for (let columnDelta = -waveRadius; columnDelta <= waveRadius; columnDelta++) {
        const distance = Math.hypot(rowDelta, columnDelta);
        const isOuterRing = Math.abs(distance - waveRadius) <= outerRingThickness;
        const isMidRing = Math.abs(distance - midRadius) <= midRingThickness;
        const isInnerRing = Math.abs(distance - innerRadius) <= innerRingThickness;
        const isSpoke = (
          ((Math.abs(rowDelta) <= spokeHalfThickness) && (Math.abs(columnDelta) >= crossStart) && (Math.abs(columnDelta) <= waveRadius) && (((Math.abs(columnDelta) / pixelSize) + phase) % 5 < 1))
          || ((Math.abs(columnDelta) <= spokeHalfThickness) && (Math.abs(rowDelta) >= crossStart) && (Math.abs(rowDelta) <= waveRadius) && (((Math.abs(rowDelta) / pixelSize) + phase) % 5 < 1))
        );

        if (!isOuterRing && !isMidRing && !isInnerRing && !isSpoke) {continue;}

        if (isOuterRing && (((Math.floor((Math.atan2(rowDelta, columnDelta) + Math.PI) * 6) + phaseModThree) % 3) == 0)) {
          setSubpixel(rowDelta, columnDelta, colors.white);
          continue;
        }

        if (isOuterRing) {
          setSubpixel(rowDelta, columnDelta, phaseIsEven ? colors.cyan : colors.blue);
        } else if (isMidRing) {
          setSubpixel(rowDelta, columnDelta, phaseIsEven ? colors.yellow : colors.cyan);
        } else if (isInnerRing) {
          setSubpixel(rowDelta, columnDelta, colors.coral);
        } else if (isSpoke) {
          setSubpixel(rowDelta, columnDelta, phaseIsEven ? colors.blue : colors.yellow);
        }
      }
    }

    for (const [rowDelta, columnDelta] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
      setSubpixel(rowDelta, columnDelta, colors.yellow);
    }
  }
}
