'use strict';
// Saving and loading, in the browser's localStorage. The playlist stores only file names and options.
const Store = (() => {
  const LIST_KEY = 'prolist:v3:' + location.pathname;   // one playlist per player file location

  const newId = () => (crypto.randomUUID ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2));

  // ---------- settings ----------
  function get(name, fallback) {
    try {
      const v = localStorage.getItem('prolist:' + name);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  }
  function set(name, value) {
    try { localStorage.setItem('prolist:' + name, JSON.stringify(value)); } catch { /* not critical */ }
  }

  // ---------- clips ----------
  // A clip is { id, name, mode }; mode is 'loop' (default), 'once' or 'trans'. id exists only while the page is open.
  const MODES = ['loop', 'once', 'trans'];
  function clip(x) {
    if (!x || typeof x.name !== 'string' || !x.name.trim()) return null;
    const mode = MODES.includes(x.mode) ? x.mode : x.once ? 'once' : x.trans ? 'trans' : 'loop';
    return { id: newId(), name: x.name.trim(), mode };
  }
  const saved = c => ({ name: c.name, mode: c.mode });

  function loadList() {
    try {
      const d = JSON.parse(localStorage.getItem(LIST_KEY));
      return d && Array.isArray(d.clips) ? d.clips.map(clip).filter(Boolean) : [];
    } catch { return []; }
  }
  function saveList(list) {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify({ version: 3, clips: list.map(saved) }));
      return true;
    } catch { return false; }
  }

  // Exported as playlist.js: the same data, wrapped so a local page may load it with a <script> tag
  // (browsers don't let a local page read a .json file next to it, which auto-import needs).
  const JS_PREFIX = 'window.PROLIST_PLAYLIST = ';
  const exportText = list =>
    JS_PREFIX + JSON.stringify({ app: 'ProList Player', version: 3, clips: list.map(saved) }, null, 2) + ';\n';
  function fromData(d) {
    if (!d || !Array.isArray(d.clips)) throw new Error('not a ProList playlist file');
    return d.clips.map(clip).filter(Boolean);
  }
  // Accepts playlist.js or plain JSON.
  function importText(text) {
    text = text.trim();
    if (text.startsWith(JS_PREFIX)) text = text.slice(JS_PREFIX.length).replace(/;\s*$/, '');
    return fromData(JSON.parse(text));
  }

  // Removes what older versions of the player stored (paths, folder links, file handles).
  function removeOldData() {
    try {
      for (const k of Object.keys(localStorage)) {
        if (/^prolist:(v2:|\/|[a-z]:\/|folders$|findDir$)/i.test(k)) localStorage.removeItem(k);
      }
      indexedDB.deleteDatabase('prolist');
    } catch { /* not critical */ }
  }

  return { MODES, get, set, clip, loadList, saveList, exportText, importText, fromData, removeOldData };
})();
