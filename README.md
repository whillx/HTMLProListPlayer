# ProList Player

A simple, reliable HTML player for presentation videos. Open `player.html` from a local folder in Edge, Chrome
or Firefox; no server or install needed.

## How it works

- Put `player.html` (with its `js` and `css` folders) next to your videos, or one folder above them.
- Add videos by dragging them onto the player, or with **Videos → Import**. The playlist is saved in the browser
  and stores only file names; videos are found in the player's folder or one subfolder below it.
- Missing videos can be found with **Locate folder…** or **Locate files…**.
- **Playlist → Export** saves `playlist.js`. A `playlist.js` next to the player is offered for import when the
  playlist is empty.

Each clip has one of three modes:

| Mode | At the end of the clip |
|---|---|
| Loop (default) | Repeats until you press → |
| Once | Holds the last frame |
| Trans | Moves on to the next clip by itself |

Switching clips never shows a black frame: the old picture stays on screen until the new clip's first frame is drawn.

## Keys

| Key | Action |
|---|---|
| → / PageDown | Next clip (starts the first clip when it is ready) |
| ← / PageUp | Previous clip, skipping Trans clips |
| Space | Pause / resume |
| < / > | Back / forward 3 seconds |
| F | Fullscreen |
| Esc | Exit fullscreen |

Presentation clickers usually send PageDown / PageUp, so they work too. Paused stays paused when changing clips.
