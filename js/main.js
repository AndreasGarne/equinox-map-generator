const TILE = 32;
const rooms = [];
let dragStart = null;
let dragEnd = null;

async function loadConfig() {
  const res = await fetch('config/colors.json');
  if (!res.ok) throw new Error(`Unable to load colour configuration (${res.status})`);
  return res.json();
}

function drawGrid(ctx, w, h, preview = null) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, w, h);

  for (const room of rooms) drawRoom(ctx, room);
  if (preview) drawRoom(ctx, preview, true);

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += TILE) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
  for (let y = 0; y <= h; y += TILE) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
  ctx.stroke();
}

function drawRoom(ctx, room, isPreview = false) {
  const x = room.x * TILE;
  const y = room.y * TILE;
  const width = room.width * TILE;
  const height = room.height * TILE;

  ctx.fillStyle = isPreview ? 'rgba(59, 130, 246, 0.25)' : 'rgba(250, 204, 21, 0.35)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = isPreview ? '#3b82f6' : '#222';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);

  if (!isPreview) {
    ctx.fillStyle = '#111';
    ctx.font = '14px sans-serif';
    ctx.fillText(room.name, x + 6, y + 18, Math.max(0, width - 12));
  }
}

function getCell(canvas, event) {
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * (canvas.width / bounds.width);
  const y = (event.clientY - bounds.top) * (canvas.height / bounds.height);
  return {
    x: Math.max(0, Math.min(Math.floor(x / TILE), canvas.width / TILE - 1)),
    y: Math.max(0, Math.min(Math.floor(y / TILE), canvas.height / TILE - 1))
  };
}

function getRoomBounds(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x) + 1,
    height: Math.abs(end.y - start.y) + 1
  };
}

async function init() {
  const config = await loadConfig();
  window.equinoxConfig = config;
  const canvas = document.getElementById('map');
  const ctx = canvas.getContext('2d');
  const redraw = () => {
    const preview = dragStart && dragEnd ? getRoomBounds(dragStart, dragEnd) : null;
    drawGrid(ctx, canvas.width, canvas.height, preview);
  };

  canvas.addEventListener('pointerdown', event => {
    dragStart = getCell(canvas, event);
    dragEnd = dragStart;
    canvas.setPointerCapture(event.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragStart) return;
    dragEnd = getCell(canvas, event);
    redraw();
  });
  canvas.addEventListener('pointerup', event => {
    if (!dragStart) return;
    dragEnd = getCell(canvas, event);
    const bounds = getRoomBounds(dragStart, dragEnd);
    rooms.push({ ...bounds, name: `Room ${rooms.length + 1}` });
    dragStart = null;
    dragEnd = null;
    redraw();
  });
  canvas.addEventListener('pointercancel', () => {
    dragStart = null;
    dragEnd = null;
    redraw();
  });

  redraw();
}

init().catch(error => {
  console.error(error);
  document.getElementById('map-help').textContent =
    'The map could not be loaded. Check that it is served over HTTP and try again.';
});
