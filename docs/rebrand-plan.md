# Rebrand plan — Stream Media Board

**Status:** applied in **v0.9.0** (display name + npm + docs + installer).  
**GitHub rename:** set repository name to `stream-media-board` in GitHub Settings (redirect from `personal-remote-soundboard` is automatic).

## Chosen identity

| Camada | Valor |
| --- | --- |
| **Display name** | Stream Media Board |
| **GitHub repo** | `stream-media-board` |
| **npm `name`** | `stream-media-board` |
| **Tagline** | LAN clip dashboard + browser overlay for streaming |

**Kept for compatibility:** `appId`, `%APPDATA%/LocalSoundboardServer/`, `soundboard://` protocol.

---

## Original analysis (archived)

Estado antes do rebrand (v0.8.3): três identidades diferentes conviviam no mesmo projeto.

| Camada | Valor atual |
| --- | --- |
| Pasta local | `personal-clip-player` |
| Repositório GitHub | `personal-remote-soundboard` |
| npm / `package.json` `name` | `personal-soundboard-player` |
| Instalador / tray / Electron | **Personal Soundboard Player** |
| `<title>` da UI web | Personal Clip Player |
| Dados do usuário | `%APPDATA%/LocalSoundboardServer/` |
| Protocolo deep link | `soundboard://youtube-login` |
| `appId` (electron-builder) | `com.mmartinewski.personal-soundboard-player` |

O produto real hoje: **dashboard LAN + browser overlay OBS/Streamlabs** (áudio + vídeo, trim, layout stage, layout areas). O README ainda abre falando de ffplay local como foco principal.

---

## 3 opções de nome (recomendadas)

### Opção A — **OBS Clip Stage** (recomendada)

| | |
| --- | --- |
| **Display name** | OBS Clip Stage |
| **Slug GitHub** | `obs-clip-stage` |
| **npm** | `obs-clip-stage` |

**Prós**

- Alinha com o diferencial recente (`?mode=stage`, layout areas).
- **OBS** no nome melhora busca no GitHub (“obs clips”, “obs overlay”).
- Curto, memorável, único o suficiente.
- “Stage” comunica vídeo posicionado no canvas, não só soundboard.

**Contras**

- Nome não menciona áudio explicitamente (mas áudio continua no produto).
- “OBS” no nome pode sugerir afiliação oficial (não é plugin oficial da OBS Project — deixar claro no README: *unofficial, works with OBS Studio & Streamlabs*).

---

### Opção B — **Stream Clip Board**

| | |
| --- | --- |
| **Display name** | Stream Clip Board |
| **Slug GitHub** | `stream-clip-board` |
| **npm** | `stream-clip-board` |

**Prós**

- Genérico o bastante para OBS, Streamlabs, futuro XSplit, etc.
- “Clip board” remete a painel de clipes (áudio + vídeo).
- Boa busca: “stream clips”, “clip board streaming”.

**Contras**

- Menos específico que “Stage” para o layout visual.
- Pode confundir com “clipboard” (área de transferência) em buscas em inglês.
- Não destaca browser source / overlay.

---

### Opção C — **OBS Media Clips**

| | |
| --- | --- |
| **Display name** | OBS Media Clips |
| **Slug GitHub** | `obs-media-clips` |
| **npm** | `obs-media-clips` |

**Prós**

- Deixa claro: clipes de mídia (áudio **e** vídeo).
- SEO forte para quem procura ferramenta OBS + clips.
- Nome conservador, fácil de explicar.

**Contras**

- Não comunica dashboard LAN nem layout stage.
- Soa mais utilitário, menos “produto”.

---

## Recomendação

**Opção A — OBS Clip Stage** para display + repo, se você quer destacar o que ninguém mais tem (stage + áreas).  
**Opção C — OBS Media Clips** se preferir máxima clareza para novatos (“é um app de clipes pro OBS”).

Decidir **uma** opção antes de renomear o repo (GitHub não gosta de rename em cadeia).

---

## O que mudar vs. o que manter (v0.9 rebrand)

### Mudar na primeira leva (baixo risco)

| Item | Onde |
| --- | --- |
| Nome do repositório GitHub | Settings → Rename (redirect automático do URL antigo) |
| `repository.url` | `package.json` |
| `productName`, `shortcutName`, protocol `name` | `package.json` → `build` |
| `description` npm | `package.json` |
| `name` npm | `package.json`, `package-lock.json` |
| Título README + lead paragraph | `README.md` |
| `<title>` | `frontend/index.html` |
| `APP_NAME` tray / diálogos | `desktop/main.cjs` |
| Textos “Personal Soundboard Player” | `docs/browser-source-setup.md`, `scripts/publish-release.mjs` (default notes) |
| Links `github.com/.../personal-remote-soundboard` | docs de release (opcional: deixar histórico ou atualizar) |
| GitHub **Topics** | `obs`, `obs-studio`, `streamlabs`, `browser-source`, `streaming`, `youtube`, `clips`, `overlay` |
| Descrição curta do repo | GitHub UI |

### Manter na v0.9 (compatibilidade de upgrade)

| Item | Motivo |
| --- | --- |
| `appId` | Instalação “in place” no Windows; novo id = app paralelo |
| `%APPDATA%/LocalSoundboardServer/` | DB, mídia e cookies existentes |
| `soundboard://` protocol | Deep links já registrados no SO após instalar |
| Release notes v0.4–v0.8 | Histórico; só o título no topo pode ficar legado |

Migrar `appId`, pasta AppData e protocolo na **v1.0** com script de migração (copiar DB + registrar novo protocolo).

### Pasta local `personal-clip-player`

Opcional; só afeta sua máquina. Renomear quando quiser + `git remote` já apontando pro novo repo.

---

## Lista exata de arquivos a alterar

### Críticos (branding visível / build)

| Arquivo | O que alterar |
| --- | --- |
| `package.json` | `name`, `description`, `repository.url`, `build.productName`, `build.appId` (se decidir), `build.nsis.shortcutName`, `build.protocols` |
| `package-lock.json` | `name` (root + workspaces) — regenerar com `npm install` após mudar `package.json` |
| `frontend/package.json` | `name` (se usar escopo `@app/frontend`, pode manter) |
| `backend/package.json` | idem |
| `frontend/index.html` | `<title>` |
| `desktop/main.cjs` | `APP_NAME`, opcionalmente `APP_FOLDER_NAME`, protocolo `soundboard` |
| `desktop/youtube-auth.cjs` | comentário cookie header |
| `backend/src/config/paths.ts` | `APP_FOLDER_NAME` (se migrar AppData) |
| `scripts/publish-release.mjs` | fallback `productName`, template default release notes |

### Documentação

| Arquivo | O que alterar |
| --- | --- |
| `README.md` | Título, intro (OBS-first), paths instalador, descrição geral |
| `docs/browser-source-setup.md` | Nome do produto, “soundboard” onde for genérico |
| `docs/next-release.md` | Nome instalador, checklist |
| `docs/technical-specification.md` | Título e escopo (streaming overlay) |
| `docs/overlay-layout-stage.md` | Menções ao nome (se houver) |
| `docs/release-notes-v0.8.3.md` | Só se quiser padronizar título “OBS Clip Stage v0.9.0” daqui pra frente |
| `docs/release-notes-v0.4.0.md` … `v0.8.2.md` | **Opcional** — histórico; links GitHub antigos ainda redirecionam |
| `backend/README.md` | AppData path label |

### UI (texto usuário)

| Arquivo | O que alterar |
| --- | --- |
| `frontend/src/pages/ClipFormPage.tsx` | “Audio (soundboard)”, instruções overlay, `soundboard://` link (se protocolo mudar) |

### Não precisa mudar (uso técnico de “soundboard”)

| Arquivo | Nota |
| --- | --- |
| `frontend/src/pages/ClipFormPage.tsx` | `?mode=audio` descrito como “soundboard” no OBS — termo correto no ecossistema |
| `docs/*.md` | Referências a “modo soundboard” / `?mode=audio` podem permanecer |
| `README.md` | Tabela de modos pode manter coluna “soundboard” para áudio |

### Fora do repo

| Ação | Onde |
| --- | --- |
| Renomear repositório | GitHub → Settings |
| Adicionar topics | GitHub → About |
| `git remote set-url origin …` | máquina local |
| Nova release v0.9.0 | “Rebrand” nos release notes |
| Atualizar clone/worktree paths | opcional |

---

## Ordem sugerida de execução

1. Escolher **Opção A, B ou C** (display name + slug).
2. Renomear repo no GitHub → atualizar `git remote`.
3. PR/commit: `package.json`, `README.md`, `index.html`, `desktop/main.cjs`, `publish-release.mjs`, docs principais.
4. Release **v0.9.0** com instalador novo nome + nota “same AppData folder, upgrades from 0.8.x”.
5. GitHub Topics + descrição.
6. (v1.0) Migração AppData + `appId` + protocolo, se desejado.

---

## Descrição sugerida (GitHub About)

> Unofficial OBS/Streamlabs companion: trim YouTube audio & video clips, control playback from a LAN dashboard, and display them on a transparent browser overlay with configurable layout areas (stage mode).

---

## Próximo passo

Confirmar qual opção (A, B ou C) — ou variante — e abrir issue/PR de rebrand v0.9.0.
