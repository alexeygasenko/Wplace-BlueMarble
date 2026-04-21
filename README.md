# Blue Marble UI Fork

![Blue Marble 0.94.0 liquid-glass UI showcase](./docs/assets/blue-marble.png)

This fork is based on [SwingTheVine/Wplace-BlueMarble](https://github.com/SwingTheVine/Wplace-BlueMarble) and focuses on a cleaner, more compact UI for everyday template work on [wplace.live](https://wplace.live/).

The goal is not to replace the upstream project. This fork keeps the original Blue Marble workflow, then adds a more polished interface and a stronger Color Filter experience.

## What Is Different

Version `0.94.0` introduces the first fork-specific release:

- Redesigned Blue Marble windows with a minimal liquid-glass visual style.
- Redesigned window controls, buttons, typography, spacing, and transitions.
- Added a resizable windowed mode for Color Filter.
- Added Color Filter position and size persistence.
- Added persistence for shown and hidden colors in Color Filter.
- Added automatic Color Filter refresh every 10 seconds.
- Updated Color Filter visibility icons to match the new interface style.

## Installation

Install the latest userscript from the fork release page:

[Download the latest release](https://github.com/alexeygasenko/Wplace-BlueMarble/releases/latest)

Use `BlueMarble.user.js` with a userscript manager such as Tampermonkey, then refresh [wplace.live](https://wplace.live/).

## Color Filter

Color Filter is the main area improved by this fork. It can be opened as a compact window, resized, moved around the canvas, and restored with the same size and position the next time you use it.

Hidden and visible colors are remembered, so you can isolate the colors you are actively painting without rebuilding the filter state every session. The list also refreshes automatically every 10 seconds, keeping pixel counts current without a manual refresh button.

## Upstream

Original project:

[SwingTheVine/Wplace-BlueMarble](https://github.com/SwingTheVine/Wplace-BlueMarble)

This fork keeps the original license and credits. For upstream documentation, contribution rules, and project background, refer to the original repository.

## License

Blue Marble is licensed under the Mozilla Public License 2.0. See [LICENSE.txt](./LICENSE.txt).
