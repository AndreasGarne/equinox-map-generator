# equinox-map-generator
This is a web app intended to create maps while playing the game equinox to keep track of levels.
You define rooms and add POI to them.

## Running
Serve the folder statically (config is loaded via fetch), e.g. `python3 -m http.server`, then open http://localhost:8000.

## Configuration
Colours are defined in `config/colors.json`.
Doors can be placed on room boundaries and use the configured door colours. Selecting a rainbow door displays its configured note.

## Saving and loading maps
Use **Save map** to download the current map as `equinox-map.json`. Use **Load map** to open a previously saved JSON map; loading replaces the current map. Map files preserve rooms, names, points of interest, and doors, and must match the app's current grid and configured colours.

## Workflow
Small changes on branches named `feat/…`, `chore/…` or `fix/…`, merged via PR.
