# Personal Clip Player

Soundboard local para criar e tocar clipes de áudio extraídos do YouTube. O servidor roda na máquina da live e dispara o áudio via `ffplay`; a interface web pode ser usada no próprio PC ou por um celular/tablet na mesma rede.

## Principais recursos

- Prefetch de áudio do YouTube com `yt-dlp`.
- Corte de clipes com waveform e alças de início/fim.
- Normalização automática do áudio no preview e no MP3 salvo.
- Volume por clipe, com reforço até 300% na reprodução.
- Thumbnail sugerida do YouTube com crop 1:1 e zoom.
- Dashboard estilo controle ao vivo: busca fixa, cards grandes, play remoto, favoritos, edição e exclusão.
- Persistência local em SQLite (`better-sqlite3`).

## Requisitos

- Windows.
- Node.js `>=20` (Node LTS recomendado).
- Binários locais em `bin/`: `ffmpeg.exe`, `ffprobe.exe`, `ffplay.exe` e `yt-dlp.exe`.

Os dados do usuário ficam fora do repositório, em `%APPDATA%/LocalSoundboardServer/`.

## Setup

```bash
npm install
npm run fetch:bin
```

`npm run fetch:bin` baixa os executáveis necessários para `bin/`. Eles são ignorados pelo Git; veja [`bin/README.md`](bin/README.md) para instalação manual se o download automático falhar.

## Desenvolvimento

```bash
npm run dev
```

- Frontend Vite: `http://localhost:5173`
- Backend Express: `http://localhost:3847`
- Para acessar pelo celular, abra a URL de rede exibida pelo Vite e mantenha o backend rodando no PC da live.

## Produção local

```bash
npm run build
npm start
```

Após o build, o Express serve o frontend estático de `frontend/dist/`.

## Configuração

Opcionalmente copie `config/config.example.json` para `config/config.json` para ajustar a porta:

```json
{
  "port": 3847
}
```

`config/config.json` é ignorado pelo Git.

## Estrutura

```text
backend/    API Express, SQLite, FFmpeg/ffplay, yt-dlp
frontend/   React + Vite + Tailwind
bin/        executáveis locais não versionados
config/     exemplo de configuração
docs/       especificação técnica original
scripts/    utilitários do projeto
```

## Observações para GitHub

- Não versionar `node_modules/`, `dist/`, `bin/*.exe`, `config/config.json` ou arquivos `.env`.
- O banco SQLite, mídias e logs são criados em `%APPDATA%/LocalSoundboardServer/`, fora do repositório.
