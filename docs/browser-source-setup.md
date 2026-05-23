# Browser source setup (OBS Studio & Streamlabs)

Video clips from Personal Soundboard Player play on a **transparent web overlay**, not through local `ffplay`. Add that page as a **Browser Source** in OBS Studio or Streamlabs Desktop, then trigger clips from the dashboard.

## Overlay URL

| Environment | URL |
| --- | --- |
| Development (`npm run dev`) | `http://localhost:5173/overlay/browser` |
| Production / installed app | `http://localhost:3847/overlay/browser` |
| Another device on your LAN | `http://<streaming-PC-IP>:3847/overlay/browser` |

Use the same machine and port as the soundboard backend. In development, the Vite dev server (port **5173**) proxies API calls to the backend.

The overlay listens for play events over SSE. When you click a **video** clip on the dashboard, the clip fades in, plays, and fades out before the file ends.

---

## OBS Studio

1. Open **OBS Studio** and select the scene where the overlay should appear.
2. In **Sources**, click **+** (Add).
3. Choose **Browser**.
4. Name the source (e.g. `Soundboard overlay`) and click **OK**.
5. In **URL**, paste the overlay URL from the table above (e.g. `http://localhost:3847/overlay/browser`).
6. Set **Width** and **Height** to your canvas size (e.g. **1920** × **1080**).
7. Recommended:
   - **Refresh browser when scene becomes active** — helps if the SSE connection idled.
   - Leave **Shutdown source when not visible** off while testing so the connection stays warm.
8. Click **OK**.
9. Position and resize the source on the canvas if needed. The page background is transparent; the video uses `object-fit: cover` to fill the source box.

### If the overlay stays black

- Confirm the URL opens in a normal browser and shows a blank/transparent page (in dev, a small `connected` label may appear in the corner).
- Avoid setting a custom **CSS** background color on the Browser source unless you want a solid backdrop.
- Reload the source: right-click the source → **Interact** is optional; **Refresh** from the source properties works too.

### Test

1. Start the soundboard (`npm run dev`, `npm start`, or the installed tray app → **Open in Browser**).
2. Add the browser source with the correct URL.
3. Create a **video** clip, save it, and click its card on the dashboard.
4. The clip should appear in OBS and fade out near the end.

---

## Streamlabs Desktop

1. Open **Streamlabs Desktop** and select your scene.
2. In **Sources**, click **+** (Add Source).
3. Select **Browser Source** (under Standard or similar, depending on version).
4. Paste the overlay URL (e.g. `http://localhost:3847/overlay/browser`).
5. Set **Width** and **Height** to match your output (e.g. 1920 × 1080).
6. Enable **Refresh browser when scene becomes active** if available.
7. Click **Done** / **Confirm** and place the source on the canvas.

Streamlabs uses the same browser engine idea as OBS: one persistent Browser Source pointing at the overlay URL is enough for all video clips.

### Test

Same as OBS: run the app, add the source, play a video clip from the dashboard.

---

## Audio vs video clips

| Clip type | Playback |
| --- | --- |
| **Audio** | Local `ffplay` on the streaming PC (volume from clip settings). |
| **Video** | Browser overlay in OBS / Streamlabs (triggered via dashboard). |

---

## Related docs

- [README.md](../README.md) — project overview
- [next-release.md](./next-release.md) — release checklist and API notes
