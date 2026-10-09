const TILE = 32;
const rooms = [];
let selectedRoom = null;
let interaction = null;

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

  if (isSelected) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x + width - 10, y + height - 10, 8, 8);
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

function getRoomAt(position) {
  return [...rooms].reverse().find(room =>
    position.x >= room.x * TILE && position.x < (room.x + room.width) * TILE &&
    position.y >= room.y * TILE && position.y < (room.y + room.height) * TILE
  );
}

function isResizeHandle(room, position) {
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

function updateRoomControls() {
  const nameInput = document.getElementById('room-name');
  const deleteButton = document.getElementById('delete-room');
  nameInput.disabled = !selectedRoom;
  nameInput.value = selectedRoom ? selectedRoom.name : '';
  deleteButton.disabled = !selectedRoom;
}

async function init() {
  const config = await loadConfig();
  window.equinoxConfig = config;
  const canvas = document.getElementById('map');
  const ctx = canvas.getContext('2d');
  const redraw = () => {
    const preview = interaction?.type === 'create'
      ? getRoomBounds(interaction.start, interaction.end)
      : null;
    drawGrid(ctx, canvas.width, canvas.height, preview);
  };

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
    const cell = getCell(canvas, event);
    const position = getPosition(canvas, event);
    const room = getRoomAt(position);
    if (room) {
      selectedRoom = room;
      interaction = {
        type: isResizeHandle(room, position) ? 'resize' : 'move',
        room,
        start: cell,
        original: { x: room.x, y: room.y, width: room.width, height: room.height }
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
      } else {
        room.width = Math.max(1, Math.min(original.width + dx, canvas.width / TILE - original.x));
        room.height = Math.max(1, Math.min(original.height + dy, canvas.height / TILE - original.y));
      }
    }
    redraw();
  });
  canvas.addEventListener('pointerup', event => {
    if (!interaction) return;
    if (interaction.type === 'create') {
      interaction.end = getCell(canvas, event);
      const clickedRoom = interaction.start.x === interaction.end.x &&
        interaction.start.y === interaction.end.y
        ? getRoomAt(getPosition(canvas, event))
        : null;
      if (clickedRoom) {
        selectedRoom = clickedRoom;
      } else {
        const bounds = getRoomBounds(interaction.start, interaction.end);
        selectedRoom = { ...bounds, name: `Room ${rooms.length + 1}` };
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
