# equinox-map-generator
This is a web app intended to create maps while playing the game equinox to keep track of levels.
You define rooms and add POI to them.

## Running
Serve the folder statically (config is loaded via fetch), e.g. `python3 -m http.server`, then open http://localhost:8000.

## Configuration
Colours are defined in `config/colors.json`.
Doors can be placed on room boundaries and use the configured door colours. Selecting a rainbow door displays its configured note.

## Using the editor
Pick a tool from the palette in the left-hand panel: **Room** (drag to draw a rectangle), **Complex room** (click corners, then Finish shape or Enter), **Point** (including a blue M for magic), **Door**, **Select** (select, move and resize rooms; select points, doors and obstacles), **Pan** (drag to scroll the map, useful on touch screens) and **Obstacle** (cell-based spikes or walls inside a room; clicking an occupied tile replaces it). Options appear for the active tool. **Delete selected** or the Delete key removes the selected obstacle, point, door or room, and Esc returns to Select.

## Saving and loading maps
Choose **Save map**, check the name (prefilled with the loaded map's name, or `map_name_1`, `map_name_2`… for the first unused name) and press **OK** (or Enter) to download a JSON file. The map name is stored in the JSON, and the filename is lowercased with spaces replaced by hyphens. Saving downloads the file; it does not modify the repository.

To make a saved map available in the app, add the downloaded file to `maps/` and add its display name and filename to the `maps` array in `maps/index.json`. This catalog is needed because static hosting cannot reliably list a folder's files. Choosing a map in the selector at the top of the Map section fetches a map from that catalog and replaces the current map (you are asked to confirm first if there are unsaved changes; the loaded map stays selected). Map files preserve rooms, points of interest, doors and obstacles, and use the app's tile size and configured colours. The grid is 120x80 cells; maps saved on a smaller grid (such as the earlier 30x20 one) still load and sit at the top-left. Room names in older files are ignored.

## Workflow
Small changes on branches named `feat/…`, `chore/…` or `fix/…`, merged via PR.
