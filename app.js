const input = document.querySelector('#writing');
const wrap = document.querySelector('#writingWrap');
const tree = document.querySelector('#tree');
const progress = document.querySelector('#progress');
const toggle = document.querySelector('#toggle');
const exportButton = document.querySelector('#export');
const clearButton = document.querySelector('#clear');
const KEY = 'papyrus-v01-draft';
let artTimer;
let revealed = false;
try { input.value = localStorage.getItem(KEY) || ''; } catch (_) {}
const SVG_NS = 'http://www.w3.org/2000/svg';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const branches = [];
const leaves = [];
let seed = 19;

// A fixed seed gives every restored draft the same tree, without storing an image.
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
function svgElement(name, attributes, parent) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  parent.appendChild(element);
  return element;
}
const leafLayer = svgElement('g', {}, tree);
const branchLayer = svgElement('g', {}, tree);
function addBranch(x, y, endX, endY, width, start, end, bend = 0) {
  const dx = endX - x;
  const dy = endY - y;
  const element = svgElement('path', {
    d: `M${x} ${y} C${x + dx * 0.28 + bend} ${y + dy * 0.35} ${x + dx * 0.72 + bend} ${y + dy * 0.7} ${endX} ${endY}`,
    class: 'tree-branch', 'stroke-width': width, pathLength: 1,
    'stroke-dasharray': 1, 'stroke-dashoffset': 1
  }, branchLayer);
  branches.push({ element, start, end, x: endX, y: endY });
}
function addLeaves(x, y, start) {
  for (let i = 0; i < 7; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 3 + random() * 13;
    const leafX = x + Math.cos(angle) * radius;
    const leafY = y + Math.sin(angle) * radius * 0.7;
    const rotation = random() * 150 - 75;
    const length = 3 + random() * 3;
    const element = svgElement('path', {
      d: `M0 0 Q${-length * 0.7} ${-length * 0.6} 0 ${-length * 2} Q${length * 0.9} ${-length * 0.9} 0 0`,
      transform: `translate(${leafX} ${leafY}) rotate(${rotation})`,
      class: 'tree-leaf', fill: ['#91b8e5', '#658fc9', '#bdcff0', '#4e77b2'][Math.floor(random() * 4)]
    }, leafLayer);
    leaves.push({ element, start: start + random() * 0.08 });
  }
}
// A crooked trunk and spreading limbs give the tree an open, asymmetric crown.
addBranch(158, 266, 164, 178, 4.5, 0, 0.18, -8);
addBranch(164, 178, 153, 110, 3, 0.12, 0.32, 6);
const limbs = [
  [160, 218, 93, 166, 2.5, 0.14, 0.36, -8],
  [162, 198, 224, 151, 2.6, 0.18, 0.4, 10],
  [159, 157, 109, 111, 2, 0.24, 0.45, -4],
  [159, 143, 201, 95, 1.9, 0.28, 0.49, 7],
  [153, 110, 145, 60, 1.5, 0.3, 0.5, -5],
  [93, 166, 55, 143, 1.5, 0.32, 0.5, -3],
  [93, 166, 82, 122, 1.4, 0.33, 0.52, 5],
  [224, 151, 263, 130, 1.5, 0.36, 0.54, 6],
  [224, 151, 228, 106, 1.4, 0.36, 0.56, -4],
  [109, 111, 76, 87, 1.2, 0.4, 0.58, -3],
  [109, 111, 112, 72, 1.2, 0.4, 0.59, 5],
  [201, 95, 233, 71, 1.1, 0.44, 0.61, 4],
  [201, 95, 189, 53, 1.2, 0.44, 0.62, -4]
];
limbs.forEach(args => addBranch(...args));
// Fine forked twigs end in individual leaves, rather than solid canopy circles.
limbs.slice(4).forEach(([x, y, endX, endY, , , end]) => {
  const direction = Math.atan2(endY - y, endX - x);
  for (let fork = -1; fork <= 1; fork++) {
    const angle = direction + fork * 0.65;
    const length = 15 + random() * 14;
    const tipX = endX + Math.cos(angle) * length;
    const tipY = endY + Math.sin(angle) * length;
    addBranch(endX, endY, tipX, tipY, 0.65, end - 0.03, end + 0.16, fork * 3);
    addLeaves(tipX, tipY, end + 0.1);
    addLeaves(endX, endY, end + 0.06);
  }
});
addBranch(158, 262, 139, 270, 1.3, 0.06, 0.19, 3);
addBranch(160, 262, 179, 269, 1.2, 0.08, 0.21, -3);

// Mirror only recent edits over the transparent textarea. The real draft is untouched.
const recentViewport = document.createElement('div');
recentViewport.className = 'recent-viewport';
recentViewport.setAttribute('aria-hidden', 'true');
wrap.appendChild(recentViewport);
let previousValue = input.value;
let recentRanges = [];
let recentMirror;
let recentTimer;
const WORD_LIFETIME = 1500;
const CLOUD_DURATION = 1000;
const selectionViewport = document.createElement('div');
selectionViewport.className = 'selection-viewport';
selectionViewport.setAttribute('aria-hidden', 'true');
wrap.appendChild(selectionViewport);

function clearRecentWords() {
  clearTimeout(recentTimer);
  recentViewport.replaceChildren();
  recentRanges = [];
  recentMirror = undefined;
}
function positionMirror(mirror) {
  const style = window.getComputedStyle(input);
  ['font', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'textAlign', 'tabSize'].forEach(property => {
    mirror.style[property] = style[property];
  });
  mirror.style.width = `${input.clientWidth}px`;
  mirror.style.left = `${input.offsetLeft - input.scrollLeft}px`;
  mirror.style.top = `${input.offsetTop - input.scrollTop}px`;
}
function positionRecentWords() {
  if (recentMirror) positionMirror(recentMirror);
  if (selectionViewport.firstElementChild) positionMirror(selectionViewport.firstElementChild);
}
function appendText(parent, value, className = '') {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = value;
  parent.appendChild(span);
  return span;
}
function renderSelection() {
  selectionViewport.replaceChildren();
  if (revealed || document.activeElement !== input || input.selectionStart === input.selectionEnd) return;
  const mirror = document.createElement('div');
  mirror.className = 'recent-copy';
  appendText(mirror, input.value.slice(0, input.selectionStart));
  appendText(mirror, input.value.slice(input.selectionStart, input.selectionEnd), 'selection-ink');
  appendText(mirror, input.value.slice(input.selectionEnd));
  selectionViewport.appendChild(mirror);
  positionMirror(mirror);
}
function renderRecentWords() {
  clearTimeout(recentTimer);
  recentViewport.replaceChildren();
  recentMirror = undefined;
  if (revealed) return;
  const now = Date.now();
  const duration = reducedMotion.matches ? 0 : CLOUD_DURATION;
  const alive = recentRanges.filter(range => now < range.born + WORD_LIFETIME + duration);
  if (!alive.length) return;
  recentMirror = document.createElement('div');
  recentMirror.className = 'recent-copy';
  let cursor = 0;
  let nextExpiry = Infinity;
  alive.forEach(range => {
    appendText(recentMirror, input.value.slice(cursor, range.start));
    const visible = appendText(recentMirror, input.value.slice(range.start, range.end), 'recent-ink');
    // Negative delays preserve each word's age when editing rebuilds the mirror.
    visible.style.animationDelay = `${range.born + WORD_LIFETIME - now}ms`;
    cursor = range.end;
    nextExpiry = Math.min(nextExpiry, range.born + WORD_LIFETIME + duration);
  });
  appendText(recentMirror, input.value.slice(cursor));
  recentViewport.appendChild(recentMirror);
  positionRecentWords();
  recentTimer = setTimeout(renderRecentWords, Math.max(1, nextExpiry - now));
}
function trackRecentEdit(isComposing = false) {
  const value = input.value;
  const now = Date.now();
  let start = 0;
  while (start < previousValue.length && start < value.length && previousValue[start] === value[start]) start++;
  let oldEnd = previousValue.length;
  let newEnd = value.length;
  while (oldEnd > start && newEnd > start && previousValue[oldEnd - 1] === value[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  const shift = newEnd - oldEnd;
  const ranges = [];
  recentRanges.forEach(range => {
    if (range.start < start) ranges.push({ start: range.start, end: Math.min(range.end, start), born: range.born });
    if (range.end > oldEnd) ranges.push({ start: Math.max(range.start, oldEnd) + shift, end: range.end + shift, born: range.born });
  });
  if (newEnd > start) ranges.push({ start, end: newEnd, born: now });
  previousValue = value;
  // Keep the first appearance time of a word, even as more letters are added.
  recentRanges = [];
  ranges.sort((a, b) => a.start - b.start);
  let rangeIndex = 0;
  for (const match of value.matchAll(/\S+/gu)) {
    const end = match.index + match[0].length;
    while (rangeIndex < ranges.length && ranges[rangeIndex].end <= match.index) rangeIndex++;
    let born = Infinity;
    for (let i = rangeIndex; i < ranges.length && ranges[i].start < end; i++) {
      born = Math.min(born, ranges[i].born);
    }
    if (born !== Infinity) recentRanges.push({ start: match.index, end, born });
  }
  if (revealed) clearRecentWords();
  else renderRecentWords();
  renderSelection();
}
input.addEventListener('select', renderSelection);
input.addEventListener('keyup', renderSelection);
input.addEventListener('pointerup', renderSelection);
input.addEventListener('blur', () => selectionViewport.replaceChildren());
document.addEventListener('selectionchange', renderSelection);
function updateScene(value) {
  const wordCount = (value.match(/\S+/gu) || []).length;
  const amount = Math.min(1, wordCount / 30);
  branches.forEach(({ element, start, end }) => {
    const growth = Math.max(0, Math.min(1, (amount - start) / (end - start)));
    element.style.opacity = growth > 0 ? '1' : '0';
    element.style.strokeDashoffset = String(1 - growth);
  });
  leaves.forEach(({ element, start }) => {
    const growth = Math.max(0, Math.min(1, (amount - start) / 0.16));
    element.style.opacity = String(growth * 0.85);
  });
  progress.textContent = !wordCount ? 'Every word leaves a trace. Land a green branch.'
    : amount < 0.2 ? 'Your words are putting down roots.'
    : amount < 0.65 ? 'A little more writing. A little more life.'
    : amount < 1 ? 'Your tree is finding its leaves.'
    : 'A place to land. Keep writing.';
}
window.addEventListener('resize', positionRecentWords);
input.addEventListener('scroll', positionRecentWords, { passive: true });
window.addEventListener('pagehide', clearRecentWords);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearRecentWords(); selectionViewport.replaceChildren(); }
});
function cancelArtworkUpdate() {
  clearTimeout(artTimer);
  artTimer = undefined;
}
function scheduleArtwork() {
  // Update during continuous writing too, rather than waiting for a long pause.
  if (artTimer !== undefined) return;
  artTimer = setTimeout(() => {
    artTimer = undefined;
    updateScene(input.value);
  }, 500);
}
input.addEventListener('input', event => {
  try { localStorage.setItem(KEY, input.value); } catch (_) {}
  trackRecentEdit(event.isComposing);
  if (event.isComposing) cancelArtworkUpdate();
  else scheduleArtwork();
  if (!input.value.trim()) {
    cancelArtworkUpdate();
    clearRecentWords();
    updateScene('');
  }
});
input.addEventListener('compositionstart', () => {
  cancelArtworkUpdate();
});
input.addEventListener('compositionend', () => {
  trackRecentEdit();
  scheduleArtwork();
});
toggle.addEventListener('click', () => {
  revealed = !revealed;
  wrap.classList.toggle('revealed', revealed);
  toggle.textContent = revealed ? 'Hide words' : 'Reveal words';
  toggle.setAttribute('aria-pressed', String(revealed));
  cancelArtworkUpdate();
  clearRecentWords();
  renderSelection();
  updateScene(input.value);
  if (revealed) input.focus();
});
exportButton.addEventListener('click', () => {
  const blob = new Blob([input.value], {type:'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `papyrus-${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
clearButton.addEventListener('click', () => {
  if (!confirm('Erase this draft from this browser? Export first if you want to keep it.')) return;
  input.value = '';
  previousValue = '';
  selectionViewport.replaceChildren();
  try { localStorage.removeItem(KEY); } catch (_) {}
  clearRecentWords();
  cancelArtworkUpdate();
  updateScene('');
});
// Restoring a draft never briefly exposes it or replays its words.
toggle.setAttribute('aria-pressed', 'false');
updateScene(input.value);
