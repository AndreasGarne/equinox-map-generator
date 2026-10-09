const TILE = 32;
const POI_TYPES = {
  weapon: { letter: 'W', color: '#111' },
  orb: { letter: 'O', color: '#1e3a8a' },
  apple: { letter: 'A' },
  potion: { letter: 'P' },
  boss: { letter: 'B', color: '#dc2626' },
  key: { letter: 'K' },
  ladder: { letter: 'L', color: '#4b2508' }
};
const rooms = [];
let selectedRoom = null;
let interaction = null;
let shapeMode = false;
let shapePoints = [];
let placingPoi = false;
let selectedPoi = null;
let placingDoor = false;
let selectedDoor = null;

async function loadConfig() {
  const res = await fetch('config/colors.json');
  if (!res.ok) throw new Error(`Unable to load colour configuration (${res.status})`);
  return res.json();
}

function drawGrid(ctx, w, h, preview = null, itemColors = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, w, h);

  for (const room of rooms) drawRoom(ctx, room, false, room === selectedRoom);
  if (preview) drawRoom(ctx, preview, true);

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += TILE) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
  for (let y = 0; y <= h; y += TILE) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
  ctx.stroke();

  for (const room of rooms) {
    for (const door of room.doors || []) {
      const x = (room.x + door.x) * TILE;
      const y = (room.y + door.y) * TILE;
      const isGap = door.color === 'none' || door.color === 'hidden';
      const half = isGap ? TILE / 2 : 9;
      const inward = door.color === 'rainbow' ? doorInward(room, door) : { x: 0, y: 0 };
      const ox = x + inward.x * 5;
      const oy = y + inward.y * 5;
      ctx.beginPath();
      if (door.orientation === 'horizontal') {
        ctx.moveTo(ox - half, oy);
        ctx.lineTo(ox + half, oy);
      } else {
        ctx.moveTo(ox, oy - half);
        ctx.lineTo(ox, oy + half);
      }
      ctx.lineCap = isGap ? 'butt' : 'round';
      ctx.setLineDash(door.color === 'hidden' ? [4, 4] : []);
      ctx.lineWidth = door === selectedDoor ? 11 : 7;
      if (isGap) {
        ctx.lineWidth = door === selectedDoor ? 7 : 5;
        ctx.strokeStyle = '#b0a060';
      } else if (door.color === 'rainbow') {
        const gradient = door.orientation === 'horizontal'
          ? ctx.createLinearGradient(ox - 9, oy, ox + 9, oy)
          : ctx.createLinearGradient(ox, oy - 9, ox, oy + 9);
        gradient.addColorStop(0, '#ef4444');
        gradient.addColorStop(0.2, '#f97316');
        gradient.addColorStop(0.4, '#eab308');
        gradient.addColorStop(0.6, '#22c55e');
        gradient.addColorStop(0.8, '#3b82f6');
        gradient.addColorStop(1, '#a855f7');
        ctx.strokeStyle = gradient;
      } else {
        ctx.strokeStyle = itemColors[door.color] || '#111';
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (door === selectedDoor) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 13, y - 13, 26, 26);
      }
    }
  }

  for (const room of rooms) {
    for (const poi of room.pois || []) {
      const x = (room.x + poi.x) * TILE;
      const y = (room.y + poi.y) * TILE;
      const type = POI_TYPES[poi.type];
      if (!type) continue;
      if (poi === selectedPoi) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - TILE / 2 + 2, y - TILE / 2 + 2, TILE - 4, TILE - 4);
      }
      ctx.fillStyle = type.color || itemColors[poi.color] || '#111';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(type.letter, x, y);
    }
  }
}

function drawRoom(ctx, room, isPreview = false, isSelected = false) {
  const x = room.x * TILE;
  const y = room.y * TILE;
  const width = room.width * TILE;
  const height = room.height * TILE;

  if (!room.points?.length) return;
  ctx.beginPath();
  ctx.moveTo(room.points[0].x * TILE, room.points[0].y * TILE);
  for (const point of room.points.slice(1)) ctx.lineTo(point.x * TILE, point.y * TILE);
  if (!isPreview || room.valid) ctx.closePath();
  if (!isPreview || room.valid) {
    ctx.fillStyle = isPreview ? 'rgba(59, 130, 246, 0.25)' : 'rgba(250, 204, 21, 0.35)';
    ctx.fill();
  }
  ctx.strokeStyle = isPreview ? (room.valid === false ? '#dc2626' : '#3b82f6') : '#222';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (!isPreview) {
    ctx.fillStyle = '#111';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(room.name, x + 6, y + 18, Math.max(0, width - 12));
  }

  if (isSelected) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(room.points[0].x * TILE + 2, room.points[0].y * TILE + 2);
    for (const point of room.points.slice(1)) ctx.lineTo(point.x * TILE + 2, point.y * TILE + 2);
    ctx.closePath();
    ctx.stroke();
    if (room.shape === 'rectangle') {
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x + width - 10, y + height - 10, 8, 8);
    }
  }
}

function getPosition(canvas, event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
  };
}

function getCell(canvas, event) {
  const position = getPosition(canvas, event);
  return {
    x: Math.max(0, Math.min(Math.floor(position.x / TILE), canvas.width / TILE - 1)),
    y: Math.max(0, Math.min(Math.floor(position.y / TILE), canvas.height / TILE - 1))
  };
}

function getGridPoint(canvas, event) {
  const position = getPosition(canvas, event);
  return {
    x: Math.max(0, Math.min(Math.round(position.x / TILE), canvas.width / TILE)),
    y: Math.max(0, Math.min(Math.round(position.y / TILE), canvas.height / TILE))
  };
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y > y) !== (b.y > y) &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function getRoomAt(position) {
  return [...rooms].reverse().find(room =>
    pointInPolygon(position.x / TILE, position.y / TILE, room.points)
  );
}

function getPoiAt(position) {
  for (const room of [...rooms].reverse()) {
    for (const poi of [...(room.pois || [])].reverse()) {
      const x = (room.x + poi.x) * TILE;
      const y = (room.y + poi.y) * TILE;
      if (Math.hypot(position.x - x, position.y - y) <= 10) return { room, poi };
    }
  }
  return null;
}

function doorInward(room, door) {
  const x = room.x + door.x;
  const y = room.y + door.y;
  const d = door.orientation === 'horizontal' ? { x: 0, y: 1 } : { x: 1, y: 0 };
  return pointInRoom(room, x + d.x * 0.1, y + d.y * 0.1) ? d : { x: -d.x, y: -d.y };
}

function pointInRoom(room, px, py) {
  let inside = false;
  const pts = room.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function getDoorAt(position) {
  for (const room of [...rooms].reverse()) {
    for (const door of [...(room.doors || [])].reverse()) {
      const x = (room.x + door.x) * TILE;
      const y = (room.y + door.y) * TILE;
      if (Math.hypot(position.x - x, position.y - y) <= 12) return { room, door };
    }
  }
  return null;
}

function getDoorOnBoundary(room, position) {
  let closest = null;
  for (let i = 0; i < room.points.length; i++) {
    const start = room.points[i];
    const end = room.points[(i + 1) % room.points.length];
    const horizontal = start.y === end.y;
    const cursor = (horizontal ? position.x : position.y) / TILE;
    const fixed = horizontal ? start.y : start.x;
    const perpendicular = Math.abs((horizontal ? position.y : position.x) / TILE - fixed);
    const axisStart = horizontal ? start.x : start.y;
    const axisEnd = horizontal ? end.x : end.y;
    const min = Math.min(axisStart, axisEnd);
    const max = Math.max(axisStart, axisEnd);
    const distance = Math.hypot(perpendicular, Math.max(min - cursor, 0, cursor - max)) * TILE;
    if (distance > 12 || (closest && distance >= closest.distance) || max - min < 1) continue;
    const center = Math.max(min + 0.5, Math.min(Math.floor(cursor) + 0.5, max - 0.5));
    closest = {
      distance,
      door: horizontal
        ? { x: center - room.x, y: fixed - room.y, orientation: 'horizontal' }
        : { x: fixed - room.x, y: center - room.y, orientation: 'vertical' }
    };
  }
  return closest?.door || null;
}

function isDoorOnBoundary(room, door) {
  const x = room.x + door.x;
  const y = room.y + door.y;
  return room.points.some((start, index) => {
    const end = room.points[(index + 1) % room.points.length];
    if (door.orientation === 'horizontal' && start.y === end.y) {
      return y === start.y && x - 0.5 >= Math.min(start.x, end.x) &&
        x + 0.5 <= Math.max(start.x, end.x);
    }
    if (door.orientation === 'vertical' && start.x === end.x) {
      return x === start.x && y - 0.5 >= Math.min(start.y, end.y) &&
        y + 0.5 <= Math.max(start.y, end.y);
    }
    return false;
  });
}

function isResizeHandle(room, position) {
  if (room.shape !== 'rectangle') return false;
  const right = (room.x + room.width) * TILE;
  const bottom = (room.y + room.height) * TILE;
  return position.x >= right - 12 && position.x <= right &&
    position.y >= bottom - 12 && position.y <= bottom;
}

function getRoomBounds(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x) + 1,
    height: Math.abs(end.y - start.y) + 1
  };
}

function getBounds(points) {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y
  };
}

function rectanglePoints(bounds) {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ];
}

function segmentsIntersect(a, b, c, d) {
  if (a.y === b.y && c.y === d.y) {
    return a.y === c.y && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x));
  }
  if (a.x === b.x && c.x === d.x) {
    return a.x === c.x && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
  }
  const horizontalStart = a.y === b.y ? a : c;
  const horizontalEnd = a.y === b.y ? b : d;
  const verticalStart = a.x === b.x ? a : c;
  const verticalEnd = a.x === b.x ? b : d;
  return verticalStart.x >= Math.min(horizontalStart.x, horizontalEnd.x) &&
    verticalStart.x <= Math.max(horizontalStart.x, horizontalEnd.x) &&
    horizontalStart.y >= Math.min(verticalStart.y, verticalEnd.y) &&
    horizontalStart.y <= Math.max(verticalStart.y, verticalEnd.y);
}

function isValidShape(points, canvas) {
  if (points.length < 4) return false;
  const maxX = canvas.width / TILE;
  const maxY = canvas.height / TILE;
  if (points.some(point => point.x < 0 || point.x > maxX || point.y < 0 || point.y > maxY)) return false;

  for (let i = 0; i < points.length; i++) {
    const previous = points[(i + points.length - 1) % points.length];
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if ((current.x === next.x && current.y === next.y) ||
      (current.x !== next.x && current.y !== next.y) ||
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y)) return false;
  }

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % points.length])) return false;
    }
  }

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area !== 0;
}

function createMapData(canvas) {
  return {
    format: 'equinox-map',
    version: 1,
    grid: { width: canvas.width, height: canvas.height, tileSize: TILE },
    rooms: rooms.map(room => ({
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
      points: room.points.map(point => ({ ...point })),
      shape: room.shape,
      name: room.name,
      pois: (room.pois || []).map(poi => ({ ...poi })),
      doors: (room.doors || []).map(door => ({ ...door }))
    }))
  };
}

function validateMapData(data, canvas, itemColors, doorColors) {
  const invalid = () => { throw new Error('The selected file is not a valid Equinox map.'); };
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
    data.format !== 'equinox-map' || data.version !== 1 ||
    data.grid?.width !== canvas.width || data.grid?.height !== canvas.height ||
    data.grid?.tileSize !== TILE || !Array.isArray(data.rooms) || data.rooms.length > 1000) invalid();

  const poiColors = new Set([...Object.keys(itemColors), 'black']);
  const roomsToLoad = data.rooms.map(room => {
    if (!room || typeof room !== 'object' || Array.isArray(room) ||
      typeof room.name !== 'string' || room.name.length > 100 ||
      !['rectangle', 'polygon'].includes(room.shape) ||
      !Number.isInteger(room.x) || !Number.isInteger(room.y) ||
      !Number.isInteger(room.width) || !Number.isInteger(room.height) ||
      room.width < 1 || room.height < 1 ||
      !Array.isArray(room.points) || room.points.length > 1000 ||
      !Array.isArray(room.pois) || room.pois.length > 1000 ||
      !Array.isArray(room.doors) || room.doors.length > 1000) invalid();

    const points = room.points;
    if (points.some(point => !point || !Number.isInteger(point.x) || !Number.isInteger(point.y)) ||
      !isValidShape(points, canvas)) invalid();
    const bounds = getBounds(points);
    if (room.shape === 'rectangle') {
      const expectedPoints = rectanglePoints(room);
      if (room.x + room.width > canvas.width / TILE || room.y + room.height > canvas.height / TILE ||
        points.some((point, index) => point.x !== expectedPoints[index].x ||
          point.y !== expectedPoints[index].y)) invalid();
    } else if (room.x !== bounds.x || room.y !== bounds.y ||
      room.width !== bounds.width || room.height !== bounds.height) invalid();

    const pois = room.pois.map(poi => {
      if (!poi || typeof poi !== 'object' || Array.isArray(poi) ||
        !Number.isFinite(poi.x) || !Number.isFinite(poi.y) ||
        !Number.isInteger(poi.x * 2) || !Number.isInteger(poi.y * 2) ||
        !POI_TYPES[poi.type] || !poiColors.has(poi.color) ||
        !pointInPolygon(room.x + poi.x, room.y + poi.y, points)) invalid();
      return { x: poi.x, y: poi.y, type: poi.type, color: poi.color };
    });
    const doors = room.doors.map(door => {
      if (!door || typeof door !== 'object' || Array.isArray(door) ||
        !Number.isFinite(door.x) || !Number.isFinite(door.y) ||
        !Number.isInteger(door.x * 2) || !Number.isInteger(door.y * 2) ||
        !['horizontal', 'vertical'].includes(door.orientation) ||
        !doorColors.includes(door.color) || !isDoorOnBoundary(room, door)) invalid();
      return { x: door.x, y: door.y, orientation: door.orientation, color: door.color };
    });
    return {
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
      points: points.map(point => ({ x: point.x, y: point.y })),
      shape: room.shape,
      name: room.name,
      pois,
      doors
    };
  });
  return roomsToLoad;
}

function createRectangle(bounds, name) {
  return { ...bounds, points: rectanglePoints(bounds), shape: 'rectangle', name, pois: [], doors: [] };
}

function getDefaultPoiColor(type, itemColors) {
  return type === 'key' ? 'black' : Object.keys(itemColors)[0] || 'black';
}

function updateRoomControls(itemColors, doorColors = window.equinoxConfig.doorColors) {
  const nameInput = document.getElementById('room-name');
  const deleteButton = document.getElementById('delete-room');
  const poiTypeInput = document.getElementById('poi-type');
  const poiColorInput = document.getElementById('poi-color');
  const doorColorInput = document.getElementById('door-color');
  nameInput.disabled = !selectedRoom;
  nameInput.value = selectedRoom ? selectedRoom.name : '';
  deleteButton.disabled = !selectedRoom;
  document.getElementById('draw-shape').disabled = shapeMode;
  document.getElementById('finish-shape').disabled = !shapeMode || !isValidShape(shapePoints, document.getElementById('map'));
  document.getElementById('cancel-shape').disabled = !shapeMode;
  document.getElementById('place-poi').disabled = !selectedRoom || placingPoi || placingDoor || shapeMode;
  document.getElementById('cancel-poi').disabled = !placingPoi;
  poiTypeInput.disabled = !selectedRoom || placingDoor || shapeMode;
  if (selectedPoi) poiTypeInput.value = selectedPoi.type;
  const type = selectedPoi?.type || poiTypeInput.value;
  const colors = { ...itemColors, black: itemColors.black || '#000000' };
  poiColorInput.replaceChildren();
  for (const [name, color] of Object.entries(colors)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.style.color = color;
    poiColorInput.append(option);
  }
  const desiredColor = selectedPoi?.color || poiColorInput.value || getDefaultPoiColor(type, itemColors);
  poiColorInput.value = colors[desiredColor] ? desiredColor : getDefaultPoiColor(type, itemColors);
  if (selectedPoi && !colors[selectedPoi.color]) selectedPoi.color = poiColorInput.value;
  poiColorInput.disabled = !selectedRoom || shapeMode || Boolean(POI_TYPES[type]?.color);
  document.getElementById('delete-poi').disabled = !selectedPoi;
  document.getElementById('place-door').disabled = !selectedRoom || placingDoor || placingPoi || shapeMode;
  document.getElementById('cancel-door').disabled = !placingDoor;
  document.getElementById('delete-door').disabled = !selectedDoor;
  const color = selectedDoor?.color || doorColorInput.value || doorColors[0];
  doorColorInput.replaceChildren();
  for (const name of doorColors) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.style.color = itemColors[name] || '#111';
    doorColorInput.append(option);
  }
  doorColorInput.value = doorColors.includes(color) ? color : doorColors[0] || '';
  doorColorInput.disabled = !selectedRoom || shapeMode;
  const note = document.getElementById('rainbow-door-note');
  const showNote = Boolean(selectedRoom && window.equinoxConfig.rainbowDoorNote &&
    (selectedDoor?.color === 'rainbow' || (!selectedDoor && doorColorInput.value === 'rainbow')));
  note.textContent = showNote ? window.equinoxConfig.rainbowDoorNote : '';
  note.hidden = !showNote;
}

async function init() {
  const config = await loadConfig();
  window.equinoxConfig = config;
  const canvas = document.getElementById('map');
  const ctx = canvas.getContext('2d');
  const redraw = () => {
    const rectanglePreview = interaction?.type === 'create'
      ? createRectangle(getRoomBounds(interaction.start, interaction.end), '')
      : null;
    const shapePreview = shapeMode && shapePoints.length
      ? { ...getBounds(shapePoints), points: shapePoints, shape: 'polygon', valid: isValidShape(shapePoints, canvas) }
      : null;
    const preview = rectanglePreview || shapePreview;
    drawGrid(ctx, canvas.width, canvas.height, preview, config.itemColors);
  };

  const drawShapeButton = document.getElementById('draw-shape');
  const finishShapeButton = document.getElementById('finish-shape');
  const cancelShapeButton = document.getElementById('cancel-shape');
  const poiTypeInput = document.getElementById('poi-type');
  const poiColorInput = document.getElementById('poi-color');
  const doorColorInput = document.getElementById('door-color');
  poiColorInput.value = getDefaultPoiColor(poiTypeInput.value, config.itemColors);
  doorColorInput.value = config.doorColors[0] || '';
  poiTypeInput.addEventListener('change', () => {
    if (selectedPoi) {
      selectedPoi.type = poiTypeInput.value;
      selectedPoi.color = getDefaultPoiColor(selectedPoi.type, config.itemColors);
    }
    updateRoomControls(config.itemColors);
    redraw();
  });
  poiColorInput.addEventListener('change', () => {
    if (!selectedPoi) return;
    selectedPoi.color = poiColorInput.value;
    redraw();
  });
  doorColorInput.addEventListener('change', () => {
    if (selectedDoor) {
      selectedDoor.color = doorColorInput.value;
      redraw();
    }
    updateRoomControls(config.itemColors);
  });
  updateRoomControls(config.itemColors);

  document.getElementById('save-map').addEventListener('click', () => {
    const file = new Blob([JSON.stringify(createMapData(canvas), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'equinox-map.json';
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById('map-status').textContent = 'Map saved to a JSON file.';
  });

  const mapFileInput = document.getElementById('map-file');
  document.getElementById('load-map').addEventListener('click', () => mapFileInput.click());
  mapFileInput.addEventListener('change', async () => {
    const file = mapFileInput.files[0];
    if (!file) return;
    const status = document.getElementById('map-status');
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Map files must be 2 MB or smaller.');
      const loadedRooms = validateMapData(
        JSON.parse(await file.text()), canvas, config.itemColors, config.doorColors
      );
      rooms.splice(0, rooms.length, ...loadedRooms);
      selectedRoom = null;
      selectedPoi = null;
      selectedDoor = null;
      interaction = null;
      shapeMode = false;
      shapePoints = [];
      placingPoi = false;
      placingDoor = false;
      document.getElementById('map-help').textContent =
        'Drag on an empty grid area to create a rectangular room. To draw a complex room, click its corners on grid intersections, then finish; edges must be horizontal or vertical. Select and drag a room to move it, or drag its lower-right handle to resize it. Select a room to place points of interest inside or doors on its boundary; select a marker or door to edit it.';
      updateRoomControls(config.itemColors);
      redraw();
      status.textContent = 'Map loaded successfully.';
    } catch (error) {
      status.textContent = error instanceof SyntaxError
        ? 'The selected file is not valid JSON.'
        : error.message;
    } finally {
      mapFileInput.value = '';
    }
  });

  drawShapeButton.addEventListener('click', () => {
    shapeMode = true;
    placingPoi = false;
    placingDoor = false;
    selectedPoi = null;
    selectedDoor = null;
    shapePoints = [];
    document.getElementById('map-help').textContent =
      'Click each corner on a grid intersection in order. Edges must be horizontal or vertical; finish to close the shape.';
    updateRoomControls(config.itemColors);
    redraw();
  });
  finishShapeButton.addEventListener('click', () => {
    if (!isValidShape(shapePoints, canvas)) return;
    selectedRoom = {
      ...getBounds(shapePoints),
      points: shapePoints.map(point => ({ ...point })),
      shape: 'polygon',
      name: `Room ${rooms.length + 1}`,
      pois: [],
      doors: []
    };
    rooms.push(selectedRoom);
    shapePoints = [];
    shapeMode = false;
    document.getElementById('map-help').textContent =
      'Drag on an empty grid area to create a rectangular room. Select and drag a room to move it, or drag its lower-right handle to resize it. Select a room to place points of interest inside or doors on its boundary; select a marker or door to edit it.';
    updateRoomControls(config.itemColors);
    redraw();
  });
  cancelShapeButton.addEventListener('click', () => {
    shapePoints = [];
    shapeMode = false;
    document.getElementById('map-help').textContent =
      'Drag on an empty grid area to create a rectangular room. Select and drag a room to move it, or drag its lower-right handle to resize it. Select a room to place points of interest inside or doors on its boundary; select a marker or door to edit it.';
    updateRoomControls(config.itemColors);
    redraw();
  });

  const nameInput = document.getElementById('room-name');
  nameInput.addEventListener('input', () => {
    if (!selectedRoom) return;
    selectedRoom.name = nameInput.value;
    redraw();
  });
  document.getElementById('place-poi').addEventListener('click', () => {
    if (!selectedRoom) return;
    placingPoi = true;
    placingDoor = false;
    selectedPoi = null;
    selectedDoor = null;
    updateRoomControls(config.itemColors);
    document.getElementById('map-help').textContent =
      'Choose a point type and click a tile inside the selected room to place it.';
    redraw();
  });
  document.getElementById('cancel-poi').addEventListener('click', () => {
    placingPoi = false;
    document.getElementById('map-help').textContent =
      'Select a room to place points of interest inside or doors on its boundary; select a marker or door to edit it.';
    updateRoomControls(config.itemColors);
    redraw();
  });
  document.getElementById('delete-poi').addEventListener('click', () => {
    if (!selectedRoom || !selectedPoi) return;
    selectedRoom.pois.splice(selectedRoom.pois.indexOf(selectedPoi), 1);
    selectedPoi = null;
    updateRoomControls(config.itemColors);
    redraw();
  });
  document.getElementById('delete-room').addEventListener('click', () => {
    if (!selectedRoom) return;
    rooms.splice(rooms.indexOf(selectedRoom), 1);
    selectedRoom = null;
    selectedPoi = null;
    selectedDoor = null;
    placingPoi = false;
    placingDoor = false;
    updateRoomControls(config.itemColors);
    redraw();
  });
  document.getElementById('place-door').addEventListener('click', () => {
    if (!selectedRoom) return;
    placingDoor = true;
    placingPoi = false;
    selectedPoi = null;
    selectedDoor = null;
    updateRoomControls(config.itemColors);
    document.getElementById('map-help').textContent =
      'Click a room boundary to place a door. Select a door to change its colour or delete it.';
    redraw();
  });
  document.getElementById('cancel-door').addEventListener('click', () => {
    placingDoor = false;
    document.getElementById('map-help').textContent =
      'Select a room to place points of interest inside or doors on its boundary; select a marker or door to edit it.';
    updateRoomControls(config.itemColors);
    redraw();
  });
  document.getElementById('delete-door').addEventListener('click', () => {
    if (!selectedRoom || !selectedDoor) return;
    selectedRoom.doors.splice(selectedRoom.doors.indexOf(selectedDoor), 1);
    selectedDoor = null;
    updateRoomControls(config.itemColors);
    redraw();
  });

  canvas.addEventListener('pointerdown', event => {
    if (shapeMode) {
      shapePoints.push(getGridPoint(canvas, event));
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    const position = getPosition(canvas, event);
    if (placingDoor) {
      const door = getDoorOnBoundary(selectedRoom, position);
      if (!door) return;
      selectedRoom.doors ||= [];
      selectedDoor = selectedRoom.doors.find(existing =>
        existing.x === door.x && existing.y === door.y && existing.orientation === door.orientation
      );
      if (!selectedDoor) {
        selectedDoor = { ...door, color: doorColorInput.value };
        selectedRoom.doors.push(selectedDoor);
      }
      placingDoor = false;
      document.getElementById('map-help').textContent =
        'Select a room to place points of interest inside or doors on its boundary; select a marker or door to edit it.';
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    if (placingPoi) {
      const cell = getCell(canvas, event);
      const pointX = cell.x + 0.5;
      const pointY = cell.y + 0.5;
      if (!pointInPolygon(pointX, pointY, selectedRoom.points)) return;
      const poi = {
        x: pointX - selectedRoom.x,
        y: pointY - selectedRoom.y,
        type: poiTypeInput.value,
        color: poiColorInput.value
      };
      selectedRoom.pois ||= [];
      selectedRoom.pois.push(poi);
      selectedPoi = poi;
      selectedDoor = null;
      placingPoi = false;
      document.getElementById('map-help').textContent =
        'Select a room to place points of interest inside or doors on its boundary; select a marker or door to edit it.';
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    const foundDoor = getDoorAt(position);
    if (foundDoor) {
      selectedRoom = foundDoor.room;
      selectedDoor = foundDoor.door;
      selectedPoi = null;
      interaction = null;
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    const foundPoi = getPoiAt(position);
    if (foundPoi) {
      selectedRoom = foundPoi.room;
      selectedPoi = foundPoi.poi;
      selectedDoor = null;
      interaction = null;
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    const cell = getCell(canvas, event);
    const room = getRoomAt(position);
    selectedPoi = null;
    selectedDoor = null;
    if (room) {
      selectedRoom = room;
      interaction = {
        type: isResizeHandle(room, position) ? 'resize' : 'move',
        room,
        start: cell,
        original: {
          x: room.x, y: room.y, width: room.width, height: room.height,
          points: room.points.map(point => ({ ...point })),
          pois: (room.pois || []).map(poi => ({ ...poi })),
          doors: (room.doors || []).map(door => ({ ...door }))
        }
      };
    } else {
      selectedRoom = null;
      interaction = { type: 'create', start: cell, end: cell };
    }
    updateRoomControls(config.itemColors);
    canvas.setPointerCapture(event.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', event => {
    if (!interaction) return;
    const cell = getCell(canvas, event);
    if (interaction.type === 'create') {
      interaction.end = cell;
    } else {
      const { room, start, original } = interaction;
      const dx = cell.x - start.x;
      const dy = cell.y - start.y;
      if (interaction.type === 'move') {
        room.x = Math.max(0, Math.min(original.x + dx, canvas.width / TILE - room.width));
        room.y = Math.max(0, Math.min(original.y + dy, canvas.height / TILE - room.height));
        const moveX = room.x - original.x;
        const moveY = room.y - original.y;
        room.points = original.points.map(point => ({ x: point.x + moveX, y: point.y + moveY }));
      } else {
        room.width = Math.max(1, Math.min(original.width + dx, canvas.width / TILE - original.x));
        room.height = Math.max(1, Math.min(original.height + dy, canvas.height / TILE - original.y));
        room.points = rectanglePoints(room);
        room.doors = (room.doors || []).filter(door => isDoorOnBoundary(room, door));
        if (selectedDoor && !room.doors.includes(selectedDoor)) selectedDoor = null;
        for (const poi of room.pois || []) {
          poi.x = Math.max(0.5, Math.min(poi.x, room.width - 0.5));
          poi.y = Math.max(0.5, Math.min(poi.y, room.height - 0.5));
        }
      }
    }
    redraw();
  });
  canvas.addEventListener('pointerup', event => {
    if (!interaction) return;
    if (interaction.type === 'create') {
      interaction.end = getCell(canvas, event);
      const clickedRoom = getRoomAt(getPosition(canvas, event));
      if (clickedRoom) {
        selectedRoom = clickedRoom;
      } else {
        const bounds = getRoomBounds(interaction.start, interaction.end);
        selectedRoom = createRectangle(bounds, `Room ${rooms.length + 1}`);
        rooms.push(selectedRoom);
      }
      selectedPoi = null;
    }
    interaction = null;
    updateRoomControls(config.itemColors);
    redraw();
  });
  canvas.addEventListener('pointercancel', () => {
    if (interaction && interaction.type !== 'create') {
      Object.assign(interaction.room, interaction.original);
      selectedPoi = null;
    }
    if (interaction?.type === 'create') selectedRoom = null;
    interaction = null;
    updateRoomControls(config.itemColors);
    redraw();
  });

  redraw();
}

init().catch(error => {
  console.error(error);
  document.getElementById('map-help').textContent =
    'The map could not be loaded. Check that it is served over HTTP and try again.';
});
