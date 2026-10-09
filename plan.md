# Equinox Map Generator plan

## Completed

- [x] Set up the static web app, load colour configuration, and render a grid.
- [x] Create rooms by dragging on the grid; snap room bounds to grid cells.
- [x] Select, move, resize, and delete rooms.

## Next

- [x] Support grid-aligned orthogonal room shapes with right-angle corners, including concave solid shapes such as a hash sign without a hole.
- [x] Add and edit points of interest within rooms.
- [x] Add doors and support the configured door colours, including rainbow-door notes.
- [x] Save and load maps.
- [x] (update-ui 1/4) Remove room names (no labels, no rename field; ignore `name` in loaded maps).
- [x] (update-ui 2/4) Enlarge the grid to 120x80 cells in a scrollable canvas that fills the space left after the toolbar; older smaller maps still load.
- [ ] (update-ui 3/4) Simplify the UI into a tool palette (Select, Room, Complex room, POI, Door) with tool options shown only for the active tool; Esc cancels, Delete removes.
- [ ] (update-ui 4/4) Add cell-based spikes and walls as new map elements.
- [ ] Add keyboard-accessible editing controls and validate map interactions.
