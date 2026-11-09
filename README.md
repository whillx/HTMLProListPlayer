# ProList Player

A simple HTML player for presentation videos. It plays a list of local video clips like slides: each clip loops,
plays once, or moves on by itself, and you step through them with the arrow keys or a presentation clicker.
No server or install: open `player.html` in Edge, Chrome or Firefox.

## Try the demo

1. Download or clone this repository.
2. Open `player.html` in your browser.
3. Click **Import** when it offers the `playlist.js` it found.
4. Press **F** for fullscreen, then **→** to start.

The four demo clips show the three clip modes: Slide 1 loops, the transition moves on by itself, Slide 2 loops,
and The End plays once and holds its last frame.

## Use your own videos

1. Put `player.html` (with its `js` and `css` folders) in the folder with your videos. Videos one folder below
   also work.
2. Drag your videos onto the player, or use **Videos → Import**.
3. Set each clip's mode with its icons: Loop, Once or Trans.

The playlist is saved in the browser. **Playlist → Export** saves it as `playlist.js`, which the player offers to
import when its playlist is empty. If a video can't be found, use **Locate folder…** or **Locate files…**.

## Keys

| Key | Action |
|---|---|
| → / PageDown | Next clip (starts the first clip when it is ready) |
| ← / PageUp | Previous clip, skipping Trans clips |
| Space | Pause / resume |
| < / > | Back / forward 3 seconds |
| F | Fullscreen |
| Esc | Exit fullscreen |

Presentation clickers usually send PageDown / PageUp, so they work too.

## More

- [docs/behavior.md](docs/behavior.md): exactly what each key, button and clip mode does.
- [docs/architecture.md](docs/architecture.md): how the code is organized, and the browser quirks it works around.
