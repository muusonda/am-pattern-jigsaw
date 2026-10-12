const board = document.getElementById('board');
const NS = 'http://www.w3.org/2000/svg';
const COLS = 8;
const ROWS = 12;
const TOTAL = COLS * ROWS;
const ARTWORKS = [
  { id: 'abdullah', label: 'Abdullah Ibrahim', page: 'abdullah.html', src: 'public/artworks/abdullah-ibrahim.jpg', width: 1049, height: 1400 },
  { id: 'bra-hugh', label: 'Bra Hugh', page: 'bra-hugh.html', src: 'public/artworks/bra-hugh.jpg', width: 1053, height: 1400 },
  { id: 'mr-flavour', label: 'Mr Flavour', page: 'mr-flavour.html', src: 'public/artworks/mr-flavour.jpg', width: 1049, height: 1400 },
  { id: 'tems', label: 'Tems', page: 'tems.html', src: 'public/artworks/tems.jpg', width: 1049, height: 1400 },
  { id: 'thandiswa', label: 'Thandiswa Mazwai', page: 'thandiswa-mazwai.html', src: 'public/artworks/thandiswa-mazwai.jpg', width: 1049, height: 1400 },
  { id: 'tyla', label: 'Tyla', page: 'tyla.html', src: 'public/artworks/tyla.jpg', width: 1049, height: 1400 },
];
const pageArtworkId = document.body.dataset.artwork || new URLSearchParams(window.location.search).get('artwork') || 'abdullah';
let currentArtwork = ARTWORKS.find((item) => item.id === pageArtworkId) || ARTWORKS[0];
const WORLD_WIDTH = 1000;
let WORLD_HEIGHT = WORLD_WIDTH * currentArtwork.height / currentArtwork.width;
const TAB = 28;
const CELL_W = WORLD_WIDTH / COLS;
let CELL_H = WORLD_HEIGHT / ROWS;
const SNAP = 34;

let svg;
let pieces = [];
let groups = [];
let groupByPiece = new Map();
let drag = null;
let hEdges = [];
let vEdges = [];
let lockedCount = 0;
let startedAt = null;
let timerId = null;
let trayX = 260;
let trayY = 0;

const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
};

function makeEdges() {
  hEdges = Array.from({ length: ROWS + 1 }, (_, row) => Array.from({ length: COLS }, () => row === 0 || row === ROWS ? 0 : (Math.random() < 0.5 ? -1 : 1)));
  vEdges = Array.from({ length: ROWS }, () => Array.from({ length: COLS + 1 }, (_, col) => col === 0 || col === COLS ? 0 : (Math.random() < 0.5 ? -1 : 1)));
}

function horizontalEdge(y, sign, reverse = false) {
  if (!sign) return reverse ? `L 0 ${y}` : `L ${CELL_W} ${y}`;
  const x0 = 0, x1 = CELL_W, w = CELL_W, s = sign * TAB;
  const a = w * 0.30, b = w * 0.39, c = w * 0.61, d = w * 0.70;
  const forward = `L ${a} ${y} C ${a + w * 0.05} ${y} ${b} ${y + s * 0.08} ${b} ${y + s * 0.28} C ${b} ${y + s * 0.68} ${w * 0.45} ${y + s * 0.88} ${w * 0.50} ${y + s * 0.88} C ${w * 0.55} ${y + s * 0.88} ${c} ${y + s * 0.68} ${c} ${y + s * 0.28} C ${c} ${y + s * 0.08} ${d - w * 0.05} ${y} ${d} ${y} L ${x1} ${y}`;
  if (!reverse) return forward;
  return `L ${d} ${y} C ${d - w * 0.05} ${y} ${c} ${y + s * 0.08} ${c} ${y + s * 0.28} C ${c} ${y + s * 0.68} ${w * 0.55} ${y + s * 0.88} ${w * 0.50} ${y + s * 0.88} C ${w * 0.45} ${y + s * 0.88} ${b} ${y + s * 0.68} ${b} ${y + s * 0.28} C ${b} ${y + s * 0.08} ${a + w * 0.05} ${y} ${a} ${y} L 0 ${y}`;
}
function verticalEdge(x, sign, reverse = false) {
  if (!sign) return reverse ? `L ${x} 0` : `L ${x} ${CELL_H}`;
  const y0 = 0, y1 = CELL_H, h = CELL_H, s = sign * TAB;
  const a = h * 0.30, b = h * 0.39, c = h * 0.61, d = h * 0.70;
  const forward = `L ${x} ${a} C ${x} ${a + h * 0.05} ${x + s * 0.08} ${b} ${x + s * 0.28} ${b} C ${x + s * 0.68} ${b} ${x + s * 0.88} ${h * 0.45} ${x + s * 0.88} ${h * 0.50} C ${x + s * 0.88} ${h * 0.55} ${x + s * 0.68} ${c} ${x + s * 0.28} ${c} C ${x + s * 0.08} ${c} ${x} ${d - h * 0.05} ${x} ${d} L ${x} ${y1}`;
  if (!reverse) return forward;
  return `L ${x} ${d} C ${x} ${d - h * 0.05} ${x + s * 0.08} ${c} ${x + s * 0.28} ${c} C ${x + s * 0.68} ${c} ${x + s * 0.88} ${h * 0.55} ${x + s * 0.88} ${h * 0.50} C ${x + s * 0.88} ${h * 0.45} ${x + s * 0.68} ${b} ${x + s * 0.28} ${b} C ${x + s * 0.08} ${b} ${x} ${a + h * 0.05} ${x} ${a} L ${x} 0`;
}
function piecePath(col, row) {
  let d = 'M 0 0';
  d += horizontalEdge(0, hEdges[row][col]);
  d += verticalEdge(CELL_W, vEdges[row][col + 1]);
  d += horizontalEdge(CELL_H, hEdges[row + 1][col], true);
  d += verticalEdge(0, vEdges[row][col], true);
  return `${d} Z`;
}

function pieceId(row, col) { return row * COLS + col; }
function solvedOrigin(row, col) { return { x: col * CELL_W, y: row * CELL_H }; }
function setTransform(el, x, y) { el.dataset.x = x; el.dataset.y = y; el.setAttribute('transform', `translate(${x} ${y})`); }
function groupOffset(group) { return { x: Number(group.cluster.dataset.x || 0), y: Number(group.cluster.dataset.y || 0) }; }

function workspaceMargins() {
  return window.innerWidth < 700 ? { x: 0, y: 260 } : { x: 260, y: 0 };
}

function workspaceViewBox() {
  return `${-trayX} ${-trayY} ${WORLD_WIDTH + trayX * 2} ${WORLD_HEIGHT + trayY * 2}`;
}

// Return the full local footprint of a cluster, including each piece's tabs.
// Keeping this derived from the member origins means it also works after pieces
// have been merged into a larger connected group.
function groupBounds(group) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  group.members.forEach((id) => {
    const piece = pieces[id];
    if (!piece) return;
    minX = Math.min(minX, piece.origin.x - TAB);
    minY = Math.min(minY, piece.origin.y - TAB);
    maxX = Math.max(maxX, piece.origin.x + CELL_W + TAB);
    maxY = Math.max(maxY, piece.origin.y + CELL_H + TAB);
  });
  return { minX, minY, maxX, maxY };
}

function groupCoreBounds(group) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  group.members.forEach((id) => {
    const piece = pieces[id];
    if (!piece) return;
    minX = Math.min(minX, piece.origin.x);
    minY = Math.min(minY, piece.origin.y);
    maxX = Math.max(maxX, piece.origin.x + CELL_W);
    maxY = Math.max(maxY, piece.origin.y + CELL_H);
  });
  return { minX, minY, maxX, maxY };
}

function groupCoreRect(group, x, y) {
  const bounds = groupCoreBounds(group);
  return { left: x + bounds.minX, top: y + bounds.minY, right: x + bounds.maxX, bottom: y + bounds.maxY };
}

function rectOverlapArea(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function shuffleArray(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

// Keep the whole cluster inside the SVG's visible viewBox, including the
// responsive piece tray around the puzzle area.
function clampGroupPosition(group, x, y) {
  // Keep the piece body flush with the workspace edge. Including tab bounds
  // here left a visible gap when a piece was dragged to an outer edge.
  const bounds = groupCoreBounds(group);
  const minX = -trayX - bounds.minX;
  const maxX = WORLD_WIDTH + trayX - bounds.maxX;
  const minY = -trayY - bounds.minY;
  const maxY = WORLD_HEIGHT + trayY - bounds.maxY;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}


function syncArtworkPicker() {
  document.querySelectorAll('.art-option').forEach((link) => {
    const active = link.dataset.artwork === currentArtwork.id;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const modalImage = document.querySelector('#imageModal img');
  if (modalImage) {
    modalImage.src = currentArtwork.src;
    modalImage.alt = `${currentArtwork.label} artwork`;
  }
}

function selectArtwork(id) {
  const artwork = ARTWORKS.find((item) => item.id === id);
  if (!artwork) return;
  window.location.href = artwork.page;
}

function createPuzzle() {
  clearInterval(timerId);
  startedAt = null;
  lockedCount = 0;
  pieces = [];
  groups = [];
  groupByPiece = new Map();
  drag = null;
  makeEdges();
  ({ x: trayX, y: trayY } = workspaceMargins());
  board.innerHTML = '';
  svg = svgEl('svg', { id: 'puzzleSvg', viewBox: workspaceViewBox(), preserveAspectRatio: 'none' });
  const defs = svgEl('defs');
  svg.appendChild(defs);

  const ghost = svgEl('image', { href: currentArtwork.src, x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT, preserveAspectRatio: 'none', class: 'ghost-image' });
  svg.appendChild(ghost);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const id = pieceId(row, col);
      const path = piecePath(col, row);
      const origin = solvedOrigin(row, col);
      const clip = svgEl('clipPath', { id: `clip-${id}`, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(svgEl('path', { d: path }));
      defs.appendChild(clip);

      const slot = svgEl('path', { d: path, transform: `translate(${origin.x} ${origin.y})`, class: 'slot' });
      svg.appendChild(slot);

      const cluster = svgEl('g', { class: 'cluster' });
      const piece = svgEl('g', { class: 'piece', 'data-id': id, 'data-row': row, 'data-col': col, transform: `translate(${origin.x} ${origin.y})` });
      const image = svgEl('image', { href: currentArtwork.src, x: -origin.x, y: -origin.y, width: WORLD_WIDTH, height: WORLD_HEIGHT, preserveAspectRatio: 'none', 'clip-path': `url(#clip-${id})` });
      piece.appendChild(image);
      piece.appendChild(svgEl('path', { d: path, class: 'piece-outline' }));
      cluster.appendChild(piece);
      svg.appendChild(cluster);

      const group = { id: `group-${id}`, members: new Set([id]), cluster, x: 0, y: 0, locked: false };
      setTransform(cluster, 0, 0);
      groups.push(group);
      groupByPiece.set(id, group);
      pieces.push({ id, row, col, origin, path, element: piece, group });
      piece.addEventListener('pointerdown', beginDrag);
    }
  }
  board.appendChild(svg);
  shuffle(false);
  updateProgress();
  resizeBoard();
}

function svgPoint(event, inverseMatrix = null) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(inverseMatrix || svg.getScreenCTM().inverse());
}

function updateProgress() {
  const progress = document.getElementById('progressFill');
  if (progress) progress.style.width = `${(lockedCount / TOTAL) * 100}%`;
  if (lockedCount === TOTAL) {
    clearInterval(timerId);
    document.getElementById('winToast').classList.add('show');
  }
}

function startTimer() {
  if (startedAt) return;
  startedAt = Date.now();
  timerId = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    document.getElementById('timer').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  }, 1000);
}

function neighborsOf(group) {
  const result = new Set();
  group.members.forEach((id) => {
    const piece = pieces[id];
    [[piece.row - 1, piece.col], [piece.row + 1, piece.col], [piece.row, piece.col - 1], [piece.row, piece.col + 1]].forEach(([row, col]) => {
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        const neighbor = groupByPiece.get(pieceId(row, col));
        if (neighbor && neighbor !== group) result.add(neighbor);
      }
    });
  });
  return [...result];
}

function findSnap(group, x, y) {
  if (Math.hypot(x, y) <= SNAP) return { x: 0, y: 0, target: null, lock: true };
  let best = null;
  neighborsOf(group).forEach((neighbor) => {
    const nx = Number(neighbor.cluster.dataset.x || 0), ny = Number(neighbor.cluster.dataset.y || 0);
    const distance = Math.hypot(x - nx, y - ny);
    if (distance <= SNAP && (!best || distance < best.distance)) best = { x: nx, y: ny, target: neighbor, lock: neighbor.locked, distance };
  });
  return best;
}

function applyGroupPosition(group, x, y) {
  group.x = x;
  group.y = y;
  setTransform(group.cluster, x, y);
}

function mergeGroups(a, b) {
  const target = b.locked ? b : a;
  const source = target === a ? b : a;
  source.members.forEach((id) => { target.members.add(id); groupByPiece.set(id, target); });
  [...source.cluster.children].forEach((child) => target.cluster.appendChild(child));
  source.cluster.remove();
  groups = groups.filter((group) => group !== source);
  if (target.locked && !source.locked) {
    lockedCount += source.members.size;
    target.cluster.style.pointerEvents = 'none';
  }
  target.locked = target.locked || source.locked;
  return target;
}

function splitGroup(group) {
  if (!group || group.locked || group.members.size < 2) return;
  const ids = [...group.members];
  ids.slice(1).forEach((id) => {
    const piece = pieces[id];
    if (!piece) return;
    const cluster = svgEl('g', { class: 'cluster' });
    cluster.appendChild(piece.element);
    svg.appendChild(cluster);
    const nextGroup = { id: `group-${id}-${Date.now()}`, members: new Set([id]), cluster, x: group.x, y: group.y, locked: false };
    setTransform(cluster, group.x, group.y);
    groups.push(nextGroup);
    groupByPiece.set(id, nextGroup);
    piece.group = nextGroup;
    group.members.delete(id);
  });
}

function separateUnlockedGroups() {
  groups.slice().forEach(splitGroup);
}

function lockGroup(group) {
  if (group.locked) return;
  group.locked = true;
  group.cluster.classList.add('locked');
  group.cluster.style.pointerEvents = 'none';
  lockedCount += group.members.size;
}

function settle(group) {
  let current = group;
  let changed = true;
  while (changed) {
    changed = false;
    const candidate = findSnap(current, Number(current.cluster.dataset.x || 0), Number(current.cluster.dataset.y || 0));
    if (!candidate) break;
    applyGroupPosition(current, candidate.x, candidate.y);
    if (candidate.target) {
      current = mergeGroups(current, candidate.target);
      changed = true;
    } else {
      lockGroup(current);
      changed = false;
    }
  }
  updateProgress();
}

function bringToFront(group) { svg.appendChild(group.cluster); }

function beginDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const piece = pieces[Number(event.currentTarget.dataset.id)];
  const group = groupByPiece.get(piece.id);
  if (!group || group.locked) return;
  startTimer();
  bringToFront(group);
  const point = svgPoint(event);
  const offset = groupOffset(group);
  drag = { group, dx: point.x - offset.x, dy: point.y - offset.y, inverseCTM: svg.getScreenCTM().inverse(), frame: 0, latest: null, lastPoint: null, lastTime: performance.now(), vx: 0, vy: 0 };
  group.cluster.classList.add('dragging');
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener('pointermove', moveDrag);
  event.currentTarget.addEventListener('pointerup', endDrag, { once: true });
  event.currentTarget.addEventListener('pointercancel', endDrag, { once: true });
}

function applyDragPoint(clientX, clientY) {
  if (!drag) return;
  const point = svgPoint({ clientX, clientY }, drag.inverseCTM);
  const rawX = point.x - drag.dx, rawY = point.y - drag.dy;
  const { x, y } = clampGroupPosition(drag.group, rawX, rawY);
  const now = performance.now();
  if (drag.lastPoint) {
    const dt = Math.max(0.008, (now - drag.lastTime) / 1000);
    const instantVx = (x - drag.lastPoint.x) / dt;
    const instantVy = (y - drag.lastPoint.y) / dt;
    drag.vx = drag.vx * 0.65 + instantVx * 0.35;
    drag.vy = drag.vy * 0.65 + instantVy * 0.35;
  }
  drag.lastPoint = { x, y };
  drag.lastTime = now;
  applyGroupPosition(drag.group, x, y);
  const ready = findSnap(drag.group, x, y);
  drag.group.cluster.classList.toggle('snap-hint', Boolean(ready));
  if (ready) drag.group.cluster.dataset.snapX = ready.x;
}

function moveDrag(event) {
  if (!drag) return;
  drag.latest = { clientX: event.clientX, clientY: event.clientY };
  if (drag.frame) return;
  drag.frame = requestAnimationFrame(() => {
    drag.frame = 0;
    if (drag.latest) applyDragPoint(drag.latest.clientX, drag.latest.clientY);
  });
}

function flickGroup(group, vx, vy) {
  let last = performance.now();
  group.cluster.classList.add('flicking');
  const step = (now) => {
    if (group.locked) return;
    const dt = Math.min(0.04, Math.max(0.008, (now - last) / 1000));
    last = now;
    const next = clampGroupPosition(group, group.x + vx * dt, group.y + vy * dt);
    if (next.x !== group.x + vx * dt) vx *= -0.35;
    if (next.y !== group.y + vy * dt) vy *= -0.35;
    applyGroupPosition(group, next.x, next.y);
    const ready = findSnap(group, next.x, next.y);
    const speed = Math.hypot(vx, vy);
    if (ready && speed < 180) {
      group.cluster.classList.remove('flicking');
      settle(group);
      return;
    }
    const decay = Math.pow(0.035, dt);
    vx *= decay;
    vy *= decay;
    if (Math.hypot(vx, vy) < 24) {
      group.cluster.classList.remove('flicking');
      settle(group);
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function endDrag(event) {
  if (!drag) return;
  if (drag.frame) cancelAnimationFrame(drag.frame);
  drag.frame = 0;
  applyDragPoint(event.clientX, event.clientY);
  const group = drag.group;
  const vx = drag.vx;
  const vy = drag.vy;
  group.cluster.classList.remove('dragging', 'snap-hint');
  event.currentTarget.removeEventListener('pointermove', moveDrag);
  drag = null;
  const ready = findSnap(group, group.x, group.y);
  if (ready || Math.hypot(vx, vy) < 260) settle(group);
  else flickGroup(group, vx, vy);
}

function shuffle(includeLocked = false) {
  const slotCols = trayX > 0 ? COLS + 2 : COLS;
  const slotRows = trayY > 0 ? ROWS + 3 : ROWS;
  const slotWidth = WORLD_WIDTH + trayX * 2;
  const slotHeight = WORLD_HEIGHT + trayY * 2;
  const stepX = slotCols > 1 ? (slotWidth - CELL_W) / (slotCols - 1) : 0;
  const stepY = slotRows > 1 ? (slotHeight - CELL_H) / (slotRows - 1) : 0;
  const slots = shuffleArray(Array.from({ length: slotCols * slotRows }, (_, index) => ({
    x: -trayX + (index % slotCols) * stepX,
    y: -trayY + Math.floor(index / slotCols) * stepY,
  })));
  const movable = groups.filter((group) => includeLocked || !group.locked).sort((a, b) => b.members.size - a.members.size);
  const placed = groups.filter((group) => group.locked && !includeLocked).map((group) => groupCoreRect(group, group.x, group.y));

  movable.forEach((group) => {
    const anchor = groupCoreBounds(group);
    let best = null;
    slots.forEach((slot) => {
      const position = clampGroupPosition(group, slot.x - anchor.minX, slot.y - anchor.minY);
      const rect = groupCoreRect(group, position.x, position.y);
      const overlap = placed.reduce((total, other) => total + rectOverlapArea(rect, other), 0);
      if (!best || overlap < best.overlap) best = { ...position, rect, overlap };
    });
    applyGroupPosition(group, best.x, best.y);
    placed.push(best.rect);
    const chosen = slots.findIndex((slot) => {
      const position = clampGroupPosition(group, slot.x - anchor.minX, slot.y - anchor.minY);
      return Math.abs(position.x - best.x) < 0.001 && Math.abs(position.y - best.y) < 0.001;
    });
    if (chosen >= 0) slots.splice(chosen, 1);
  });
}

function resizeBoard() {
  const nextMargins = workspaceMargins();
  const marginsChanged = nextMargins.x !== trayX || nextMargins.y !== trayY;
  trayX = nextMargins.x;
  trayY = nextMargins.y;
  const viewWidth = WORLD_WIDTH + trayX * 2;
  const viewHeight = WORLD_HEIGHT + trayY * 2;
  if (svg) svg.setAttribute('viewBox', workspaceViewBox());
  const maxWidth = Math.min(window.innerWidth * 0.94, 1100);
  const maxHeight = window.innerHeight * 0.92;
  const width = Math.min(maxWidth, maxHeight * viewWidth / viewHeight);
  board.style.width = `${width}px`;
  board.style.height = `${width * viewHeight / viewWidth}px`;
  if (marginsChanged && groups.length) {
    groups.forEach((group) => {
      const position = clampGroupPosition(group, group.x, group.y);
      applyGroupPosition(group, position.x, position.y);
    });
  }
}

syncArtworkPicker();
document.getElementById('shuffleBtn').onclick = () => shuffle(false);
document.getElementById('separateBtn').onclick = separateUnlockedGroups;
document.getElementById('playAgain').onclick = createPuzzle;
document.getElementById('showImage').onclick = () => document.getElementById('imageModal').classList.add('open');
document.getElementById('closeModal').onclick = () => document.getElementById('imageModal').classList.remove('open');
document.getElementById('imageModal').onclick = (event) => { if (event.target.id === 'imageModal') event.currentTarget.classList.remove('open'); };
document.getElementById('ghostBtn').onclick = () => board.classList.toggle('ghost-on');
document.getElementById('fullscreenBtn').onclick = () => { if (!document.fullscreenElement) document.querySelector('.game-shell').requestFullscreen?.(); else document.exitFullscreen?.(); };
window.addEventListener('resize', resizeBoard);
document.addEventListener('selectstart', (event) => event.preventDefault());
document.addEventListener('dragstart', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'i') document.getElementById('imageModal').classList.add('open'); if (event.key.toLowerCase() === 'g') board.classList.toggle('ghost-on'); if (event.key === 'Escape') document.getElementById('imageModal').classList.remove('open'); });

createPuzzle();
