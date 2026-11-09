'use strict';
// The page: playlist, menus, dialogs, keys. Owns the playlist array.
const $ = s => document.querySelector(s);
Store.removeOldData();
let list = Store.loadList();
const stage = $('#stage');

// ---------- status line ----------
function setState(text, isErr) {
  const el = $('#state');
  el.textContent = text;
  el.title = text;
  el.classList.toggle('err', !!isErr);
}

// Call after any change to the playlist.
function changed() {
  if (!Store.saveList(list)) setState('Could not save the playlist', true);
  Engine.listChanged();
  render();
}

Media.init({ getList: () => list, onChange: scheduleRender });
Engine.init({
  videos: [$('#vA'), $('#vB')],
  getList: () => list,
  urlFor: Media.urlFor,
  onState: setState,
  onIndex: highlight,
  onFail: c => Media.check(c),
  onPlayState: playing => $('#btn-play').classList.toggle('playing', playing),
});

// ---------- playlist ----------
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
const shownName = c => c.name.replace(/\.[^.]+$/, '');   // file name without its extension
function fmtDur(s) {
  if (!isFinite(s)) return '';
  s = Math.round(s);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function tooltip(c, st) {
  const src = Media.sourceOf(c);
  if (st.state === 'missing') return c.name + '\nNot found in the player folder. Use Locate folder… or Locate files….';
  if (src && src.file) return c.name + '\nNot in the player folder: playing the file you gave. It has to be located again next time.';
  if (src) return src.path + '\n(in the player folder)';
  return c.name;
}
const MODE_INFO = {
  loop: { label: 'Loop', title: 'Loop: repeat until you press →',
          icon: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z' },
  once: { label: 'Once', title: 'Once: play once and hold the last frame',
          icon: 'M3 11h11V7l5 5-5 5v-4H3zM20 5h2v14h-2z' },
  trans: { label: 'Trans', title: 'Trans: move on to the next clip by itself',
           icon: 'M5 6l6 6-6 6-1.4-1.4L8.2 12 3.6 7.4zM13 6l6 6-6 6-1.4-1.4 4.6-4.6-4.6-4.6z' },
};
const modeButtons = c => Store.MODES.map(m =>
  `<button class="mode${c.mode === m ? ' on' : ''}" data-mode="${m}" title="${MODE_INFO[m].title}">` +
  `<svg viewBox="0 0 24 24"><path d="${MODE_INFO[m].icon}"/></svg></button>`).join('');

// ---------- selection (for batch editing) ----------
const selected = new Set();   // clip ids
const selectedClips = () => list.filter(c => selected.has(c.id));
// The clips an action on clip c applies to: all selected clips if c is one of them, else just c.
const targetsOf = c => (selected.has(c.id) ? selectedClips() : [c]);
function setMode(clips, mode) {
  clips.forEach(c => { c.mode = mode; Engine.setLoop(c); });
  changed();
}
function removeClips(clips) {
  if (clips.length > 1 && !confirm(`Remove ${clips.length} selected clips from the playlist?`)) return;
  const ids = new Set(clips.map(c => c.id));
  list = list.filter(c => !ids.has(c.id));
  ids.forEach(id => selected.delete(id));
  changed();
}

function render() {
  const ul = $('#list');
  ul.textContent = '';
  for (const id of [...selected]) if (!list.some(c => c.id === id)) selected.delete(id);
  const multi = selected.size > 1;   // reordering is off while several clips are selected
  list.forEach((c, i) => {
    const st = Media.statusOf(c);
    const src = Media.sourceOf(c);
    const picked = !!(src && src.file) && st.state !== 'missing';
    const li = document.createElement('li');
    li.dataset.i = i;
    li.title = tooltip(c, st);
    li.classList.toggle('missing', st.state === 'missing');
    li.classList.toggle('picked', picked);
    li.classList.toggle('selected', selected.has(c.id));
    li.innerHTML =
      '<input type="checkbox" class="sel" title="Select for batch editing">' +
      `<div class="thumb${multi ? ' nodrag' : ''}" title="${multi ? '' : 'Drag to reorder'}"></div>` +
      '<div class="body">' +
        '<div class="line1"><span class="num"></span><span class="name"></span><span class="dur"></span></div>' +
        '<div class="line2">' +
          '<span class="modes">' + modeButtons(c) + '</span>' +
          '<span class="spacer"></span>' +
          `<button class="sm up" title="Move up"${multi ? ' disabled' : ''}>↑</button>` +
          `<button class="sm down" title="Move down"${multi ? ' disabled' : ''}>↓</button>` +
          '<button class="sm del" title="Remove from playlist (all selected, if this one is selected)">✕</button>' +
        '</div>' +
      '</div>';
    li.querySelector('.sel').checked = selected.has(c.id);
    const box = li.querySelector('.thumb');
    if (st.thumb && st.state !== 'missing') box.appendChild(st.thumb);
    else box.textContent = st.state === 'missing' ? '⚠' : '…';
    li.querySelector('.num').textContent = (i + 1) + '.';
    li.querySelector('.name').textContent = shownName(c);
    li.querySelector('.dur').textContent =
      ({ checking: '…', ok: fmtDur(st.dur), missing: '⚠ not found' })[st.state] + (picked ? ' · this session only' : '');
    ul.appendChild(li);
  });
  $('#empty').style.display = list.length ? 'none' : '';
  const missing = list.filter(c => Media.statusOf(c).state === 'missing').length;
  $('#missingbar').hidden = !missing;
  $('#missing-text').textContent = `${missing} video(s) not found in the player folder.`;
  // menu items that need missing videos / a selection / any clips are greyed out otherwise
  document.querySelectorAll('[data-needs=missing]').forEach(b => { b.disabled = !missing; });
  document.querySelectorAll('[data-needs=selection]').forEach(b => { b.disabled = !selected.size; });
  document.querySelectorAll('[data-needs=clips]').forEach(b => { b.disabled = !list.length; });
  highlight(Engine.index);
}
function highlight(index) {
  document.querySelectorAll('#list li').forEach(li => li.classList.toggle('current', +li.dataset.i === index));
  const cur = document.querySelector('#list li.current');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
  const c = list[index];
  $('#info').textContent = c
    ? `${index + 1} / ${list.length} · ${shownName(c)} · ${MODE_INFO[c.mode].label}`
    : '';
  $('#stage-msg').textContent = list.length ? '' : 'Add videos to begin';
}

const rowIndex = el => { const li = el.closest('li'); return li ? +li.dataset.i : -1; };
function move(from, to) {   // `to` = insertion position in the list before removal
  if (from === to || from + 1 === to) return;
  const [c] = list.splice(from, 1);
  if (to > from) to--;
  list.splice(to, 0, c);
  changed();
}

const ul = $('#list');
let suppressClick = false;   // the click that ends a thumbnail drag must not select the row
ul.addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; return; }
  const i = rowIndex(e.target);
  if (i < 0) return;
  const c = list[i];
  const btn = e.target.closest('button');
  if (btn) {
    if (btn.classList.contains('mode')) setMode(targetsOf(c), btn.dataset.mode);
    else if (btn.classList.contains('up') && i > 0) move(i, i - 1);
    else if (btn.classList.contains('down') && i < list.length - 1) move(i, i + 2);
    else if (btn.classList.contains('del')) removeClips(targetsOf(c));
    return;
  }
  if (e.target.closest('.sel')) return;
  Engine.select(i);
});
ul.addEventListener('change', e => {
  if (!e.target.classList.contains('sel')) return;
  const c = list[rowIndex(e.target)];
  if (!c) return;
  if (e.target.checked) selected.add(c.id); else selected.delete(c.id);
  render();
});

// Where something dragged over the playlist would go: the insertion index for the mouse position, shown as a
// line before/after a row. Below the last row (the empty space at the end) means "at the end".
const clearDropMarks = () => ul.querySelectorAll('.drop-before, .drop-after').forEach(li => li.classList.remove('drop-before', 'drop-after'));
function markDropPosition(clientY) {
  clearDropMarks();
  const rows = [...ul.children];
  for (const li of rows) {
    const r = li.getBoundingClientRect();
    if (clientY < r.bottom) {
      const before = clientY < r.top + r.height / 2;
      li.classList.add(before ? 'drop-before' : 'drop-after');
      return +li.dataset.i + (before ? 0 : 1);
    }
  }
  if (rows.length) rows[rows.length - 1].classList.add('drop-after');
  return rows.length;
}
// While dragging near the top or bottom edge of the playlist, scroll it.
function autoScroll(clientY) {
  const r = ul.getBoundingClientRect();
  if (clientY < r.top + 40) ul.scrollTop -= 12;
  else if (clientY > r.bottom - 40) ul.scrollTop += 12;
}

// drag a thumbnail to reorder (pointer events, not HTML5 drag-and-drop, for reliability)
let drag = null;   // { from, x, y, moved, to }
ul.addEventListener('pointerdown', e => {
  const thumb = e.target.closest('.thumb');
  if (!thumb || e.button !== 0 || selected.size > 1) return;
  e.preventDefault();
  drag = { from: rowIndex(thumb), x: e.clientX, y: e.clientY, moved: false, to: -1 };
  thumb.setPointerCapture(e.pointerId);
});
ul.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
  drag.moved = true;
  autoScroll(e.clientY);
  drag.to = markDropPosition(e.clientY);
});
ul.addEventListener('pointerup', () => {
  if (!drag) return;
  const { from, to, moved } = drag;
  drag = null;
  clearDropMarks();
  if (!moved) return;   // a plain click on the thumbnail selects the clip as usual
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 0);
  if (to >= 0) move(from, to);
});
ul.addEventListener('pointercancel', () => { drag = null; clearDropMarks(); });

// resizable playlist panel
const side = $('#side');
const splitter = $('#splitter');
function setSideWidth(w) { side.style.width = Math.max(260, Math.min(w, window.innerWidth - 320)) + 'px'; }
splitter.addEventListener('pointerdown', e => {
  e.preventDefault();
  splitter.setPointerCapture(e.pointerId);
  splitter.classList.add('dragging');
});
splitter.addEventListener('pointermove', e => {
  if (splitter.classList.contains('dragging')) setSideWidth(e.clientX - side.getBoundingClientRect().left);
});
splitter.addEventListener('pointerup', () => {
  splitter.classList.remove('dragging');
  Store.set('sideWidth', parseInt(side.style.width, 10));
});

// show / hide the playlist (remembered)
function setSidebar(show) {
  document.body.classList.toggle('noside', !show);
  $('#btn-sidebar').classList.toggle('on', show);
  Store.set('sidebar', show);
}
$('#btn-sidebar').onclick = () => setSidebar(document.body.classList.contains('noside'));
setSidebar(Store.get('sidebar', true) !== false);

// ---------- adding and locating videos ----------
// Adds clips at position `at` in the playlist (default: the end).
async function addItems(items, at = list.length) {
  if (!items.length) { setState('No video files found', true); return; }
  setState(`Adding ${items.length} clip(s)…`);
  const clips = await Media.addClips(items);
  list.splice(Math.min(at, list.length), 0, ...clips);
  clips.forEach(c => Media.check(c));
  changed();
  const outside = clips.filter(c => Media.sourceOf(c).file).length;
  setState(`Added ${clips.length} clip(s)` +
    (outside ? ` — ${outside} not in the player folder: they play now, but must be located again next time` : ''), outside > 0);
}
async function locateItems(items) {
  if (!items.length) { setState('No video files found', true); return; }
  const cur = list[Engine.index];
  const curMissing = cur && Media.statusOf(cur).state === 'missing';
  const r = await Media.locate(items);
  render();
  if (curMissing && Media.sourceOf(cur)) Engine.reloadCurrent();
  setState(!r.missing ? 'Nothing is missing' : `Located ${r.found} of ${r.missing} missing video(s)`, r.found < r.missing);
}

// Drop files or folders on the playlist to insert them where the line shows; anywhere else adds them at the end.
const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
const overPlaylist = e => !document.body.classList.contains('noside') && side.contains(e.target);
document.addEventListener('dragover', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  if (overPlaylist(e)) { autoScroll(e.clientY); markDropPosition(e.clientY); } else clearDropMarks();
});
document.addEventListener('dragleave', e => { if (!e.relatedTarget) clearDropMarks(); });   // left the window
document.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  const at = overPlaylist(e) ? markDropPosition(e.clientY) : list.length;
  clearDropMarks();
  Media.readDrop(e.dataTransfer).then(items => addItems(items, at));   // readDrop must run inside the event
});

function onPick(input, fn) {
  input.onchange = () => { const items = Media.itemsFromInput(input.files); input.value = ''; fn(items); };
}
onPick($('#file-videos'), addItems);
onPick($('#file-folder'), addItems);
onPick($('#locate-folder'), locateItems);
onPick($('#locate-files'), locateItems);
$('#btn-locate-folder').onclick = () => $('#locate-folder').click();
$('#btn-locate-files').onclick = () => $('#locate-files').click();

// ---------- menus ----------
const commands = {
  exportList() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Store.exportText(list)], { type: 'text/javascript' }));
    a.download = 'playlist.js';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  importList() { $('#file-import').click(); },
  clearList() {
    if (!list.length || !confirm(`Remove all ${list.length} clips from the playlist?`)) return;
    list = [];
    changed();
  },
  importVideos() { $('#file-videos').click(); },
  importFolder() { $('#file-folder').click(); },
  locateFolder() { $('#locate-folder').click(); },
  locateFiles() { $('#locate-files').click(); },
  selectAll() { list.forEach(c => selected.add(c.id)); render(); },
  selectNone() { selected.clear(); render(); },
  setMode(mode) { setMode(selectedClips(), mode); },
  deleteSelected() { removeClips(selectedClips()); },
  showKeys() { $('#dlg-keys').showModal(); },
  showAbout() { $('#dlg-about').showModal(); },
};
$('#file-import').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const clips = Store.importText(await f.text());
    if (list.length && !confirm(`Replace the current playlist with ${clips.length} clips from ${f.name}?`)) return;
    Engine.unload();
    list = clips;
    list.forEach(c => Media.check(c));
    changed();
  } catch (err) {
    alert('Could not import: ' + err.message);
  }
};

const menubar = $('#menubar');
const closeMenus = () => menubar.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
menubar.addEventListener('click', e => {
  const top = e.target.closest('.menu-btn');
  if (top) {
    const m = top.parentElement;
    const wasOpen = m.classList.contains('open');
    closeMenus();
    if (!wasOpen) m.classList.add('open');
    return;
  }
  const item = e.target.closest('[data-cmd]');
  if (item && !item.disabled) { closeMenus(); commands[item.dataset.cmd](item.dataset.arg); }
});
// once a menu is open, hovering another one switches to it
menubar.addEventListener('mouseover', e => {
  const top = e.target.closest('.menu-btn');
  if (top && menubar.querySelector('.menu.open') && !top.parentElement.classList.contains('open')) {
    closeMenus();
    top.parentElement.classList.add('open');
  }
});
document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeMenus(); });

// ---------- playing, fullscreen, keys ----------
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else stage.requestFullscreen().catch(err => setState('Fullscreen failed: ' + err.message, true));
}
$('#btn-start').onclick = () => { if (list.length) Engine.select(0); };   // first clip, first frame, paused
$('#btn-fullscreen').onclick = toggleFullscreen;
document.addEventListener('fullscreenchange', () =>
  $('#btn-fullscreen').classList.toggle('active', document.fullscreenElement === stage));
// Like the arrow keys, but also while the first clip is ready they move without starting it.
$('#btn-prev').onclick = () => Engine.prev({ followPause: true });
$('#btn-next').onclick = () => Engine.next({ followPause: true });
$('#btn-play').onclick = togglePause;

// ---------- seek bar and volume ----------
const seekBar = $('#seek');
let dragging = false;   // while the seek bar is being dragged, it isn't moved by playback
const clock = s => (isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00');
(function followPlayback() {
  const v = Engine.video;
  if (!dragging) seekBar.value = v.duration ? Math.round((v.currentTime / v.duration) * 1000) : 0;
  $('#t-cur').textContent = clock(v.currentTime);
  $('#t-dur').textContent = clock(v.duration);
  requestAnimationFrame(followPlayback);
})();
// A drag ends with the button released anywhere (in fullscreen the bar hides as soon as the mouse leaves the
// bottom strip, so the release often lands on the video), a cancelled pointer, or the window losing focus.
// While it lasts the controls stay shown.
seekBar.addEventListener('pointerdown', () => { dragging = true; $('#controls').classList.add('dragging'); });
seekBar.addEventListener('input', () => Engine.seekTo(seekBar.value / 1000));
function endDrag() {
  if (!dragging) return;
  dragging = false;
  $('#controls').classList.remove('dragging');
  seekBar.blur();
}
seekBar.addEventListener('change', endDrag);
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, endDrag, true));
window.addEventListener('blur', endDrag);

const volumeBar = $('#volume');
let volume = Store.get('volume', 1), muted = Store.get('muted', false);
function applyVolume() {
  Engine.setVolume(volume, muted);
  volumeBar.value = volume;
  $('#btn-mute').classList.toggle('muted', muted || volume === 0);
  Store.set('volume', volume);
  Store.set('muted', muted);
}
volumeBar.addEventListener('input', () => { volume = +volumeBar.value; muted = false; applyVolume(); });
volumeBar.addEventListener('change', () => volumeBar.blur());
volumeBar.addEventListener('pointerup', () => volumeBar.blur());
$('#btn-mute').onclick = () => { muted = !muted; applyVolume(); };
applyVolume();

// Pause / resume. On pause, a pause icon flashes at the bottom left of the picture.
function togglePause() {
  if (Engine.togglePause() === 'pause') flashPauseIcon();
}
function flashPauseIcon() {
  const icon = $('#pause-icon');
  const v = Engine.video;
  const s = stage.getBoundingClientRect();
  let left = 0, bottom = 0;   // offset of the picture inside the stage (black bars around it)
  if (v.videoWidth && v.videoHeight) {
    const k = Math.min(s.width / v.videoWidth, s.height / v.videoHeight);
    left = (s.width - v.videoWidth * k) / 2;
    bottom = (s.height - v.videoHeight * k) / 2;
  }
  const gap = Math.max(12, s.width * 0.02);
  icon.style.left = left + gap + 'px';
  icon.style.bottom = bottom + gap + 'px';
  icon.classList.remove('flash');
  void icon.offsetWidth;   // restart the animation
  icon.classList.add('flash');
}

// Double-click the video for fullscreen (not on the playback buttons, which get clicked quickly in a row).
stage.addEventListener('dblclick', e => { if (!e.target.closest('#controls')) toggleFullscreen(); });

// hide the mouse cursor in fullscreen after 2s of no movement (not while it is over the playback buttons)
let cursorTimer;
function wakeCursor() {
  stage.classList.remove('nocursor');
  clearTimeout(cursorTimer);
  if (document.fullscreenElement) {
    cursorTimer = setTimeout(() => { if (!$('#controls').matches(':hover')) stage.classList.add('nocursor'); }, 2000);
  }
}
stage.addEventListener('mousemove', wakeCursor);
document.addEventListener('fullscreenchange', wakeCursor);

// keep Space/arrows from activating whatever button was last clicked
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });

document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || e.target.matches('input[type=text]')) return;
  if (e.target.matches('input[type=range]')) e.target.blur();   // keys drive the clips, not a focused slider
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  switch (e.key) {
    case 'ArrowRight': case 'PageDown':
      e.preventDefault(); closeMenus(); Engine.next(); break;
    case 'ArrowLeft': case 'PageUp':
      e.preventDefault(); closeMenus(); Engine.prev(); break;
    case ' ':
      e.preventDefault(); closeMenus(); togglePause(); break;
    case '<': case ',':
      e.preventDefault(); Engine.seekBy(-3); break;
    case '>': case '.':
      e.preventDefault(); Engine.seekBy(3); break;
    case 'f': case 'F':
      e.preventDefault(); toggleFullscreen(); break;
    case 'Escape':
      closeMenus(); break;
  }
});

// ---------- start ----------
if (location.protocol === 'file:' && /^\/run\/user\/\d+\/doc\//.test(location.pathname)) $('#banner').hidden = false;
const savedWidth = Store.get('sideWidth', 0);
if (savedWidth) setSideWidth(savedWidth);
render();
Promise.all(list.map(c => Media.check(c))).then(states => {
  const missing = states.filter(s => s.state === 'missing').length;
  if (missing) setState(`${missing} video(s) not found — use Locate folder… or Locate files…`, true);
});
Engine.listChanged();
if (!list.length) offerAutoImport();

// With an empty playlist, look for a playlist.js next to the player and offer to import it.
function offerAutoImport() {
  const s = document.createElement('script');
  s.src = 'playlist.js';
  s.onerror = () => s.remove();   // there is none
  s.onload = () => {
    let clips;
    try { clips = Store.fromData(window.PROLIST_PLAYLIST); } catch { return; }
    if (!clips.length || list.length) return;
    $('#autoimport-text').textContent = `Found playlist.js next to the player with ${clips.length} clip(s). Import it?`;
    const dlg = $('#dlg-autoimport');
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'import' || list.length) return;
      list = clips;
      list.forEach(c => Media.check(c));
      changed();
      setState(`Imported ${clips.length} clip(s) from playlist.js`);
    }, { once: true });
    dlg.showModal();
  };
  document.head.appendChild(s);
}
