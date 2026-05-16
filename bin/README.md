# bin/

Esta pasta hospeda os executáveis Windows que a aplicação invoca em runtime:

- `ffmpeg.exe`
- `ffprobe.exe`
- `ffplay.exe`
- `yt-dlp.exe`

Os ficheiros **não são versionados** (ver `.gitignore`). Para os obter, na raiz do repositório:

```bash
npm run fetch:bin
```

O script usa por defeito **builds BtbN no GitHub** (ZIP win64 GPL com `ffplay`) e **`curl`** no Windows quando existe — costuma funcionar melhor que o mirror antigo `gyan.dev`.

### Se o download automático falhar

1. Abra [**BtbN / FFmpeg-Builds — Latest**](https://github.com/BtbN/FFmpeg-Builds/releases/latest) e descarregue o ZIP **win64 GPL** (nome típico: `ffmpeg-master-latest-win64-gpl.zip`).
2. Extraia e copie para **esta pasta** apenas: `ffmpeg.exe`, `ffprobe.exe`, `ffplay.exe`.
3. **yt-dlp:**  
   https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe  
   → copie `yt-dlp.exe` para **esta pasta**.

Ou force uma URL no PowerShell antes de correr o script:

```powershell
$env:FFMPEG_ZIP_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
npm run fetch:bin
```

> O backend resolve estes caminhos via `backend/src/config/paths.ts`. Não dependa do `PATH` global.
