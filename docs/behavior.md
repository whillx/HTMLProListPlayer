# Behavior

The rules the player follows. When changing the code, keep to these.

## Clip modes

Each clip has exactly one mode:

| Mode | At the end of the clip |
|---|---|
| Loop (default) | Repeats until you move on. |
| Once | Plays once and holds its last frame. This is not a real pause: → moves on and plays the next clip. |
| Trans | Moves on to the next clip by itself. |

## Ready, playing and paused

- **Ready** exists only for the first clip of the playlist: it is shown on its first frame and the status reads
  "Ready — press → to play". → starts it. The first clip is Ready at startup, after the back-to-start button,
  after ← brings you back to it, after clicking it in the playlist, and when it is paused and moved back to its
  first frame (seek bar or `<`).
- **Paused** is always respected. A paused clip stays paused when you seek, and changing clips while paused shows
  the new clip on its first frame, still paused. Space resumes. Clicking any clip other than the first in the
  playlist shows it paused.
- **Playing**: changing clips plays the new clip.

## Keys

| Key | Action |
|---|---|
| → / PageDown | Next clip. Starts the first clip when it is Ready. During a Trans clip, skips the rest of it. While paused, shows the next clip paused. |
| ← / PageUp | Previous clip, skipping Trans clips; paused stays paused. On the first clip (or with only Trans clips before it): the first clip's first frame, Ready. |
| Space | Pause / resume. |
| `<` / `>` (also `,` / `.`) | Back / forward 3 seconds in the current clip. Stops at the first or last frame, never moving to another clip. |
| F | Toggle fullscreen. |
| Esc | Exit fullscreen. |

## Buttons and controls

- **Back-to-start**: first clip, first frame, Ready.
- **Previous / next**: like ← / →, but they never start the first clip when it is Ready; they move instead.
- **Play / pause**: like Space.
- **Seek bar**: moves within the current clip without changing play / pause. Like `>`, it stops just short of
  the end, so a Trans clip is not moved on by a seek.
- **Volume and mute**: remembered between visits.
- **Fullscreen**: the button, F, or double-clicking the video. In fullscreen the control bar shows only while the
  mouse is over the bottom of the picture (and stays shown while dragging the seek bar).

## Playlist

- Drag videos onto the playlist to insert them where you drop (a blue line marks the spot), or onto the video
  to add them at the end.
- Reorder by dragging a clip's thumbnail. Tick the boxes to change the mode of, or delete, several clips at once.
- The playlist is stored in the browser (localStorage) and holds only file names. A video is found in the
  player's folder or one subfolder below it (subfolder names are learned when you drop or pick a folder); the
  first match wins. Otherwise it plays from the file you gave until the page closes.
- **Export** writes `playlist.js`. With an empty playlist, a `playlist.js` next to `player.html` is offered for
  import.
