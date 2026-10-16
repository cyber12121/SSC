/* ==========================================================
   egiu.js - English Grammar in Use - Shared JavaScript
   Handles: progress bar, dark mode, exercises, localStorage
   ========================================================== */

/* ---------- Unit identity (set in each HTML page) ---------- */
const UNIT_NUMBER = parseInt(document.body.dataset.unit, 10) || 0;
const UNIT_TITLE  = document.body.dataset.unitTitle || '';
const NEXT_UNIT   = parseInt(document.body.dataset.nextUnit, 10) || (UNIT_NUMBER + 1);

/* ---------- localStorage keys ---------- */
const KEY_DONE  = 'egiu_done_units';
const KEY_LAST  = 'egiu_last_unit';
const KEY_THEME = 'egiu_theme';

/* ---------- Progress helpers ---------- */
function getDoneUnits() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY_DONE) || '[]')); }
  catch { return new Set(); }
}
function saveDoneUnits(s) { localStorage.setItem(KEY_DONE, JSON.stringify([...s])); }
function markUnitDone() {
  const d = getDoneUnits();
  if (!d.has(UNIT_NUMBER)) { d.add(UNIT_NUMBER); saveDoneUnits(d); }
}
localStorage.setItem(KEY_LAST, String(UNIT_NUMBER));

/* ---------- Scroll progress bar ---------- */
window.addEventListener('scroll', () => {
  const h = document.documentElement;
  const pct = h.scrollTop / (h.scrollHeight - h.clientHeight) * 100;
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = pct + '%';
});

/* ---------- Dark Mode ---------- */
(function initTheme() {
  const saved = localStorage.getItem(KEY_THEME);
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem(KEY_THEME, isDark ? 'light' : 'dark');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
}

/* Set initial icon */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('themeBtn');
  if (btn) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.addEventListener('click', toggleTheme);
  }
});

/* ---------- Smart answer normalisation ---------- */
const CONTRACTIONS = [
  [/\bi'm\b/g,'i am'],[/\byou're\b/g,'you are'],[/\bwe're\b/g,'we are'],
  [/\bthey're\b/g,'they are'],[/\bhe's\b/g,'he is'],[/\bshe's\b/g,'she is'],
  [/\bit's\b/g,'it is'],[/\bthere's\b/g,'there is'],[/\blet's\b/g,'let us'],
  [/\bisn't\b/g,'is not'],[/\baren't\b/g,'are not'],[/\bwasn't\b/g,'was not'],
  [/\bweren't\b/g,'were not'],[/\bdon't\b/g,'do not'],[/\bdoesn't\b/g,'does not'],
  [/\bdidn't\b/g,'did not'],[/\bhaven't\b/g,'have not'],[/\bhasn't\b/g,'has not'],
  [/\bhadn't\b/g,'had not'],[/\bcan't\b/g,'can not'],[/\bcannot\b/g,'can not'],
  [/\bwon't\b/g,'will not'],[/\bwouldn't\b/g,'would not'],[/\bshouldn't\b/g,'should not'],
  [/\bmustn't\b/g,'must not'],[/\bneedn't\b/g,'need not'],[/\bmightn't\b/g,'might not'],
  [/\b'd\b/g,' would'],[/\b'll\b/g,' will'],[/\b've\b/g,' have'],[/\b're\b/g,' are'],
];
function normalize(str) {
  if (!str) return '';
  let s = str.toString().toLowerCase();
  s = s.replace(/[\u2018\u2019\u02BC]/g, "'");
  CONTRACTIONS.forEach(([re, rep]) => { s = s.replace(re, rep); });
  s = s.replace(/[.,!?;:"()\[\]{}\u2013\u2014]/g, ' ');
  s = s.replace(/'/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/* ---------- Exercise completion tracking ---------- */
const exerciseStatus = {};
function updateExerciseStatus(id, ok) {
  if (ok) exerciseStatus[id] = true;
  checkAllComplete();
}
function checkAllComplete() {
  const total = document.querySelectorAll('.exercise').length;
  const done  = Object.keys(exerciseStatus).length;
  if (done === total && total > 0) {
    markUnitDone();
    const banner = document.getElementById('completionBanner');
    if (banner) banner.classList.add('show');
  }
}

/* ---------- Score bar helper ---------- */
function renderScoreBar(exercise, correct, total) {
  let wrap = exercise.querySelector('.score-bar-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'score-bar-wrap';
    wrap.innerHTML = `
      <div class="score-label"><span></span><span></span></div>
      <div class="score-bar-track"><div class="score-bar-fill"></div></div>`;
    const btnRow = exercise.querySelector('.btn-row');
    if (btnRow) btnRow.parentNode.insertBefore(wrap, btnRow);
  }
  const pct = total > 0 ? Math.round(correct / total * 100) : 0;
  const labels = wrap.querySelectorAll('.score-label span');
  if (labels[0]) labels[0].textContent = `${correct}/${total} correct`;
  if (labels[1]) labels[1].textContent = `${pct}%`;
  const fill = wrap.querySelector('.score-bar-fill');
  if (fill) {
    fill.style.width = pct + '%';
    fill.className = 'score-bar-fill ' + (pct === 100 ? 'full' : pct >= 50 ? '' : 'partial');
  }
}

/* ---------- Check exercise ---------- */
function checkExercise(btn) {
  const ex = btn.closest('.exercise');
  const inputs  = ex.querySelectorAll('.fill-input[data-answer]');
  const selects = ex.querySelectorAll('.match-select[data-answer]');
  let correct = 0, total = 0;

  inputs.forEach(inp => {
    if (inp.readOnly && inp.dataset.locked !== undefined) return; // skip shown examples
    total++;
    const user = normalize(inp.value);
    const ok   = inp.dataset.answer.split('|').map(a => normalize(a));
    if (ok.includes(user)) { inp.classList.add('correct'); inp.classList.remove('wrong'); correct++; }
    else                   { inp.classList.add('wrong');   inp.classList.remove('correct'); }
  });
  selects.forEach(sel => {
    total++;
    const user = normalize(sel.value);
    const ok   = sel.dataset.answer.split('|').map(a => normalize(a));
    if (ok.includes(user)) { sel.classList.add('correct'); sel.classList.remove('wrong'); correct++; }
    else                   { sel.classList.add('wrong');   sel.classList.remove('correct'); }
  });

  renderScoreBar(ex, correct, total);

  const fb = ex.querySelector('.feedback');
  if (fb) {
    fb.classList.add('show');
    if (correct === total && total > 0) {
      fb.classList.remove('bad'); fb.classList.add('good');
      fb.textContent = 'Perfect! All ' + total + ' correct. \u2713';
      updateExerciseStatus(ex.dataset.ex, true);
    } else {
      fb.classList.remove('good'); fb.classList.add('bad');
      fb.textContent = correct + '/' + total + ' correct. Review the highlighted fields.';
    }
  }
}

/* ---------- Show answers ---------- */
function showAnswers(btn) {
  const ex = btn.closest('.exercise');
  ex.querySelectorAll('.fill-input[data-answer]').forEach(inp => {
    inp.value = inp.dataset.answer.split('|')[0];
    inp.classList.add('correct'); inp.classList.remove('wrong');
    inp.readOnly = true;
  });
  ex.querySelectorAll('.match-select[data-answer]').forEach(sel => {
    sel.value = sel.dataset.answer.split('|')[0];
    sel.classList.add('correct'); sel.classList.remove('wrong');
  });
  const inputs = ex.querySelectorAll('.fill-input[data-answer]');
  renderScoreBar(ex, inputs.length, inputs.length);
  const fb = ex.querySelector('.feedback');
  if (fb) { fb.classList.add('show','good'); fb.classList.remove('bad'); fb.textContent = 'Answers shown. Click Reset to try again.'; }
  updateExerciseStatus(ex.dataset.ex, true);
}

/* ---------- Reset exercise ---------- */
function resetExercise(btn) {
  const ex = btn.closest('.exercise');
  ex.querySelectorAll('.fill-input[data-answer]').forEach(inp => {
    if (inp.dataset.locked !== undefined) { inp.value = inp.dataset.locked; }
    else { inp.value = ''; inp.readOnly = false; }
    inp.classList.remove('correct','wrong');
  });
  ex.querySelectorAll('.match-select[data-answer]').forEach(sel => {
    sel.value = ''; sel.classList.remove('correct','wrong');
  });
  const fb = ex.querySelector('.feedback');
  if (fb) fb.classList.remove('show','good','bad');
  const bar = ex.querySelector('.score-bar-wrap');
  if (bar) bar.remove();
}

/* ---------- Hint button ---------- */
function giveHint(btn) {
  const ex = btn.closest('.exercise');
  const empties = [...ex.querySelectorAll('.fill-input[data-answer]')]
    .filter(inp => !inp.readOnly && inp.value.trim() === '');
  if (empties.length === 0) return;
  const first = empties[0];
  const ans   = first.dataset.answer.split('|')[0];
  first.value = ans.charAt(0) + '_'.repeat(Math.max(0, ans.length - 1));
  first.focus();
}

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener('keydown', e => {
  // Ctrl+Enter = check focused exercise
  if (e.ctrlKey && e.key === 'Enter') {
    const ex = document.activeElement && document.activeElement.closest('.exercise');
    if (ex) { const btn = ex.querySelector('.check-btn'); if (btn) { e.preventDefault(); checkExercise(btn); } }
  }
  // Tab in fill-input = move to next blank input
});

// Auto-advance to next blank on Tab within exercise
document.addEventListener('DOMContentLoaded', () => {
  // Store readonly values for reset
  document.querySelectorAll('.fill-input[readonly]').forEach(inp => {
    inp.dataset.locked = inp.value;
  });
  // Clear styling on user edit
  document.querySelectorAll('.fill-input, .match-select').forEach(el => {
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      el.classList.remove('correct','wrong');
    });
  });
});
