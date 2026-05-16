# backend

Servidor Express + TypeScript que persiste em SQLite (`better-sqlite3`), invoca `yt-dlp` e FFmpeg, e dispara reprodução de áudio local via `ffplay.exe`.

## Scripts

```bash
npm run dev        # tsx watch (recarrega ao editar)
npm run build      # tsc -> dist/
npm start          # node dist/index.js
npm run typecheck  # apenas verificação de tipos
```

## Caminhos

- `bin/` da raiz é resolvido em `src/config/paths.ts`.
- Dados do utilizador em `%APPDATA%/LocalSoundboardServer/`.
- Logs em `%APPDATA%/LocalSoundboardServer/logs/latest.log` (truncado a cada arranque).

Detalhes na §11 e §12 da especificação.
