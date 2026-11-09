# Architecture

Plain HTML, CSS and JavaScript, opened straight from disk (`file://`). No build step and no dependencies.

## Files

| File | What it does |
|---|---|
| `player.html` | The page: menus, playlist panel, video stage, control bar, dialogs. Loads the scripts below in order. |
| `css/player.css` | All styling. |
| `js/paths.js` | File-name and URL helpers. |
| `js/storage.js` | The playlist and settings in localStorage; `playlist.js` export and import. |
| `js/media.js` | Finding videos (on disk or from files the user gave), drag-and-drop reading, thumbnails and durations. |
| `js/engine.js` | Playback: clip switching, modes, Ready / paused state, seeking, volume. |
| `js/ui.js` | Everything the user touches: playlist rendering, menus, keys, buttons, seek bar, startup. |

The scripts are classic `<script>` tags, not ES modules: browsers block modules on `file://`. For the same
reason the exported playlist is `playlist.js` (`window.PROLIST_PLAYLIST = {...};`), which loads with a script
tag, rather than a JSON file, which can't be fetched from `file://`.

## Clip switching without a black frame

The stage has two stacked `<video>` elements. A clip is loaded only when it is needed:

1. The new clip loads in the hidden video.
2. When it is ready (and playing, if it should play), it moves to the front. The old video stays visible
   underneath with its picture frozen. A video that hasn't drawn a frame yet is transparent, so the old picture
   shows through instead of black (the videos have no CSS background for this reason).
3. Once the new clip's first frame is on screen (`requestVideoFrameCallback`, with a 300 ms fallback), the old
   video is emptied, freeing its decoder.

Only one clip is loaded at a time; nothing is preloaded.

## Browser quirks worked around

- **Firefox, `requestVideoFrameCallback`**: a frame callback still waiting when its video's source changes stops
  every animation frame of the page for good. The seek bar is updated from an animation-frame loop, so it froze
  after quickly clicking through clips. Pending callbacks are cancelled before a source changes, when a video is
  emptied, and on the fallback timeout.
- **Preloading was removed**: an earlier version kept the next clip preloaded and paused. Edge suspends a player
  paused for about 15 s, and Firefox stops decoding a video it considers invisible after 10 s; keeping the
  preloaded video awake needed periodic seeks that competed with the playing clip and caused stalls on long
  loops. Loading on demand avoids all of it.
- **Seeking to the very end** fires `ended`, which would move a Trans clip on, so seeks stop 0.01 s short of it.
- **Seek bar drags** end on a pointer release anywhere on the page (or a cancel or window blur), not only on the
  bar: in fullscreen the bar hides as soon as the mouse leaves it, so the release often lands elsewhere.
- **Dropped folders**: Edge / Chrome read them with `getAsFileSystemHandle`, because the older
  `webkitGetAsEntry` fails on paths containing `#`. Firefox uses the entry API.
- **Full file paths** are never available to a web page, so the playlist stores file names and the player looks
  for them relative to its own folder.
- **Flatpak browsers on Linux** may open the page through a document portal path, where neighbouring files can't
  be read; the page shows a warning. Give the browser access to the folder (for example with Flatseal).

## Testing

There is no test suite. Changes were checked by driving headless Edge (Chrome DevTools Protocol) and headless
Firefox (WebDriver BiDi) with real key, mouse and drag input, reading the player's state from the page.
