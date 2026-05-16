#!/usr/bin/env node
// Baixa ffmpeg + ffprobe + ffplay e yt-dlp.exe para /bin (Windows).
//
// Por defeito usa builds **BtbN no GitHub** (mirror estável); antigo gyan.dev costuma
// falhar ou ficar pendurado em algumas redes.
//
// Prioridade de download:
//   1) curl (curl.exe no Windows) — timeouts, retries, segue redirects (GitHub)
//   2) fetch() do Node — fallback
//
// Variáveis opcionais:
//   FFMPEG_ZIP_URL   — substituir URL do zip do FFmpeg (build Windows 64-bit com ffplay)
//
// Uso:
//   npm run fetch:bin

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BIN = join(ROOT, 'bin');

/** Builds GitHub — mais fiável que gyan.dev para muitos utilizadores. */
const FFMPEG_ZIP_URLS = [
  process.env.FFMPEG_ZIP_URL?.trim() ||
    'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
];

const YTDLP_EXE_URL =
  'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

const MIN_ZIP_BYTES = 512 * 1024;

mkdirSync(BIN, { recursive: true });

function curlBinary() {
  return process.platform === 'win32' ? 'curl.exe' : 'curl';
}

/** @returns {boolean} true se o ficheiro foi gravado com sucesso via curl */
function tryDownloadWithCurl(url, destPath) {
  const curl = curlBinary();
  console.log(`[fetch-binaries] curl ${url}`);
  const result = spawnSync(
    curl,
    [
      '-fSL',
      '--retry',
      '3',
      '--retry-delay',
      '5',
      '--connect-timeout',
      '45',
      '--max-time',
      '1800',
      '-o',
      destPath,
      url,
    ],
    { stdio: 'inherit' },
  );

  if (result.error) {
    console.warn('[fetch-binaries] curl não disponível:', result.error.message);
    return false;
  }
  if (result.status !== 0) {
    console.warn(`[fetch-binaries] curl terminou com código ${result.status}`);
    return false;
  }
  return true;
}

async function downloadWithFetch(url, destPath) {
  console.log(`[fetch-binaries] fetch() ${url}`);
  const controller = new AbortController();
  const timeoutMs = 30 * 60 * 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }
    await pipeline(res.body, createWriteStream(destPath));
  } finally {
    clearTimeout(timer);
  }
}

async function download(url, destPath) {
  rmSync(destPath, { force: true });
  const ok = tryDownloadWithCurl(url, destPath);
  if (!ok) await downloadWithFetch(url, destPath);

  const size = statSync(destPath).size;
  console.log(`[fetch-binaries] gravado ${destPath} (${size} bytes)`);
  return size;
}

function validateZip(path) {
  const size = statSync(path).size;
  if (size < MIN_ZIP_BYTES) {
    throw new Error(
      `Ficheiro demasiado pequeno (${size} bytes) — download incompleto ou URL errada.`,
    );
  }
}

function extractZipWithPowerShell(zipPath, destDir) {
  console.log(`[fetch-binaries] a extrair ${zipPath} -> ${destDir}`);
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`,
    ],
    { stdio: 'inherit' },
  );
}

/**
 * Localiza o diretório que contém ffmpeg.exe (estruturas variam entre pacotes ZIP).
 */
function findExeDirectory(rootDir, exeName) {
  /** @type {string | null} */
  let found = null;

  function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.toLowerCase() === exeName.toLowerCase()) found = dir;
    }
  }

  walk(rootDir);
  return found;
}

async function fetchFFmpeg() {
  /** @type {Error | null} */
  let lastErr = null;

  for (const url of FFMPEG_ZIP_URLS) {
    const id = randomUUID().slice(0, 8);
    const tmpZip = join(BIN, `_ffmpeg_dl_${id}.zip`);
    const tmpDir = join(BIN, `_ffmpeg_extract_${id}`);

    try {
      await download(url, tmpZip);
      validateZip(tmpZip);
      extractZipWithPowerShell(tmpZip, tmpDir);

      const binDir = findExeDirectory(tmpDir, 'ffmpeg.exe');
      if (!binDir) {
        throw new Error('ffmpeg.exe não encontrado dentro do ZIP extraído.');
      }

      for (const exe of ['ffmpeg.exe', 'ffprobe.exe', 'ffplay.exe']) {
        const src = join(binDir, exe);
        const dst = join(BIN, exe);
        if (!existsSync(src)) {
          throw new Error(`Não encontrei ${exe} em ${binDir}`);
        }
        rmSync(dst, { force: true });
        renameSync(src, dst);
        console.log(`[fetch-binaries] OK ${dst}`);
      }

      safeRemove(tmpZip);
      safeRemoveDir(tmpDir);
      return;
    } catch (err) {
      lastErr = /** @type {Error} */ (err);
      console.warn(`[fetch-binaries] falhou este mirror: ${lastErr.message}`);
      safeRemoveDir(tmpDir);
      safeRemove(tmpZip);
    }
  }

  throw lastErr ?? new Error('Nenhuma URL de FFmpeg funcionou.');
}

/** Evita EBUSY em Windows quando outro processo (AV, IDE) mantém o ficheiro aberto. */
function safeRemove(filePath) {
  try {
    rmSync(filePath, { force: true });
  } catch {
    console.warn(`[fetch-binaries] não foi possível apagar ${filePath} (pode apagar manualmente).`);
  }
}

function safeRemoveDir(dirPath) {
  try {
    rmSync(dirPath, { recursive: true, force: true });
  } catch {
    console.warn(`[fetch-binaries] não foi possível apagar pasta ${dirPath}`);
  }
}

async function fetchYtDlp() {
  const dst = join(BIN, 'yt-dlp.exe');
  const partial = join(BIN, `_yt-dlp_${randomUUID().slice(0, 8)}.part`);
  await download(YTDLP_EXE_URL, partial);
  const size = statSync(partial).size;
  if (size < 1024) {
    safeRemove(partial);
    throw new Error('yt-dlp.exe parece incompleto.');
  }
  safeRemove(dst);
  renameSync(partial, dst);
  console.log(`[fetch-binaries] OK ${dst}`);
}

async function main() {
  if (process.platform !== 'win32') {
    console.warn(
      '[fetch-binaries] AVISO: este projeto destina-se a Windows. A baixar os .exe na mesma.',
    );
  }
  await fetchFFmpeg();
  await fetchYtDlp();
  console.log('[fetch-binaries] tudo pronto.');
}

main().catch((err) => {
  console.error('[fetch-binaries] FALHOU:', err);
  console.error(`
Se continuar a falhar na rede corporativa ou firewall:

  1. Abra https://github.com/BtbN/FFmpeg-Builds/releases/latest
     e descarregue o ZIP **win64 gpl** (ex.: ffmpeg-master-latest-win64-gpl.zip).

  2. Extraia e copie para esta pasta do projeto **apenas**:
       ffmpeg.exe  ffprobe.exe  ffplay.exe

  3. yt-dlp: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
     → copie yt-dlp.exe para a pasta bin/

Ou defina uma URL manualmente:

  set FFMPEG_ZIP_URL=https://...
  npm run fetch:bin
`);
  process.exit(1);
});
