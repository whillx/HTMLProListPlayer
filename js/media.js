'use strict';
// Where videos come from. The playlist stores only file names. A clip plays from disk when a file with
// that name is in the player's folder or one folder below it (the first one found wins). Otherwise it
// plays from a file the user gives it (adding it, "Locate folder…" or "Locate files…") until the page closes.
//
// A web page can't list folders, so the names of subfolders that hold videos are learned whenever the
// user picks or drops such a folder, and remembered in this browser.
const Media = (() => {
  const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.ogv', '.avi'];
  const isVideoName = n => VIDEO_EXT.some(x => n.toLowerCase().endsWith(x));
  const THUMB_W = 128, THUMB_H = 72;
  let getList = () => [];
  let onChange = () => {};

  function init(o) { getList = o.getList; onChange = o.onChange; }

  // ---------- probing a video URL: does it load, how long, a thumbnail ----------
  const queue = [];
  let running = 0;
  function probe(url, thumb) {
    return new Promise(resolve => { queue.push({ url, thumb, resolve }); pump(); });
  }
  function pump() {
    while (running < 3 && queue.length) {
      const job = queue.shift();
      running++;
      runProbe(job.url, job.thumb).then(r => { running--; job.resolve(r); pump(); });
    }
  }
  function runProbe(url, thumb) {
    return new Promise(resolve => {
      const v = document.createElement('video');
      v.muted = true;
      v.preload = thumb ? 'auto' : 'metadata';
      let meta = null;
      const finish = r => {
        clearTimeout(timer);
        v.onloadedmetadata = v.onseeked = v.onerror = null;
        v.removeAttribute('src');
        v.load();
        resolve(r);
      };
      const timer = setTimeout(() => finish(meta || { ok: false }), 15000);
      v.onerror = () => finish({ ok: false });
      v.onloadedmetadata = () => {
        meta = { ok: true, dur: v.duration };
        if (!thumb) return finish(meta);
        v.currentTime = Math.min(1, (v.duration || 0) / 2);   // a frame a little in, past any fade-in
      };
      v.onseeked = () => finish({ ...meta, thumb: drawThumb(v) });
      v.src = url;
    });
  }
  // Drawn into a visible canvas (reading pixels back would be blocked for local files; drawing is fine).
  function drawThumb(v) {
    const c = document.createElement('canvas');
    c.width = THUMB_W; c.height = THUMB_H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);
    if (v.videoWidth) {
      const s = Math.min(THUMB_W / v.videoWidth, THUMB_H / v.videoHeight);
      const w = v.videoWidth * s, h = v.videoHeight * s;
      try { ctx.drawImage(v, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h); } catch { /* leave black */ }
    }
    return c;
  }

  // ---------- the player folder on disk ----------
  const SUBS_KEY = 'subfolders:' + location.pathname;
  function subfolders() {
    const s = Store.get(SUBS_KEY, []);
    return Array.isArray(s) ? s.filter(x => typeof x === 'string') : [];
  }
  function learnSubfolder(sub) {
    const s = subfolders();
    if (sub && !s.includes(sub)) Store.set(SUBS_KEY, [...s, sub]);
  }
  // First place on disk where a file with this name loads: the player folder, then known subfolders.
  async function findOnDisk(name) {
    for (const p of [name, ...subfolders().map(s => s + '/' + name)]) {
      if ((await probe(Paths.toUrl(p), false)).ok) return p;
    }
    return null;
  }
  // A file picked or dropped inside a folder ("Picked/clip.mp4" or "Picked/sub/clip.mp4"): if that folder is a
  // subfolder of the player folder, or the player folder itself, the file can also be played from disk.
  async function diskPathOfPicked({ file, rel }) {
    const parts = rel ? rel.split('/') : [];
    let p = null;
    if (parts.length === 2) p = parts[0] + '/' + file.name;
    else if (parts.length === 3 && parts[0] === Paths.pageDirName) p = parts[1] + '/' + file.name;
    if (!p || !(await probe(Paths.toUrl(p), false)).ok) return null;
    learnSubfolder(Paths.dirName(p));
    return p;
  }

  // ---------- where each clip plays from (by clip id, while the page is open) ----------
  const sources = new Map();   // clip id -> { path } on disk, or { file, url } given by the user
  const status = new Map();    // clip id -> { state: 'checking' | 'ok' | 'missing', dur, thumb }
  const checks = new Map();    // clip id -> running check
  const statusOf = c => status.get(c.id) || { state: 'checking' };
  const sourceOf = c => sources.get(c.id) || null;

  function urlOf(src) {
    if (src.path !== undefined) return Paths.toUrl(src.path);
    if (!src.url) src.url = URL.createObjectURL(src.file);
    return src.url;
  }
  async function urlFor(c) {
    if (!sources.has(c.id) && checks.has(c.id)) await checks.get(c.id);   // still being looked up
    const src = sources.get(c.id);
    if (!src) throw new Error('not found');
    return urlOf(src);
  }

  // Finds the clip on disk (unless the user gave a file for it), then loads its duration and thumbnail.
  function check(c) {
    const job = (async () => {
      let src = sources.get(c.id);
      if (!src || !src.file) {
        const p = await findOnDisk(c.name);
        src = p ? { path: p } : null;
        if (src) sources.set(c.id, src); else sources.delete(c.id);
      }
      if (!src) return { state: 'missing' };
      const r = await probe(urlOf(src), true);
      return r.ok ? { state: 'ok', dur: r.dur, thumb: r.thumb } : { state: 'missing' };
    })().then(s => {
      if (checks.get(c.id) === job) { status.set(c.id, s); onChange(); }
      return s;
    });
    checks.set(c.id, job);
    status.set(c.id, { ...(status.get(c.id) || {}), state: 'checking' });   // keep the old thumbnail meanwhile
    onChange();
    return job;
  }

  // ---------- files the user gives ----------
  // Items: { file, rel } — rel is the path inside a picked/dropped folder (e.g. "Picked/sub/clip.mp4").
  const byPath = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const depth = it => (it.rel ? it.rel.split('/').length : 1);

  function itemsFromInput(files) {
    return [...files].filter(f => isVideoName(f.name) || (f.type || '').startsWith('video/'))
      .map(file => ({ file, rel: file.webkitRelativePath || '' }))
      .sort((a, b) => byPath(a.rel || a.file.name, b.rel || b.file.name));
  }
  const sortItems = items => items.sort((a, b) => byPath(a.rel || a.file.name, b.rel || b.file.name));
  // Some browser calls can wait forever; never let one freeze the player.
  const withTimeout = (promise, ms, fallback) =>
    Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(fallback), ms))]);

  // Must be called synchronously inside the drop event: the browser forgets the data afterwards.
  // Edge/Chrome: file handles (the older entry API fails on paths containing "#"). Others: entries.
  function readDrop(dt) {
    const dropped = [...dt.items].filter(i => i.kind === 'file');
    const plain = itemsFromInput(dt.files);
    if (dropped.length && dropped[0].getAsFileSystemHandle) {
      const pending = dropped.map(i => withTimeout(i.getAsFileSystemHandle().catch(() => null), 15000, null));
      return Promise.all(pending).then(async hs => (hs.some(h => !h) ? plain
        : sortItems((await Promise.all(hs.map(h => walkHandle(h, '', [])))).flat())));
    }
    const entries = dropped.map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
    if (!entries.length || entries.some(e => !e)) return Promise.resolve(plain);
    return Promise.all(entries.map(e => walkEntry(e, []))).then(lists => sortItems(lists.flat()));
  }
  async function walkHandle(h, prefix, out) {
    try {
      const rel = prefix ? prefix + '/' + h.name : h.name;
      if (h.kind === 'file') {
        if (isVideoName(h.name)) out.push({ file: await h.getFile(), rel: prefix ? rel : '' });
      } else if (out.length < 5000) {
        for await (const child of h.values()) if (!child.name.startsWith('.')) await walkHandle(child, rel, out);
      }
    } catch { /* unreadable: skip it */ }
    return out;
  }
  async function walkEntry(entry, out) {
    try {
      if (entry.isFile) {
        if (isVideoName(entry.name)) {
          const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
          const rel = entry.fullPath.replace(/^\//, '');
          out.push({ file, rel: rel.includes('/') ? rel : '' });
        }
      } else if (entry.isDirectory && out.length < 5000) {
        const reader = entry.createReader();
        for (;;) {
          const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
          if (!batch.length) break;
          for (const e of batch) if (!e.name.startsWith('.')) await walkEntry(e, out);
        }
      }
    } catch { /* unreadable entry: skip it */ }
    return out;
  }

  // New clips for the given files. Each plays from disk if found there, else from the file itself.
  async function addClips(items) {
    return Promise.all(items.map(async it => {
      const c = Store.clip({ name: it.file.name });
      const p = (await diskPathOfPicked(it)) || (await findOnDisk(it.file.name));
      sources.set(c.id, p ? { path: p } : { file: it.file });
      return c;
    }));
  }

  // Matches missing clips to picked files by name (files nearest the top of a picked folder first).
  async function locate(items) {
    items = [...items].sort((a, b) => depth(a) - depth(b));
    const missing = getList().filter(c => statusOf(c).state === 'missing');
    let found = 0;
    for (const c of missing) {
      const it = items.find(i => i.file.name === c.name);
      if (!it) continue;
      const p = await diskPathOfPicked(it);
      sources.set(c.id, p ? { path: p } : { file: it.file });
      found++;
      check(c);
    }
    return { missing: missing.length, found };
  }

  return { isVideoName, init, statusOf, sourceOf, check, urlFor, itemsFromInput, readDrop, addClips, locate };
})();
