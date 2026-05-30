## Personal Soundboard Player v0.8.2

### Layout Stage — Phase D

- **Default layout area per clip** — video clips can store a preferred stage area (`default_layout_area_id`).
- **Dashboard metadata editor** and **full clip editor** include a **Default layout area** field.
- Main **▶** on the dashboard resolves: clip default → orientation mapping → first registered area.
- Clearing a layout area removes it from clips that referenced it.

### Clip editor — preview & trim

- **Loop preview by default** — preview repeats until **Stop preview** (no checkbox).
- **Playhead** on video timeline and audio waveform during preview.
- **Live frame scrub** while dragging start/end handles, with or without preview playing.
- **Smoother scrub** via `requestAnimationFrame`; drag continues reliably (document-level pointer capture).
- **Text cursor (I-beam)** on trim handles for precise clicks.
- **Native video controls hidden** in the preview player.
- **Preview / Stop** button moved above the volume slider.
- **Volume slider applies to preview** playback in real time (audio and video).

### Dashboard & edit page

- Clip menu **Edit ▸** submenu: **Edit metadata** and **Full editor**.
- **Delete clip** from the full editor page (with confirmation modal).
- Metadata modal: **Default layout area** for video clips.

### Docs

- [overlay-layout-stage.md](./overlay-layout-stage.md) — Phase C/D status updated.
- [browser-source-setup.md](./browser-source-setup.md) — stage mode recommended; legacy modes noted.

### Upgrade from v0.8.1

Install over v0.8.1. Existing clips keep working; optional per-clip layout defaults apply only when you set them. Refresh the dashboard after updating if it was already open.
