# bin/

This folder hosts the Windows executables the application invokes at runtime:

- `ffmpeg.exe`
- `ffprobe.exe`
- `ffplay.exe`
- `yt-dlp.exe`

These files are **not versioned** (see `.gitignore`). To get them, run this from the repository root:

```bash
npm run fetch:bin
```

By default, the script uses **BtbN builds on GitHub** (win64 GPL ZIP with `ffplay`) and **`curl`** on Windows when available. This usually works better than the older `gyan.dev` mirror.

### If the automatic download fails

1. Open [**BtbN / FFmpeg-Builds - Latest**](https://github.com/BtbN/FFmpeg-Builds/releases/latest) and download the **win64 GPL** ZIP. A typical file name is `ffmpeg-master-latest-win64-gpl.zip`.
2. Extract it and copy only these files into **this folder**: `ffmpeg.exe`, `ffprobe.exe`, `ffplay.exe`.
3. **yt-dlp:**  
   https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe  
   Copy `yt-dlp.exe` into **this folder**.

Alternatively, force a URL in PowerShell before running the script:

```powershell
$env:FFMPEG_ZIP_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
npm run fetch:bin
```

> The backend resolves these paths through `backend/src/config/paths.ts`. Do not rely on the global `PATH`.
