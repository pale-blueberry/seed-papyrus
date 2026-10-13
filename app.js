const input = document.querySelector('#writing');
const wrap = document.querySelector('#writingWrap');
const tree = document.querySelector('#tree');
const progress = document.querySelector('#progress');
const toggle = document.querySelector('#toggle');
const exportButton = document.querySelector('#export');
const clearButton = document.querySelector('#clear');
const KEY = 'papyrus-v01-draft';
let fadeTimer;
let revealed = false;
try { input.value = localStorage.getItem(KEY) || ''; } catch (_) {}
function updateScene() {
  const count = input.value.trim().length;
  const amount = Math.min(1, count / 450);
  tree.style.opacity = String(amount);
  progress.textContent = count ? `${Math.round(amount * 100)}% grown · ${count} characters` : 'Every word leaves a trace.';
}
function scheduleFade() {
  clearTimeout(fadeTimer);
  wrap.classList.remove('hidden');
  revealed = false;
  toggle.textContent = 'Reveal words';
  if (input.value) fadeTimer = setTimeout(() => { if (!revealed) wrap.classList.add('hidden'); }, 3000);
}
input.addEventListener('input', () => {
  try { localStorage.setItem(KEY, input.value); } catch (_) {}
  updateScene();
  scheduleFade();
});
toggle.addEventListener('click', () => {
  revealed = !revealed;
  clearTimeout(fadeTimer);
  wrap.classList.toggle('hidden', !revealed);
  toggle.textContent = revealed ? 'Hide words' : 'Reveal words';
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
  try { localStorage.removeItem(KEY); } catch (_) {}
  updateScene(); scheduleFade();
});
updateScene();
if (input.value) scheduleFade();
