'use strict';
// Playback. Two stacked <video> elements. A clip is loaded only when it is needed, in the video underneath;
// the current clip's picture stays on screen until the new clip's first frame is drawn, so there is never a
// black flash between clips. Then the old video is emptied, so only one clip is ever loaded.
const Engine = (() => {
  let opt, vids, active;
  let index = -1;        // position of the current clip in the playlist
  let current = null;    // the current clip itself, tracked by reference so list edits don't lose it
  let armed = false;     // the first clip is ready: shown on its first frame, waiting for → to start it
  let pending = false;   // a clip switch is in progress
  let userPaused = false; // paused (Play-Pause / Space, or another clip shown without playing): → keeps it paused
  let token = 0;         // cancels stale switches
  const list = () => opt.getList();
  const loops = c => !!c && c.mode === 'loop';
  const isTrans = c => !!c && c.mode === 'trans';
  const inactive = () => (active === vids[0] ? vids[1] : vids[0]);

  // o: { videos: [v, v], getList, urlFor(clip) -> Promise<url>, onState(text, isErr), onIndex(i), onFail(clip),
  //      onPlayState(isPlaying) }
  function init(o) {
    opt = o;
    vids = o.videos;
    active = vids[0];
    vids.forEach(v => {
      v.addEventListener('ended', () => {
        if (v !== active || pending) return;
        const c = list()[index];
        if (isTrans(c) && index < list().length - 1) next();
        else opt.onState('Ended — holding last frame');
      });
      ['play', 'pause', 'ended'].forEach(ev => v.addEventListener(ev, () => { if (v === active) opt.onPlayState(!v.paused); }));
    });
  }
  function setCurrent(i) {
    index = i;
    current = list()[i] || null;
    opt.onIndex(index);
  }

  function setSrc(v, key, url) {
    if (v.dataset.key !== key || v.error) {
      stopFrameWait(v);
      v.dataset.key = key;
      v.src = url;
    } else if (v.readyState >= 1 && v.currentTime !== 0) {
      v.currentTime = 0;
    }
  }
  function whenReady(v) {
    return new Promise((resolve, reject) => {
      if (v.error) return reject(v.error);
      if (v.readyState >= 2 && !v.seeking) return resolve();
      const ok = () => { if (v.readyState >= 2 && !v.seeking) { done(); resolve(); } };
      const bad = () => { done(); reject(v.error || new Error('load failed')); };
      const done = () => {
        v.removeEventListener('loadeddata', ok);
        v.removeEventListener('seeked', ok);
        v.removeEventListener('error', bad);
      };
      v.addEventListener('loadeddata', ok);
      v.addEventListener('seeked', ok);
      v.addEventListener('error', bad);
    });
  }
  // Resolves once the video's picture has reached the screen (or after a short safety timeout, e.g. for a
  // paused video, which may not report a new frame).
  // Firefox: a frame callback still waiting when its video's source changes stops every animation frame of the
  // page for good (and with them the seek bar), so one is never left waiting: it is cancelled on the timeout and
  // before the source changes.
  const frameWaits = new Map();   // video -> its waiting frame callback
  function onScreen(v) {
    return new Promise(resolve => {
      const done = () => { clearTimeout(t); stopFrameWait(v); resolve(); };
      const t = setTimeout(done, 300);
      if (v.requestVideoFrameCallback) frameWaits.set(v, v.requestVideoFrameCallback(done));
    });
  }
  function stopFrameWait(v) {
    if (!frameWaits.has(v)) return;
    v.cancelVideoFrameCallback(frameWaits.get(v));
    frameWaits.delete(v);
  }
  // Brings v to the front. The old clip stays visible underneath (frozen) until v's picture is actually on
  // screen, so a not-yet-drawn video shows the old picture instead of black. Only then is the old one
  // hidden and emptied, which frees its decoder.
  let leaving = null;   // the old video while it is still showing underneath
  function swap(v) {
    const old = active;
    active = v;
    pending = false;
    v.classList.remove('leaving');
    v.classList.add('show');
    if (old !== v) {
      old.pause();
      old.classList.remove('show');
      old.classList.add('leaving');
      leaving = old;
      onScreen(v).then(() => {
        if (leaving !== old) return;   // a later switch already took over
        leaving = null;
        empty(old);
      });
    }
    opt.onPlayState(!v.paused);
  }
  function empty(v) {
    stopFrameWait(v);
    v.pause();
    v.classList.remove('leaving');
    v.removeAttribute('src');
    delete v.dataset.key;
    v.load();
  }

  // play: start the clip. Otherwise it is shown on its first frame: the first clip of the playlist is ready
  // (→ starts it), any other clip is paused.
  async function goTo(i, play) {
    const L = list();
    if (i < 0 || i >= L.length) return;
    const my = ++token;
    const c = L[i];
    pending = true;
    armed = false;
    userPaused = !play && i > 0;
    setCurrent(i);
    opt.onState('Loading…');
    try {
      const url = await opt.urlFor(c);
      if (my !== token) return;
      const v = inactive();
      if (v === leaving) leaving = null;   // switched again before the last switch finished: reuse it now
      setSrc(v, c.id + '|' + url, url);
      v.loop = loops(c);
      await whenReady(v);
      if (my !== token) return;
      if (play) {
        try {
          await v.play();
        } catch (err) {
          if (my !== token) return;
          if (err.name !== 'NotAllowedError') throw err;
          play = false;   // the browser blocked autoplay: show the first frame instead
          userPaused = i > 0;
        }
      }
      swap(v);
      armed = !play && i === 0;
      opt.onState(play ? (loops(c) ? 'Looping' : 'Playing') : armed ? 'Ready — press → to play' : 'Paused');
    } catch (err) {
      if (my !== token) return;
      pending = false;
      opt.onFail(c);
      opt.onState(err && err.code === 'locked'
        ? `${c.name} needs permission — click “Allow access”`
        : `Cannot play ${c.name} — press → to skip`, true);
    }
  }

  // Paused stays paused: the next clip is shown on its first frame, paused. opts.followPause (the Prev / Next
  // buttons): the same while the first clip is ready, where → would start it.
  function next(opts = {}) {
    const L = list();
    if (!L.length) return;
    if (userPaused || (opts.followPause && armed)) {
      if (index < L.length - 1) goTo(index + 1, false);
      return;
    }
    if (armed && !pending) {
      armed = false;
      active.play().then(
        () => opt.onState(loops(L[index]) ? 'Looping' : 'Playing'),
        err => opt.onState('Cannot play: ' + err.message, true));
      return;
    }
    if (index < L.length - 1) goTo(index + 1, true);
  }
  // Previous clip, skipping transition clips; paused stays paused, as for next(). With nothing before but
  // transitions (e.g. the first clip is a Trans clip), or on the first clip itself: back to the first frame of
  // the first clip, ready for →.
  function prev(opts = {}) {
    const L = list();
    let i = index - 1;
    while (i >= 0 && isTrans(L[i])) i--;
    if (i >= 0) goTo(i, !(userPaused || (opts.followPause && armed)));
    else if (L.length) goTo(0, false);
  }
  // Seek bar: moves within the current clip without changing whether it plays.
  // Also the < / > keys. A seek stops just short of the end, so it shows the last frame without ending the
  // clip (which would move a Trans clip on to the next one). The first clip, paused and sought back to its first
  // frame, is ready again: → starts it.
  function seekTime(t) {
    const v = active;
    if (pending || index < 0 || !isFinite(v.duration) || !v.duration) return;
    t = Math.max(0, Math.min(v.duration - 0.01, t));
    v.currentTime = t;
    if (t === 0 && userPaused && index === 0) {
      userPaused = false;
      armed = true;
      opt.onState('Ready — press → to play');
    }
  }
  const seekTo = fraction => seekTime(fraction * active.duration);
  const seekBy = seconds => seekTime(active.currentTime + seconds);
  // Applies to both video elements, so it carries over to every clip.
  function setVolume(volume, muted) {
    vids.forEach(v => { v.volume = volume; v.muted = muted; });
  }
  // Clicking the video / the Play-Pause button. Returns 'play', 'pause' or null (nothing to do).
  function togglePause() {
    if (pending || index < 0) return null;
    if (armed) { next(); return 'play'; }
    if (active.paused) {
      userPaused = false;
      const c = list()[index];
      active.play().then(
        () => opt.onState(loops(c) ? 'Looping' : 'Playing'),
        err => opt.onState('Cannot play: ' + err.message, true));
      return 'play';
    }
    active.pause();
    userPaused = true;
    opt.onState('Paused');
    return 'pause';
  }

  function unload() {
    token++;
    pending = false;
    armed = false;
    leaving = null;
    vids.forEach(empty);
    setCurrent(-1);
    opt.onState('');
    opt.onPlayState(false);
  }
  // Call after any change to the playlist.
  function listChanged() {
    const L = list();
    const i = current ? L.indexOf(current) : -1;
    if (i >= 0) {
      index = i;
      opt.onIndex(index);
    } else if (!L.length) {
      if (index !== -1 || current) unload();
    } else {
      goTo(Math.min(Math.max(index, 0), L.length - 1), false);   // current clip was removed: show the one in its place
    }
  }
  function reloadCurrent() { if (!pending && index >= 0) goTo(index, false); }
  function setLoop(c) {
    if (c === current) active.loop = loops(c);
  }

  return { init, select: i => goTo(i, false), next, prev, togglePause, seekTo, seekBy, setVolume, unload, listChanged, reloadCurrent, setLoop,
           get index() { return index; }, get video() { return active; } };
})();
