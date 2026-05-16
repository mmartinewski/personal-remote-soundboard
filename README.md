# Personal Clip Player

Local soundboard for creating and playing audio clips extracted from YouTube. The server runs on the streaming machine and plays audio through `ffplay`; the web UI can be used on the same PC or from a phone/tablet on the same network.

## Main Features

- YouTube audio prefetch with `yt-dlp`.
- Clip trimming with waveform handles for start/end selection.
- Automatic audio normalization in previews and saved MP3 files.
- Per-clip volume with playback boost up to 300%.
- Suggested YouTube thumbnail with 1:1 crop and zoom.
- Live-control dashboard: sticky search, large cards, remote play, favorites, edit, and delete.
- Local persistence in SQLite (`better-sqlite3`).

## Requirements

- Windows.
- Node.js `>=20` (Node LTS recommended).
- Local binaries in `bin/`: `ffmpeg.exe`, `ffprobe.exe`, `ffplay.exe`, and `yt-dlp.exe`.

User data is stored outside the repository in `%APPDATA%/LocalSoundboardServer/`.

## Setup

```bash
npm install
npm run fetch:bin
```

`npm run fetch:bin` downloads the required executables into `bin/`. They are ignored by Git; see [`bin/README.md`](bin/README.md) for manual installation if the automatic download fails.

## Development

```bash
npm run dev
```

- Frontend Vite: `http://localhost:5173`
- Backend Express: `http://localhost:3847`
- To use a phone, open the network URL shown by Vite and keep the backend running on the streaming PC.

## Local Production

```bash
npm run build
npm start
```

After the build, Express serves the static frontend from `frontend/dist/`.

## Configuration

Optionally copy `config/config.example.json` to `config/config.json` to adjust the port:

```json
{
  "port": 3847
}
```

`config/config.json` is ignored by Git.

## Structure

```text
backend/    API Express, SQLite, FFmpeg/ffplay, yt-dlp
frontend/   React + Vite + Tailwind
bin/        unversioned local executables
config/     configuration example
docs/       technical specification
scripts/    project utilities
```

## GitHub Notes

- Do not commit `node_modules/`, `dist/`, `bin/*.exe`, `config/config.json`, or `.env` files.
- The SQLite database, media, and logs are created in `%APPDATA%/LocalSoundboardServer/`, outside the repository.
