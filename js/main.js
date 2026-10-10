const TILE = 32;
const LEGACY_BLACK_COLOR = 'black';
const POI_BADGE_FILL = '#273449';
const POI_BADGE_STROKE = '#f8fafc';
const POI_TYPES = {
  weapon: { letter: 'W', color: '#111' },
  orb: { letter: 'O', color: '#1e3a8a' },
  apple: { letter: 'A' },
  potion: { letter: 'P' },
  boss: { letter: 'B', color: '#dc2626' },
  key: { letter: 'K' },
  ladder: { letter: 'L', color: '#c4a484' },
  magic: { letter: 'M', color: '#3b82f6' }
};
const OBSTACLE_TYPES = ['spikes', 'wall'];
const rooms = [];
let selectedRoom = null;
let interaction = null;
let tool = 'select';
let shapePoints = [];
let selectedPoi = null;
let selectedObstacle = null;
let selectedDoor = null;

const TOOL_HELP = {
  select: 'Click a room, point, door or obstacle to select it. Drag a room to move it, or drag its lower-right handle to resize it.',
  room: 'Drag on the map to draw a rectangular room.',
  complex: 'Click each corner on a grid intersection in order. Edges must be horizontal or vertical; then finish the shape.',
  poi: 'Choose a type and colour, then click a tile inside a room to place a point of interest.',
  door: 'Choose a colour, then click a room boundary to place a door.',
  obstacle: 'Choose spikes or wall, then click a tile inside a room to place it. Clicking an occupied tile replaces it.',
  pan: 'Drag to scroll the map.',
  zoom: 'Use the + and - buttons, or pinch to zoom on a touch screen.'
};

async function loadConfig() {
  const res = await fetch('config/colors.json');
  if (!res.ok) throw new Error(`Unable to load colour configuration (${res.status})`);
  const config = await res.json();
  if (!config || typeof config !== 'object' || !config.itemColors || typeof config.itemColors !== 'object' ||
    Array.isArray(config.itemColors) ||
    !Object.keys(config.itemColors).some(name => name !== LEGACY_BLACK_COLOR)) {
    throw new Error('At least one non-black POI color must be configured.');
  }
  return config;
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
    for (const obstacle of room.obstacles || []) drawObstacle(ctx, room, obstacle, obstacle === selectedObstacle);
  }

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
      drawPoi(ctx, poi, x, y, type.color || itemColors[poi.color] || '#111');
    }
  }
}

function drawPoi(ctx, poi, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = POI_BADGE_FILL;
  ctx.strokeStyle = POI_BADGE_STROKE;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (poi.type === 'weapon') {
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = POI_BADGE_STROKE;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-2, -10);
    ctx.lineTo(3, 1);
    ctx.lineTo(-3, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-3, 1);
    ctx.lineTo(3, 1);
    ctx.lineTo(2, 8);
    ctx.lineTo(-2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = POI_BADGE_STROKE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, 1);
    ctx.lineTo(5, 1);
    ctx.stroke();
  } else if (poi.type === 'orb') {
    const glow = ctx.createRadialGradient(-4, -5, 1, 0, 0, 11);
    glow.addColorStop(0, '#fff');
    glow.addColorStop(0.35, '#93c5fd');
    glow.addColorStop(1, color);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3, -4, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (poi.type === 'apple') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.bezierCurveTo(-10, -10, -11, 1, -6, 7);
    ctx.quadraticCurveTo(-2, 11, 0, 7);
    ctx.quadraticCurveTo(4, 11, 7, 6);
    ctx.bezierCurveTo(12, -3, 5, -9, 0, -3);
    ctx.fill();
    ctx.strokeStyle = '#365314';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(1, -9);
    ctx.quadraticCurveTo(5, -11, 7, -8);
    ctx.quadraticCurveTo(3, -6, 1, -6);
    ctx.stroke();
  } else if (poi.type === 'potion') {
    ctx.fillStyle = '#e0f2fe';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-3, -9);
    ctx.lineTo(3, -9);
    ctx.lineTo(3, -5);
    ctx.quadraticCurveTo(10, -1, 8, 7);
    ctx.quadraticCurveTo(7, 10, 0, 10);
    ctx.quadraticCurveTo(-7, 10, -8, 7);
    ctx.quadraticCurveTo(-10, -1, -3, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(-6, 2, 12, 5);
    ctx.strokeRect(-6, 2, 12, 5);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(-4, -12, 8, 3);
    ctx.strokeRect(-4, -12, 8, 3);
  } else if (poi.type === 'boss') {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-7, -4);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-3, -7);
    ctx.quadraticCurveTo(0, -10, 3, -7);
    ctx.lineTo(10, -10);
    ctx.lineTo(7, -3);
    ctx.lineTo(6, 5);
    ctx.lineTo(2, 9);
    ctx.lineTo(-5, 9);
    ctx.lineTo(-8, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(-5, -2, 3, 4);
    ctx.fillRect(2, -2, 3, 4);
    ctx.fillRect(-3, 6, 2, 3);
    ctx.fillRect(1, 6, 2, 3);
  } else if (poi.type === 'key') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-5, -4, 4, 0, Math.PI * 2);
    ctx.moveTo(-2, -1);
    ctx.lineTo(7, 8);
    ctx.lineTo(10, 5);
    ctx.moveTo(4, 5);
    ctx.lineTo(7, 2);
    ctx.stroke();
  } else if (poi.type === 'ladder') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.lineTo(-6, 9);
    ctx.moveTo(6, -9);
    ctx.lineTo(6, 9);
    for (const rung of [-5, 0, 5]) {
      ctx.moveTo(-6, rung);
      ctx.lineTo(6, rung);
    }
    ctx.stroke();
  } else if (poi.type === 'magic') {
    ctx.fillStyle = '#eff6ff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.lineTo(6, -8);
    ctx.lineTo(6, 8);
    ctx.lineTo(-7, 8);
    ctx.quadraticCurveTo(-10, 8, -10, 5);
    ctx.quadraticCurveTo(-10, 2, -7, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-7, -5, 3, 0, Math.PI * 2);
    ctx.arc(-7, 5, 3, 0, Math.PI * 2);
    ctx.moveTo(-4, -3);
    ctx.lineTo(3, -3);
    ctx.moveTo(-4, 1);
    ctx.lineTo(3, 1);
    ctx.moveTo(-4, 5);
    ctx.lineTo(2, 5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawObstacle(ctx, room, obstacle, isSelected) {
  const x = (room.x + obstacle.x) * TILE;
  const y = (room.y + obstacle.y) * TILE;
  if (obstacle.type === 'wall') {
    ctx.fillStyle = '#44403c';
    ctx.fillRect(x + 1, y + 1, TILE - 1, TILE - 1);
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + TILE / 2);
    ctx.lineTo(x + TILE, y + TILE / 2);
    ctx.moveTo(x + TILE / 2, y + 1);
    ctx.lineTo(x + TILE / 2, y + TILE / 2);
    ctx.moveTo(x + TILE / 4, y + TILE / 2);
    ctx.lineTo(x + TILE / 4, y + TILE);
    ctx.moveTo(x + (TILE * 3) / 4, y + TILE / 2);
    ctx.lineTo(x + (TILE * 3) / 4, y + TILE);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#e5e7eb';
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const left = x + 3 + i * 9;
      ctx.beginPath();
      ctx.moveTo(left, y + TILE - 5);
      ctx.lineTo(left + 4.5, y + 6);
      ctx.lineTo(left + 9, y + TILE - 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  if (isSelected) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, TILE - 3, TILE - 3);
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

function getObstacleAt(position) {
  const cellX = Math.floor(position.x / TILE);
  const cellY = Math.floor(position.y / TILE);
  for (const room of [...rooms].reverse()) {
    const obstacle = (room.obstacles || []).find(item => room.x + item.x === cellX && room.y + item.y === cellY);
    if (obstacle) return { room, obstacle };
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

function createMapData(canvas, name) {
  return {
    format: 'equinox-map',
    version: 1,
    name,
    grid: { width: canvas.width, height: canvas.height, tileSize: TILE },
    rooms: rooms.map(room => ({
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
      points: room.points.map(point => ({ ...point })),
      shape: room.shape,
      pois: (room.pois || []).map(poi => ({ ...poi })),
      doors: (room.doors || []).map(door => ({ ...door })),
      obstacles: (room.obstacles || []).map(obstacle => ({ ...obstacle }))
    }))
  };
}

function validateMapData(data, canvas, itemColors, doorColors) {
  const invalid = () => { throw new Error('The selected file is not a valid Equinox map.'); };
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
    data.format !== 'equinox-map' || data.version !== 1 ||
    (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100)) ||
    !Number.isInteger(data.grid?.width) || !Number.isInteger(data.grid?.height) ||
    data.grid.width < TILE || data.grid.height < TILE ||
    data.grid.width > canvas.width || data.grid.height > canvas.height ||
    data.grid.tileSize !== TILE || !Array.isArray(data.rooms) || data.rooms.length > 1000) invalid();

  const poiColors = new Set(Object.keys(itemColors));
  const roomsToLoad = data.rooms.map(room => {
    if (!room || typeof room !== 'object' || Array.isArray(room) ||
      !['rectangle', 'polygon'].includes(room.shape) ||
      !Number.isInteger(room.x) || !Number.isInteger(room.y) ||
      !Number.isInteger(room.width) || !Number.isInteger(room.height) ||
      room.width < 1 || room.height < 1 ||
      !Array.isArray(room.points) || room.points.length > 1000 ||
      !Array.isArray(room.pois) || room.pois.length > 1000 ||
      !Array.isArray(room.doors) || room.doors.length > 1000 ||
      (room.obstacles !== undefined && (!Array.isArray(room.obstacles) || room.obstacles.length > 10000))) invalid();

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
        !POI_TYPES[poi.type] ||
        (!poiColors.has(poi.color) && poi.color !== LEGACY_BLACK_COLOR) ||
        !pointInPolygon(room.x + poi.x, room.y + poi.y, points)) invalid();
      const color = poi.color === LEGACY_BLACK_COLOR ? getDefaultPoiColor(itemColors) : poi.color;
      if (!color || !poiColors.has(color)) invalid();
      return { x: poi.x, y: poi.y, type: poi.type, color };
    });
    const doors = room.doors.map(door => {
      if (!door || typeof door !== 'object' || Array.isArray(door) ||
        !Number.isFinite(door.x) || !Number.isFinite(door.y) ||
        !Number.isInteger(door.x * 2) || !Number.isInteger(door.y * 2) ||
        !['horizontal', 'vertical'].includes(door.orientation) ||
        !doorColors.includes(door.color) || !isDoorOnBoundary(room, door)) invalid();
      return { x: door.x, y: door.y, orientation: door.orientation, color: door.color };
    });
    const obstacles = (room.obstacles || []).map(obstacle => {
      if (!obstacle || typeof obstacle !== 'object' || Array.isArray(obstacle) ||
        !Number.isInteger(obstacle.x) || !Number.isInteger(obstacle.y) ||
        !OBSTACLE_TYPES.includes(obstacle.type) ||
        !pointInPolygon(room.x + obstacle.x + 0.5, room.y + obstacle.y + 0.5, points)) invalid();
      return { x: obstacle.x, y: obstacle.y, type: obstacle.type };
    });
    return {
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
      points: points.map(point => ({ x: point.x, y: point.y })),
      shape: room.shape,
      pois,
      doors,
      obstacles
    };
  });
  return roomsToLoad;
}

function createRectangle(bounds) {
  return { ...bounds, points: rectanglePoints(bounds), shape: 'rectangle', pois: [], doors: [], obstacles: [] };
}

function getMapFilename(name) {
  return `${name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-').replace(/^-|-$/g, '')}.json`;
}

function getDefaultPoiColor(itemColors) {
  return Object.keys(itemColors).find(name => name !== LEGACY_BLACK_COLOR);
}

function updateRoomControls(itemColors, doorColors = window.equinoxConfig.doorColors) {
  const poiTypeInput = document.getElementById('poi-type');
  const poiColorInput = document.getElementById('poi-color');
  const doorColorInput = document.getElementById('door-color');
  for (const button of document.querySelectorAll('[data-tool]')) {
    const active = button.dataset.tool === tool;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('active', active);
  }
  document.getElementById('map-help').textContent = TOOL_HELP[tool];
  document.getElementById('shape-options').hidden = tool !== 'complex';
  document.getElementById('poi-options').hidden = tool !== 'poi' && !selectedPoi;
  document.getElementById('door-options').hidden = tool !== 'door' && !selectedDoor;
  document.getElementById('obstacle-options').hidden = tool !== 'obstacle' && !selectedObstacle;
  document.getElementById('finish-shape').disabled =
    tool !== 'complex' || !isValidShape(shapePoints, document.getElementById('map'));
  document.getElementById('cancel-shape').disabled = tool !== 'complex';
  document.getElementById('delete-selected').disabled = !selectedRoom;
  if (selectedPoi) poiTypeInput.value = selectedPoi.type;
  if (selectedObstacle) document.getElementById('obstacle-type').value = selectedObstacle.type;
  const type = selectedPoi?.type || poiTypeInput.value;
  const colors = Object.fromEntries(Object.entries(itemColors)
    .filter(([name]) => name !== LEGACY_BLACK_COLOR));
  poiColorInput.replaceChildren();
  for (const [name, color] of Object.entries(colors)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.style.color = color;
    poiColorInput.append(option);
  }
  const desiredColor = selectedPoi?.color || poiColorInput.value || getDefaultPoiColor(itemColors);
  poiColorInput.value = colors[desiredColor] ? desiredColor : getDefaultPoiColor(itemColors);
  if (selectedPoi && !POI_TYPES[selectedPoi.type]?.color && !colors[selectedPoi.color]) {
    selectedPoi.color = poiColorInput.value;
  }
  poiColorInput.disabled = Boolean(POI_TYPES[type]?.color);
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
  const note = document.getElementById('rainbow-door-note');
  const showNote = Boolean(window.equinoxConfig.rainbowDoorNote && !document.getElementById('door-options').hidden &&
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
      ? createRectangle(getRoomBounds(interaction.start, interaction.end))
      : null;
    const shapePreview = tool === 'complex' && shapePoints.length
      ? { ...getBounds(shapePoints), points: shapePoints, shape: 'polygon', valid: isValidShape(shapePoints, canvas) }
      : null;
    const preview = rectanglePreview || shapePreview;
    drawGrid(ctx, canvas.width, canvas.height, preview, config.itemColors);
  };

  const finishShapeButton = document.getElementById('finish-shape');
  const cancelShapeButton = document.getElementById('cancel-shape');
  const poiTypeInput = document.getElementById('poi-type');
  const poiColorInput = document.getElementById('poi-color');
  const doorColorInput = document.getElementById('door-color');
  poiColorInput.value = getDefaultPoiColor(config.itemColors);
  doorColorInput.value = config.doorColors[0] || '';
  poiTypeInput.addEventListener('change', () => {
    if (selectedPoi) {
      selectedPoi.type = poiTypeInput.value;
      selectedPoi.color = getDefaultPoiColor(config.itemColors);
    }
    updateRoomControls(config.itemColors);
    redraw();
  });
  document.getElementById('obstacle-type').addEventListener('change', event => {
    if (selectedObstacle) {
      selectedObstacle.type = event.target.value;
      redraw();
    }
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

  const mapList = document.getElementById('map-list');
  const saveOptions = document.getElementById('save-options');
  const nameInput = document.getElementById('map-name');
  const status = document.getElementById('map-status');
  let catalogMaps = [];
  let currentMapName = '';
  let currentMapFile = '';
  const snapshot = () => JSON.stringify(createMapData(canvas, '').rooms);
  let savedSnapshot = snapshot();
  const hasUnsavedChanges = () => snapshot() !== savedSnapshot;

  const getDefaultMapName = () => {
    if (currentMapName) return currentMapName;
    const taken = new Set(catalogMaps.flatMap(map => [map.name.toLowerCase(), map.file]));
    let number = 1;
    while (taken.has(`map_name_${number}`) || taken.has(getMapFilename(`map_name_${number}`))) number++;
    return `map_name_${number}`;
  };

  const confirmSave = () => {
    const name = nameInput.value.trim();
    const filename = getMapFilename(name);
    if (!name || filename === '.json') {
      status.textContent = 'Enter a map name containing at least one letter or number.';
      nameInput.focus();
      return;
    }
    const file = new Blob([JSON.stringify(createMapData(canvas, name), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const download = document.createElement('a');
    download.href = url;
    download.download = filename;
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    currentMapName = name;
    savedSnapshot = snapshot();
    saveOptions.hidden = true;
    status.textContent = `Downloaded ${filename}. Add it to the maps folder and list it in maps/index.json to load it here.`;
  };
  document.getElementById('save-map').addEventListener('click', () => {
    saveOptions.hidden = !saveOptions.hidden;
    if (saveOptions.hidden) return;
    nameInput.value = getDefaultMapName();
    nameInput.focus();
    nameInput.select();
  });
  document.getElementById('confirm-save').addEventListener('click', confirmSave);
  nameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') confirmSave();
    else if (event.key === 'Escape') saveOptions.hidden = true;
  });

  try {
    const catalogResponse = await fetch('maps/index.json');
    if (!catalogResponse.ok) throw new Error(`Unable to load map list (${catalogResponse.status}).`);
    const catalog = await catalogResponse.json();
    if (!catalog || !Array.isArray(catalog.maps) ||
      catalog.maps.some(map => !map || typeof map.name !== 'string' || !map.name.trim() ||
        map.name.length > 100 || typeof map.file !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(map.file))) {
      throw new Error('The map list is not valid.');
    }
    const filenames = catalog.maps.map(map => map.file);
    if (new Set(filenames).size !== filenames.length) throw new Error('The map list contains duplicate files.');
    catalogMaps = catalog.maps;
    mapList.replaceChildren();
    if (!catalog.maps.length) {
      mapList.add(new Option('No maps available', ''));
      status.textContent =
        'No maps are listed yet. Add map files to the maps folder and list them in maps/index.json.';
    } else {
      mapList.add(new Option('- select map -', ''));
      for (const map of catalog.maps) mapList.add(new Option(map.name, map.file));
      mapList.disabled = false;
    }
  } catch (error) {
    status.textContent = error.message;
  }
  mapList.addEventListener('change', async () => {
    const requestedFile = mapList.value;
    if (!requestedFile) {
      mapList.value = currentMapFile;
      return;
    }
    if (hasUnsavedChanges() &&
      !window.confirm('You have unsaved changes. Loading another map will discard them. Continue?')) {
      mapList.value = currentMapFile;
      return;
    }
    const selectedMap = mapList.selectedOptions[0];
    try {
      const response = await fetch(`maps/${encodeURIComponent(requestedFile)}`);
      if (!response.ok) throw new Error(`Unable to load ${selectedMap.textContent} (${response.status}).`);
      const contentLength = Number(response.headers.get('content-length'));
      if (contentLength > 2 * 1024 * 1024) throw new Error('Map files must be 2 MB or smaller.');
      const contents = await response.text();
      if (new TextEncoder().encode(contents).length > 2 * 1024 * 1024) {
        throw new Error('Map files must be 2 MB or smaller.');
      }
      const mapData = JSON.parse(contents);
      const loadedRooms = validateMapData(mapData, canvas, config.itemColors, config.doorColors);
      rooms.splice(0, rooms.length, ...loadedRooms);
      currentMapName = mapData.name || selectedMap.textContent;
      currentMapFile = requestedFile;
      savedSnapshot = snapshot();
      saveOptions.hidden = true;
      selectedRoom = null;
      selectedPoi = null;
      selectedObstacle = null;
      selectedDoor = null;
      interaction = null;
      tool = 'select';
      shapePoints = [];
      updateRoomControls(config.itemColors);
      redraw();
      status.textContent = `Loaded ${currentMapName}.`;
    } catch (error) {
      mapList.value = currentMapFile;
      status.textContent = error instanceof SyntaxError
        ? 'The selected map is not valid JSON.'
        : error.message;
    }
  });

  const viewport = document.getElementById('map-viewport');
  const ZOOM_STEP = 1.5;
  const ZOOM_MARGIN = 16;
  let zoom = 1;
  const getMinZoom = () => Math.min(1,
    (viewport.clientWidth - ZOOM_MARGIN) / canvas.width,
    (viewport.clientHeight - ZOOM_MARGIN) / canvas.height);
  const applyZoom = (newZoom, event) => {
    const minZoom = getMinZoom();
    newZoom = Math.max(minZoom, Math.min(1, newZoom));
    if (Math.abs(newZoom - minZoom) < 1e-6) newZoom = minZoom;
    const oldBounds = canvas.getBoundingClientRect();
    const fx = event ? (event.clientX - oldBounds.left) / oldBounds.width : 0.5;
    const fy = event ? (event.clientY - oldBounds.top) / oldBounds.height : 0.5;
    zoom = newZoom;
    canvas.style.width = `${canvas.width * zoom}px`;
    canvas.style.height = `${canvas.height * zoom}px`;
    const bounds = canvas.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    viewport.scrollLeft += bounds.left + fx * bounds.width - (event ? event.clientX : view.left + view.width / 2);
    viewport.scrollTop += bounds.top + fy * bounds.height - (event ? event.clientY : view.top + view.height / 2);
  };
  const zoomOptions = document.getElementById('zoom-options');
  const zoomBy = factor => applyZoom(zoom * factor);
  document.getElementById('zoom-in').addEventListener('click', () => zoomBy(ZOOM_STEP));
  document.getElementById('zoom-out').addEventListener('click', () => zoomBy(1 / ZOOM_STEP));
  const touches = new Map();
  let pinchDistance = 0;
  const pinchDist = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  canvas.addEventListener('pointerdown', event => {
    if (tool !== 'zoom' || event.pointerType !== 'touch') return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (touches.size === 2) pinchDistance = pinchDist();
  });
  canvas.addEventListener('pointermove', event => {
    if (tool !== 'zoom' || !touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size !== 2) return;
    const distance = pinchDist();
    if (pinchDistance > 0 && distance > 0) {
      const [a, b] = [...touches.values()];
      applyZoom(zoom * distance / pinchDistance, { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
    }
    pinchDistance = distance;
  });
  const endTouch = event => {
    touches.delete(event.pointerId);
    pinchDistance = touches.size === 2 ? pinchDist() : 0;
  };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  window.addEventListener('resize', () => { if (zoom < 1) applyZoom(zoom); });
  const setTool = newTool => {
    tool = newTool;
    shapePoints = [];
    interaction = null;
    if (tool !== 'select') {
      selectedPoi = null;
      selectedObstacle = null;
      selectedDoor = null;
    }
    touches.clear();
    zoomOptions.hidden = tool !== 'zoom';
    canvas.style.cursor = tool === 'pan' ? 'grab' : '';
    updateRoomControls(config.itemColors);
    redraw();
  };
  for (const button of document.querySelectorAll('[data-tool]')) {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  }
  const finishShape = () => {
    if (tool !== 'complex' || !isValidShape(shapePoints, canvas)) return;
    selectedRoom = {
      ...getBounds(shapePoints),
      points: shapePoints.map(point => ({ ...point })),
      shape: 'polygon',
      pois: [],
      doors: [],
      obstacles: []
    };
    rooms.push(selectedRoom);
    shapePoints = [];
    updateRoomControls(config.itemColors);
    redraw();
  };
  const deleteSelected = () => {
    if (!selectedRoom) return;
    if (selectedObstacle) {
      selectedRoom.obstacles.splice(selectedRoom.obstacles.indexOf(selectedObstacle), 1);
      selectedObstacle = null;
    } else if (selectedPoi) {
      selectedRoom.pois.splice(selectedRoom.pois.indexOf(selectedPoi), 1);
      selectedPoi = null;
    } else if (selectedDoor) {
      selectedRoom.doors.splice(selectedRoom.doors.indexOf(selectedDoor), 1);
      selectedDoor = null;
    } else {
      rooms.splice(rooms.indexOf(selectedRoom), 1);
      selectedRoom = null;
    }
    updateRoomControls(config.itemColors);
    redraw();
  };
  finishShapeButton.addEventListener('click', finishShape);
  cancelShapeButton.addEventListener('click', () => {
    shapePoints = [];
    updateRoomControls(config.itemColors);
    redraw();
  });
  document.getElementById('delete-selected').addEventListener('click', deleteSelected);
  document.addEventListener('keydown', event => {
    if (event.target.closest?.('input, select, textarea')) return;
    if (event.key === 'Escape') {
      if (tool === 'complex' && shapePoints.length) {
        shapePoints = [];
        updateRoomControls(config.itemColors);
        redraw();
      } else {
        selectedRoom = null;
        selectedPoi = null;
        selectedObstacle = null;
        selectedDoor = null;
        setTool('select');
      }
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === 'Enter' && tool === 'complex') {
      finishShape();
    }
  });

  canvas.addEventListener('pointerdown', event => {
    if (tool === 'zoom') return;
    if (tool === 'pan') {
      interaction = {
        type: 'pan',
        x: event.clientX, y: event.clientY,
        left: viewport.scrollLeft, top: viewport.scrollTop
      };
      canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === 'complex') {
      shapePoints.push(getGridPoint(canvas, event));
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    const position = getPosition(canvas, event);
    if (tool === 'door') {
      for (const room of [...rooms].reverse()) {
        const door = getDoorOnBoundary(room, position);
        if (!door) continue;
        room.doors ||= [];
        const existing = room.doors.find(item =>
          item.x === door.x && item.y === door.y && item.orientation === door.orientation);
        if (existing) existing.color = doorColorInput.value;
        else room.doors.push({ ...door, color: doorColorInput.value });
        selectedRoom = room;
        updateRoomControls(config.itemColors);
        redraw();
        return;
      }
      return;
    }
    if (tool === 'poi') {
      const room = getRoomAt(position);
      if (!room) return;
      const cell = getCell(canvas, event);
      const pointX = cell.x + 0.5;
      const pointY = cell.y + 0.5;
      if (!pointInPolygon(pointX, pointY, room.points)) return;
      room.pois ||= [];
      room.pois.push({
        x: pointX - room.x,
        y: pointY - room.y,
        type: poiTypeInput.value,
        color: poiColorInput.value
      });
      selectedRoom = room;
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    if (tool === 'obstacle') {
      const room = getRoomAt(position);
      if (!room) return;
      const cell = getCell(canvas, event);
      if (!pointInPolygon(cell.x + 0.5, cell.y + 0.5, room.points)) return;
      const x = cell.x - room.x;
      const y = cell.y - room.y;
      room.obstacles ||= [];
      const type = document.getElementById('obstacle-type').value;
      const existing = room.obstacles.find(item => item.x === x && item.y === y);
      if (existing) existing.type = type;
      else room.obstacles.push({ x, y, type });
      selectedRoom = room;
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    if (tool === 'room') {
      const cell = getCell(canvas, event);
      selectedRoom = null;
      selectedPoi = null;
      selectedDoor = null;
      interaction = { type: 'create', start: cell, end: cell };
      updateRoomControls(config.itemColors);
      canvas.setPointerCapture(event.pointerId);
      redraw();
      return;
    }
    const foundDoor = getDoorAt(position);
    if (foundDoor) {
      selectedRoom = foundDoor.room;
      selectedDoor = foundDoor.door;
      selectedPoi = null;
      selectedObstacle = null;
      interaction = null;
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    const foundPoi = getPoiAt(position);
    if (foundPoi) {
      selectedRoom = foundPoi.room;
      selectedPoi = foundPoi.poi;
      selectedObstacle = null;
      selectedDoor = null;
      interaction = null;
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    const foundObstacle = getObstacleAt(position);
    if (foundObstacle) {
      selectedRoom = foundObstacle.room;
      selectedObstacle = foundObstacle.obstacle;
      selectedPoi = null;
      selectedDoor = null;
      interaction = null;
      updateRoomControls(config.itemColors);
      redraw();
      return;
    }
    const cell = getCell(canvas, event);
    const room = getRoomAt(position);
    selectedPoi = null;
    selectedObstacle = null;
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
          doors: (room.doors || []).map(door => ({ ...door })),
          obstacles: (room.obstacles || []).map(obstacle => ({ ...obstacle }))
        }
      };
    } else {
      selectedRoom = null;
    }
    updateRoomControls(config.itemColors);
    canvas.setPointerCapture(event.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', event => {
    if (!interaction) return;
    if (interaction.type === 'pan') {
      viewport.scrollLeft = interaction.left - (event.clientX - interaction.x);
      viewport.scrollTop = interaction.top - (event.clientY - interaction.y);
      return;
    }
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
        room.obstacles = (room.obstacles || []).filter(item => item.x < room.width && item.y < room.height);
        if (selectedObstacle && !room.obstacles.includes(selectedObstacle)) selectedObstacle = null;
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
    if (interaction.type === 'pan') {
      interaction = null;
      canvas.style.cursor = 'grab';
      return;
    }
    if (interaction.type === 'create') {
      interaction.end = getCell(canvas, event);
      selectedRoom = createRectangle(getRoomBounds(interaction.start, interaction.end));
      rooms.push(selectedRoom);
      selectedPoi = null;
      selectedObstacle = null;
    }
    interaction = null;
    updateRoomControls(config.itemColors);
    redraw();
  });
  canvas.addEventListener('pointercancel', () => {
    if (interaction?.type === 'pan') canvas.style.cursor = 'grab';
    if (interaction && interaction.type !== 'create' && interaction.type !== 'pan') {
      Object.assign(interaction.room, interaction.original);
      selectedPoi = null;
      selectedObstacle = null;
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
  document.getElementById('map-status').textContent = error.message;
});
