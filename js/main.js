const TILE = 32;

async function loadConfig() {
  const res = await fetch('config/colors.json');
  return res.json();
}

function drawGrid(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += TILE) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
  for (let y = 0; y <= h; y += TILE) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
  ctx.stroke();
}

async function init() {
  const config = await loadConfig();
  window.equinoxConfig = config;
  const canvas = document.getElementById('map');
  drawGrid(canvas.getContext('2d'), canvas.width, canvas.height);
}

init();
