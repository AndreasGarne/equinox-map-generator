const TILE = 32;
const rooms = [];
let selectedRoom = null;
let interaction = null;
let shapeMode = false;
let shapePoints = [];

async function loadConfig() {
  const res = await fetch('config/colors.json');
  if (!res.ok) throw new Error(`Unable to load colour configuration (${res.status})`);
  return res.json();
}

function drawGrid(ctx, w, h, preview = null) {
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

function createRectangle(bounds, name) {
  return { ...bounds, points: rectanglePoints(bounds), shape: 'rectangle', name };
}

function updateRoomControls() {
  const nameInput = document.getElementById('room-name');
  const deleteButton = document.getElementById('delete-room');
  nameInput.disabled = !selectedRoom;
  nameInput.value = selectedRoom ? selectedRoom.name : '';
  deleteButton.disabled = !selectedRoom;
  document.getElementById('draw-shape').disabled = shapeMode;
  document.getElementById('finish-shape').disabled = !shapeMode || !isValidShape(shapePoints, document.getElementById('map'));
  document.getElementById('cancel-shape').disabled = !shapeMode;
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
    drawGrid(ctx, canvas.width, canvas.height, preview);
  };

  const drawShapeButton = document.getElementById('draw-shape');
  const finishShapeButton = document.getElementById('finish-shape');
  const cancelShapeButton = document.getElementById('cancel-shape');
  drawShapeButton.addEventListener('click', () => {
    shapeMode = true;
    shapePoints = [];
    document.getElementById('map-help').textContent =
      'Click each corner on a grid intersection in order. Edges must be horizontal or vertical; finish to close the shape.';
    updateRoomControls();
    redraw();
  });
  finishShapeButton.addEventListener('click', () => {
    if (!isValidShape(shapePoints, canvas)) return;
    selectedRoom = {
      ...getBounds(shapePoints),
      points: shapePoints.map(point => ({ ...point })),
      shape: 'polygon',
      name: `Room ${rooms.length + 1}`
    };
    rooms.push(selectedRoom);
    shapePoints = [];
    shapeMode = false;
    document.getElementById('map-help').textContent =
      'Drag on an empty grid area to create a rectangular room. Select and drag a room to move it, or drag its lower-right handle to resize it.';
    updateRoomControls();
    redraw();
  });
  cancelShapeButton.addEventListener('click', () => {
    shapePoints = [];
    shapeMode = false;
    document.getElementById('map-help').textContent =
      'Drag on an empty grid area to create a rectangular room. Select and drag a room to move it, or drag its lower-right handle to resize it.';
    updateRoomControls();
    redraw();
  });

  const nameInput = document.getElementById('room-name');
  nameInput.addEventListener('input', () => {
    if (!selectedRoom) return;
    selectedRoom.name = nameInput.value;
    redraw();
  });
  document.getElementById('delete-room').addEventListener('click', () => {
    if (!selectedRoom) return;
    rooms.splice(rooms.indexOf(selectedRoom), 1);
    selectedRoom = null;
    updateRoomControls();
    redraw();
  });

  canvas.addEventListener('pointerdown', event => {
    if (shapeMode) {
      shapePoints.push(getGridPoint(canvas, event));
      updateRoomControls();
      redraw();
      return;
    }
    const cell = getCell(canvas, event);
    const position = getPosition(canvas, event);
    const room = getRoomAt(position);
    if (room) {
      selectedRoom = room;
      interaction = {
        type: isResizeHandle(room, position) ? 'resize' : 'move',
        room,
        start: cell,
        original: {
          x: room.x, y: room.y, width: room.width, height: room.height,
          points: room.points.map(point => ({ ...point }))
        }
      };
    } else {
      selectedRoom = null;
      interaction = { type: 'create', start: cell, end: cell };
    }
    updateRoomControls();
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
    }
    interaction = null;
    updateRoomControls();
    redraw();
  });
  canvas.addEventListener('pointercancel', () => {
    if (interaction && interaction.type !== 'create') {
      Object.assign(interaction.room, interaction.original);
    }
    if (interaction?.type === 'create') selectedRoom = null;
    interaction = null;
    updateRoomControls();
    redraw();
  });

  redraw();
}

init().catch(error => {
  console.error(error);
  document.getElementById('map-help').textContent =
    'The map could not be loaded. Check that it is served over HTTP and try again.';
});
