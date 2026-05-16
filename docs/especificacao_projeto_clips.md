# Especificação Técnica de Requisitos: Sistema de Soundboard e Clipes do YouTube

Esta documentação serve como especificação completa, determinística e não-destrutiva para a implementação de uma aplicação web local em Node.js. O objetivo do sistema é cadastrar vídeos do YouTube, extrair um trecho de áudio, salvar os metadados e arquivos de mídia localmente e permitir a reprodução do áudio **diretamente na máquina onde o backend roda** por meio de uma interface responsiva controlada remotamente (ex.: um iPad na mesma rede).

O documento foi estruturado de forma a guiar assistentes de IA (como o Cursor) e desenvolvedores na execução exata do projeto.

---

## 1. Stack tecnológica (decisões v1)

As escolhas abaixo são **normativas** para a primeira versão (sem alternativas equivalentes no mesmo código-base).

| Camada | Escolha |
|--------|---------|
| **Backend** | **Node.js** com **Express** |
| **Frontend** | **React** via **Vite** |
| **Estilo / UI** | **Tailwind CSS** + **shadcn/ui** (recomendado) |
| **Ícones** | **Lucide React** |
| **Banco de dados** | **SQLite** com **`better-sqlite3`** (sem ORM obrigatório) |
| **Mídia** | **FFmpeg** / **ffprobe** invocados via **`child_process.execFile`** (sem `fluent-ffmpeg`, pacote abandonado); download com **yt-dlp** (processo filho), binários em `/bin/` |
| **Reprodução no PC host** | **`ffplay.exe`** (já vem no pacote do FFmpeg) invocado via `child_process.spawn`, com `-nodisp -autoexit -volume <0-100>` para aplicar o volume global. Sem dependência adicional. |
| **Linguagem** | **TypeScript** no backend e no frontend (`strict: true`). |

**Empacotamento:** priorizar solução que funcione com `better-sqlite3` (nativo). Pode-se tentar **`pkg`**; se houver bloqueio com addons nativos ou paths, **aceita-se alternativa** (por exemplo executável Node + `node.exe` empacotado, instalador que descompacta o app, ou outro empacotador), desde que o binário final rode no Windows e encontre `ffmpeg`, `ffprobe` e `yt-dlp` nos caminhos definidos.

---

## 2. Arquitetura do sistema e ciclo de vida da mídia

### 2.1 Armazenamento local (`%APPDATA%`)

A aplicação centraliza dados e binários em:

`%APPDATA%/LocalSoundboardServer/`

Sugestão de layout:

* `%APPDATA%/LocalSoundboardServer/database/storage.db` — SQLite  
* `%APPDATA%/LocalSoundboardServer/media/audio/` — arquivos **`.mp3`** (trechos finais)  
* `%APPDATA%/LocalSoundboardServer/media/thumbnails/` — pares original + 1:1  
* `%APPDATA%/LocalSoundboardServer/media/temp/` — arquivos temporários de processamento (áudio em *staging* ligado a `process_id`). **TTL: 7 dias** a contar da criação. Limpeza executada **no arranque da app** e, idealmente, periodicamente enquanto a app corre. Esses ficheiros podem ser apagados antes do TTL se já estiverem ligados a um clipe definitivo gravado.  
* `%APPDATA%/LocalSoundboardServer/logs/` — ver secção de logs  
* Ficheiro de configuração local (ver **§8**) — p. ex. `config.json` no mesmo root ou em subpasta `config/`

### 2.2 Imagem não destrutiva (thumbnail)

Igual à especificação anterior:

1. **Original** (`*_original.jpg/png`) — ficheiro bruto.  
2. **Cortada 1:1** (`*_1x1.jpg/png`) — gerada no backend após crop.  
3. **`thumbnail_crop_meta`** — JSON com coordenadas do crop (ex.: `x`, `y`, `width`, `height` em pixels relativos à original).

**Limite:** ficheiro de thumbnail recebido no multipart ≤ **1 MB**; rejeitar com erro claro se exceder.

### 2.3 Fluxo de áudio no host

O cliente (PC ou iPad) chama a API HTTP; o processo Node no PC dispara o player nativo **no Windows** onde a app está a correr. O volume de reprodução aplicado a esse player segue o **volume global** persistido (ver **§5** e **§6**).

### 2.4 Pipeline YouTube → áudio final (estratégia *audio-first*)

A v1 **não usa o iframe do YouTube** para a seleção do trecho. Como o produto final é áudio, o fluxo trabalha **directamente sobre o áudio** desde o início:

1. **Prefetch de áudio (acionado por botão na criação, automático na edição):**  
   * **Criação:** só é disparado quando o utilizador clica em **Carregar áudio** na Tela 1 (ver **§3.1**). Não há prefetch automático ao colar a URL.  
   * **Edição:** disparado automaticamente ao abrir a Tela 1 com a `youtube_url` gravada do clipe.  
   * O backend invoca `yt-dlp` para baixar **apenas o stream de áudio** (`-x` / `bestaudio`) do vídeo indicado, gravando em `media/temp/<process_id>.<ext>` (ex.: `.m4a`/`.webm`/`.opus`, conforme o que o YouTube oferecer).  
   * `ffprobe` lê a duração total da fonte. Se a duração **> 10 min**, rejeitar com mensagem clara e limpar o ficheiro.  
   * O endpoint devolve `process_id` + duração + URL local (ex.: `/api/staging/<process_id>/audio`) que o browser pode tocar via `<audio>`.  

2. **Selecção do trecho no browser (Tela 1):**  
   * O frontend toca esse ficheiro de áudio local com `<audio>` e renderiza uma **timeline com waveform** usando **`wavesurfer.js`**.  
   * Dois *handles* arrastáveis definem `start_time` e `end_time` com **precisão milissegundos**.  
   * Botões: **Tocar trecho** — *loop* contínuo de `[start, end]` no browser, controlado por **Parar**; **Testar no servidor** — toca uma vez via PC host, com o volume global aplicado.  
   * **Limite duro:** `end - start` **≤ 30 segundos**. UI impede arrastar o handle para fora deste limite e mostra a duração corrente do trecho.  

3. **Corte definitivo (no save):**  
   * Quando o utilizador grava (`POST /api/clips`), o backend usa **FFmpeg** sobre o ficheiro de *staging* (já em disco do passo 1), aplicando `-ss <start>` `-to <end>` e codificando para **MP3** final.  
   * `audio_path` no DB passa a apontar para o ficheiro `.mp3` definitivo em `media/audio/`.  
   * O ficheiro de *staging* mantém-se em `media/temp/` por **7 dias** (para futuras edições) e é então recolhido pela limpeza.  

**Formato final:** **MP3**. Preferir manter a **sample rate da fonte**; se for necessário fixar, usar **48 kHz**. **Bitrate**: alta qualidade sem ser excessivo — recomenda-se **192 kbps CBR** ou **VBR ~190–245 kbps**.

> **Vantagens da estratégia *audio-first*:**  
> * Precisão milissegundo no scrubbing (HTML5 `<audio>` + waveform).  
> * Sem dependência do iframe do YouTube nem da sua API.  
> * Reaproveita o áudio já baixado para o corte final (sem segundo download).  
> * Permite ouvir o resultado **antes** de gravar.

### 2.5 Volume global e teste antes de gravar

* Existe um **volume global de reprodução** (0–100) persistido no host, aplicado a: (1) *play* de teste no servidor a partir do *staging*; (2) reprodução normal dos clipes na soundboard.  
* Na **Tela 1**, depois de o áudio de *staging* existir (passo 1 do pipeline), o utilizador tem:  
  * **Slider de volume global** (lê/grava `app_settings.playback_volume` via API);  
  * Botão **Testar no servidor** (toca o trecho `[start, end]` do *staging* nos altifalantes do PC host com o volume global, **uma única vez**);  
  * Botão **Tocar trecho** (audição local no browser, em **loop contínuo** até o utilizador clicar em **Parar**).

---

## 3. Especificação das telas e interface

### Tema visual (*Night Mode* por defeito)

* **Fundo principal:** grafite / preto fosco (`#121214` ou `#0B0F19`).  
* **Cards / topo:** cinza escuro (`#202024` ou `#1E293B`).  
* **Textos:** primário `#F8FAFC`, secundário `#94A3B8`.  
* **Acentos:** azul / índigo (`#6366F1` ou `#3B82F6`).

### 3.1 Tela 1 — Cadastro e edição

Sequência visual do utilizador:

1. **URL YouTube (input) + botão "Carregar áudio":**  
   * Validação em tempo real (regex de URL válida do YouTube). Enquanto a URL não passar na validação, o botão **Carregar áudio** está desativado.  
   * **Não há prefetch automático.** O download só começa quando o utilizador clica em **Carregar áudio**.  
   * Ao clicar: o frontend chama `POST /api/clips/prefetch` (ver **§6.3**). Estado da UI: spinner com a mensagem `[1/3] A descarregar áudio do YouTube...`. O input de URL e o botão **Carregar áudio** ficam desativados durante o pedido.  
   * Se sucesso: a UI recebe `process_id`, `duration_seconds` e `audio_url` (caminho local servido pelo Express) e revela o trimmer.  
   * Se a duração da fonte > 10 min ou o vídeo for indisponível, mostra erro amigável, mantém os campos editáveis e o botão **Carregar áudio** volta a ficar disponível.  
   * Se o utilizador alterar a URL depois de já ter feito prefetch, a UI deve **invalidar** o `process_id` actual (esconder/limpar trimmer) e exigir novo clique em **Carregar áudio**.  

2. **Trimmer (audio-first, obrigatório v1):**  
   * **Player de áudio HTML5** apontando ao `audio_url` de *staging*.  
   * **Waveform** com **`wavesurfer.js`** (escolha v1) ocupando largura total do trimmer.  
   * **Dois handles arrastáveis** sobre a waveform definindo a janela `[start, end]`.  
   * **Campos numéricos** sincronizados com os handles, no formato único definido em **§6.2** (ex.: `00:00:01.250`). Editar o campo move o handle e vice-versa.  
   * **Indicador de duração** do trecho atual (ex.: `Trecho: 00:00:18.420 — limite 30 s`). Se o utilizador tentar arrastar para fora dos 30 s, o handle é *clamped*.  
   * **Botões:**  
     * `Tocar trecho` — toca a janela `[start, end]` em **loop contínuo** no browser (não envolve o servidor); o utilizador pára manualmente com o botão `Parar` ou alterando os handles.  
     * `Testar no servidor` — chama `POST /api/clips/test-play` com `process_id` + `start` + `end`; toca via altifalantes do PC host com volume global (uma única vez, sem loop).  
     * `Parar` — pára o áudio do browser **e** chama `POST /api/clips/stop` para garantir que nada continua a tocar no servidor.  
   * **Slider de volume global** ao lado do botão de teste; mudanças persistem via `PUT /api/settings`.  

3. **Metadados:** nome (obrigatório), categoria (combobox existente ou nova), tags (chips, separadas por vírgula).  

4. **Thumbnail 1:1:** dropzone (ficheiro local, drag de outra aba do browser, ou URL colada). Crop trancado em **1:1**. Em **edição**, a UI carrega `thumbnail_original_path` e restaura o quadrado de seleção a partir de `thumbnail_crop_meta`. Limite de **1 MB** no ficheiro recebido.  

5. **Botão Guardar:** ao submeter, faz `POST /api/clips` (ou `PUT /api/clips/:id` em edição) em **multipart único** levando **todos** os campos + `process_id` da etapa 1. Backend executa `[2/3] A cortar áudio` e `[3/3] A finalizar metadados`.  

> **Em modo edição**, ao abrir a Tela 1 a aplicação aciona automaticamente um **novo `prefetch`** com a `youtube_url` gravada — sem pedir confirmação ao utilizador, mostrando o spinner `[1/3]` — para que os handles e a waveform sejam restaurados a partir do mesmo áudio. Esta é a única situação na v1 em que o prefetch é automático (no fluxo de criação é sempre acionado pelo botão **Carregar áudio**). Os tempos guardados (`start_time`, `end_time`) preposicionam os handles. **Sempre que se grava (`PUT`), o cliente reenvia `process_id`** (ver **§6.2**).

### 3.2 Tela 2 — Dashboard

Igual ao documento original: pesquisa, toggle Modo Ouvinte / Modo Edição, secção **Favoritos** no topo, restantes categorias por ordem alfabética, cards com *play* server-side, estrela / editar / excluir no modo edição.

**Acessibilidade e atalhos de teclado:** **fora de âmbito na v1.**

---

## 4. Requisitos complementares (determinismo)

### 4.1 Binários `ffmpeg`, `ffprobe`, `yt-dlp`

Incluir em pasta do projeto (ex.: `/bin/`) os `.exe` para Windows; o código deve usar **caminhos relativos ao executável da app** (ou base path configurável), **sem depender** do PATH do sistema.

**Atualização de ferramentas:** **versões fixas** *bundled* no instalador (sem auto-update obrigatório na v1).

### 4.2 Concorrência de áudio

Se um clipe estiver a tocar e o utilizador disparar outro *play* (ou o mesmo), **parar imediatamente** o áudio atual e iniciar o novo. Manter referência global ao processo/player ativo para `stop` / `kill` antes do próximo.

### 4.3 Estados de carregamento (UI)

Exibir etapas **fixas** (não é necessário percentual real nem SSE/WebSocket):

1. `[1/3] A descarregar áudio do YouTube...` — durante o `POST /api/clips/prefetch`.  
2. `[2/3] A cortar o áudio...` — durante o corte FFmpeg disparado por `POST/PUT /api/clips`.  
3. `[3/3] A finalizar metadados...` — gravação no SQLite + thumbnails.  

Os botões correspondentes são desativados enquanto a etapa decorre.

### 4.4 Falhas e validações

* YouTube privado / inexistente: mensagem amigável a partir do erro do `yt-dlp`.  
* **Duração do vídeo de origem ≤ 10 minutos** (`duration_seconds <= 600`). Vídeos com duração superior são rejeitados.  
* **Duração do trecho ≤ 30 segundos** (`end_time - start_time <= 30`). Validar no frontend (UI clamping) e novamente no backend.  
* `end_time` ≤ `start_time`: rejeitar.  
* `start_time < 0` ou `end_time > duration_seconds`: rejeitar.  
* Thumbnail > **1 MB**: rejeitar com mensagem clara.

### 4.5 Rede e segurança (v1)

* O servidor pode escutar em **todas as interfaces** (`0.0.0.0`) para permitir iPad na LAN.  
* **Sem autenticação** na v1 — assume-se **rede confiável**.

---

## 5. Modelagem de dados (SQLite)

### 5.1 Tabelas existentes (`categories`, `clips`)

Manter a estrutura lógica já definida (campos `thumbnail_*`, `audio_path`, `is_favorite`, etc.). Garantir que `audio_path` aponta sempre para **`.mp3`** após a v1. Os campos `start_time` e `end_time` são gravados no formato único `HH:MM:SS.mmm` (ver **§6.2**).

### 5.2 Configuração global de volume

Persistir o volume de reprodução (ex.: inteiro **0–100**). Exemplo:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- Ex.: key = 'playback_volume', value = '75'
```

---

## 6. Contratos de API

### 6.1 `GET /api/clips`

* Query opcional: `?search=texto` — filtra por título, nome de categoria ou tags.  
* Resposta: **JSON** com lista **aninhada por categorias**, com **favoritos tratados primeiro na apresentação** (secção lógica ou *array* dedicado — ver estrutura abaixo).

**Formato sugerido (normativo):**

```json
{
  "sections": [
    {
      "type": "favorites",
      "title": "Favoritos",
      "clips": [ { "id": 1, "title": "...", "category": { "id": 2, "name": "..." }, "tags": "a,b", "thumbnail_cropped_url": "/media/...", "is_favorite": 1, "created_at": "..." } ]
    },
    {
      "type": "category",
      "category": { "id": 3, "name": "Memes" },
      "clips": [ ]
    }
  ],
  "playback_volume": 75
}
```

* **`sections`:** ordem: primeiro bloco `type: "favorites"` (pode vir `clips: []` se vazio — UI trata conforme **§3.2**); a seguir categorias **por ordem alfabética** do nome. Cada clipe deve expor apenas o necessário à listagem; URLs de thumbnails podem ser rotas estáticas servidas pelo Express.  
* **`playback_volume`:** valor atual (0–100) para o *slider* global.

(Alternativa equivalente: `favorites: { clips: [] }` + `categories: [{ category, clips }]`, desde que a ordem e o conteúdo sejam os mesmos.)

### 6.2 `POST /api/clips` e `PUT /api/clips/:id`

**Content-Type:** `multipart/form-data`.

**Formato único de tempos** (decisão v1) — usado em **toda** a API, base de dados, UI e parâmetros para FFmpeg:

> **`HH:MM:SS.mmm`** (string), com horas/minutos/segundos sempre com 2 dígitos e milissegundos com **3** dígitos. Exemplos: `00:00:00.000`, `00:00:01.250`, `00:09:59.999`. A conversão para segundos como número (necessária para o HTML5 `<audio>` ou para o `-ss`/`-to` do FFmpeg) é detalhe de implementação no cliente/servidor, **não** é uma segunda forma do contrato.

Campos (nomes **normativos**):

| Campo | Tipo | Obrig. | Descrição |
|-------|------|--------|-----------|
| `youtube_url` | string | sim | URL original do vídeo. Em `PUT`, deve ser sempre enviada (idêntica à anterior se não mudou). |
| `start_time` | string | sim | Início do trecho no formato `HH:MM:SS.mmm`. |
| `end_time` | string | sim | Fim do trecho no formato `HH:MM:SS.mmm`. |
| `title` | string | sim | Nome do clipe. |
| `category` | string | sim | Nome da categoria; se não existir, **criar** categoria com esse nome. |
| `tags` | string | não | Lista separada por **vírgulas** (normalizar espaços no servidor). |
| `thumbnail` | file | sim no create; opcional no `PUT` (se ausente, manter a existente) | Imagem para crop (≤ 1 MB). |
| `thumbnail_crop_meta` | string (JSON UTF-8) | não | Coordenadas do crop na imagem original. Ex.: `{"x":0,"y":0,"width":512,"height":512}`. Se omitido na criação, backend usa centrado por defeito. |
| `process_id` | string | **sim sempre** | Liga o registo ao áudio de *staging* baixado pelo `prefetch`. **Em `PUT` é obrigatório reenviar**, mesmo que o vídeo/tempos não mudem (a UI obtém um `process_id` válido ao abrir a edição, ver **§3.1**). |
| `is_favorite` | string `"0"` / `"1"` | não | Default `0`. |

**Encoding:** ficheiros em multipart padrão; **metadados de crop** como **string JSON UTF-8** no campo texto `thumbnail_crop_meta`.

**`PUT /api/clips/:id`:** se nova `thumbnail` for enviada, substituir o par original/1:1; se `process_id` apontar para áudio diferente do anterior, substituir `audio_path` (apagando o `.mp3` antigo); se for o mesmo `process_id` e `start_time`/`end_time` não mudarem, o backend pode optar por não recodificar.

### 6.3 `POST /api/clips/prefetch`

Disparado pelo frontend assim que a URL é validada.

* **Content-Type:** `application/json`  
* **Corpo:** `{ "youtube_url": "..." }`  
* **Resposta `200`:**

  ```json
  {
    "process_id": "9b8c4f...",
    "duration_seconds": 245.317,
    "audio_url": "/api/staging/9b8c4f.../audio",
    "source_format": "m4a"
  }
  ```

* **Validações:**  
  * URL válida do YouTube;  
  * Duração da fonte (via `ffprobe`) **≤ 600 s** — caso contrário, `400` com erro `source_too_long`;  
  * Falhas do `yt-dlp` mapeadas para mensagens amigáveis (`unavailable`, `private`, etc.).

### 6.4 `GET /api/staging/:process_id/audio`

Serve o ficheiro de áudio bruto descarregado pelo `prefetch`, com `Content-Type` adequado (ex.: `audio/mp4`, `audio/webm`). Suporta **`Range`** para *seek* eficiente no `<audio>` HTML5.

### 6.5 `POST /api/clips/test-play`

* **Content-Type:** `application/json`  
* **Corpo:** `{ "process_id": "...", "start_time": "HH:MM:SS.mmm", "end_time": "HH:MM:SS.mmm" }`  
* **Comportamento:** o backend toca esse intervalo do ficheiro de *staging* nos altifalantes do PC host com o **volume global** atual; se já houver áudio a tocar, interrompe-o antes (mesma regra de **§4.2**). Resposta imediata `200`.

### 6.6 Outros endpoints

* `GET /api/clips/:id` — metadados para edição.  
* `DELETE /api/clips/:id` — apaga BD + ficheiros do clipe (não toca em `media/temp/`).  
* `POST /api/clips/:id/play` — toca o `.mp3` final no servidor com volume global.  
* `POST /api/clips/stop` — para qualquer reprodução activa (clipe gravado **ou** `test-play`).  
* `GET /api/settings` — devolve `{ "playback_volume": 75 }`.  
* `PUT /api/settings` — recebe `{ "playback_volume": 75 }` e persiste.

### 6.7 Ficheiros estáticos

O Express deve servir o build do Vite e as thumbs necessárias à UI (com *path* seguro, sem directory traversal). O áudio em `media/temp/` é exposto **apenas** via `GET /api/staging/:process_id/audio` (validar que `process_id` existe e não está expirado).

---

## 7. Configuração de porta e ficheiro local

* **Porto:** configurável por **variável de ambiente** `PORT`, com **fallback** lido de **ficheiro local** na pasta de dados ou ao lado do executável (ex.: `config.json`: `{ "port": 3847 }`).  
* **Sugestão de porto por defeito:** **3847** — pouco usado por servidores de desenvolvimento típicos (`3000`, `5173`), reduz conflitos em máquinas de desenvolvimento.

Precedência sugerida: **`PORT` (env) > `config.json` > 3847.**

---

## 8. *Tray* e empacotamento Windows (v1)

* **Não** usar **serviço Windows** (`node-windows`, Session 0). A aplicação deve funcionar como **app de ambiente de trabalho** com **ícone na bandeja (*system tray*)**, iniciando o servidor Express e abrindo/ servindo a UI (navegador ou *shell* embutido conforme a solução escolhida).  
* O instalador final (Inno Setup, NSIS, ou similar) deve empacotar: frontend estático, runtime Node ou executável empacotado, `ffmpeg`/`ffprobe`/`yt-dlp`, e atalho / arranque opcional na bandeja.  
* **Versões fixas** de `yt-dlp` e FFmpeg **incluídas** no instalador.

---

## 9. Logs

* **Um ficheiro de log por execução** da aplicação; **substituir / truncar** esse ficheiro em **cada arranque** (ex.: `logs/current-run.log` ou `logs/latest.log` sempre sobrescrito no *startup*).  
* Em erro de **disco cheio** ou **permissão negada** em `%APPDATA%`, o programa deve falhar de forma controlada com mensagem ao utilizador (e entrada no log se possível).

---

## 10. Decisões fechadas nesta iteração

Resumo das decisões já incorporadas no documento:

1. **Duração máxima do trecho:** **30 s** (§2.4 e §4.4).  
2. **`PUT /api/clips/:id`:** o cliente **sempre reenvia `process_id`** (§6.2).  
3. **TTL de `media/temp/`:** **7 dias**, com limpeza no arranque (§2.1).  
4. **Limite do vídeo de origem:** **≤ 10 min** (`duration_seconds <= 600`, inclusivo) (§4.4).  
5. **Formato único de tempos:** **`HH:MM:SS.mmm`** em API, BD e UI; conversão para segundos é detalhe interno (§6.2).  
6. **Trimmer:** abandona o iframe do YouTube; passa a estratégia **audio-first** com prefetch de áudio + waveform no browser (§2.4 e §3.1).  
7. **Library da waveform:** **`wavesurfer.js`** (§3.1).  
8. **Tocar trecho (browser):** **loop contínuo** controlado pelo botão **Parar**; **Testar no servidor** toca apenas uma vez (§2.5 e §3.1).  
9. **Edição com staging expirado / inexistente:** **prefetch automático** ao abrir a Tela 1, sem confirmação (§3.1).  
10. **Disparo do prefetch na criação:** **manual**, via botão **Carregar áudio** após URL válida; o automático aplica-se apenas à edição (§2.4 e §3.1).  
11. **Reprodução no host:** `ffplay.exe` com flag `-volume` (sem `sound-play`/`play-sound`) (§1).  
12. **Linguagem:** **TypeScript** em todo o projeto (§1).

---

## 11. Estrutura do projeto

A v1 é um **monorepo** com **npm workspaces**, separando `backend` (Express) de `frontend` (Vite + React) e mantendo binários e scripts ao nível da raiz.

### 11.1 Layout de pastas

```
personal-clip-player/
├── package.json                    # workspaces + scripts (dev, build, start)
├── tsconfig.base.json              # base TS partilhada
├── .gitignore                      # ignora /bin, /node_modules, builds, %APPDATA%
├── .editorconfig
├── README.md
├── docs/
│   └── especificacao_projeto_clips.md
├── bin/                            # NÃO versionar
│   ├── ffmpeg.exe
│   ├── ffprobe.exe
│   ├── ffplay.exe
│   ├── yt-dlp.exe
│   └── README.md
├── scripts/
│   ├── fetch-binaries.mjs          # baixa ffmpeg + yt-dlp p/ /bin (postinstall opcional)
│   └── pack-windows.mjs            # (futuro) Inno Setup / NSIS
├── config/
│   └── config.example.json         # { "port": 3847 }
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                # bootstrap: paths, logs, config, app.listen
│   │   ├── app.ts                  # cria Express, regista rotas e middlewares
│   │   ├── config/
│   │   │   ├── paths.ts            # resolve %APPDATA%/LocalSoundboardServer/* + /bin
│   │   │   └── port.ts             # PORT env > config.json > 3847
│   │   ├── db/
│   │   │   ├── connection.ts       # better-sqlite3 + PRAGMA foreign_keys=ON
│   │   │   ├── migrate.ts          # CREATE TABLE IF NOT EXISTS ...
│   │   │   ├── schema.sql          # DDL canónica de referência
│   │   │   └── repositories/
│   │   │       ├── categories.ts
│   │   │       ├── clips.ts
│   │   │       └── settings.ts
│   │   ├── services/
│   │   │   ├── youtube.ts          # spawn de yt-dlp (download de áudio)
│   │   │   ├── ffmpeg.ts           # corte/encode MP3 via ffmpeg.exe (execFile)
│   │   │   ├── ffprobe.ts          # leitura de duração
│   │   │   ├── thumbnail.ts        # crop 1:1 (sharp)
│   │   │   ├── audioPlayer.ts      # ffplay.exe + processo activo + stop
│   │   │   ├── stagingStore.ts     # process_id + TTL 7 dias + limpeza
│   │   │   └── timeFormat.ts       # parse/format HH:MM:SS.mmm <-> seg
│   │   ├── routes/
│   │   │   ├── clips.ts            # GET/POST/PUT/DELETE /api/clips
│   │   │   ├── prefetch.ts         # POST /api/clips/prefetch
│   │   │   ├── staging.ts          # GET /api/staging/:id/audio (Range)
│   │   │   ├── play.ts             # POST /api/clips/:id/play, /test-play, /stop
│   │   │   └── settings.ts         # GET/PUT /api/settings
│   │   ├── middleware/
│   │   │   ├── multipart.ts        # multer (limite 1 MB para thumb)
│   │   │   └── errorHandler.ts
│   │   └── lib/
│   │       └── logger.ts           # 1 ficheiro por execução, truncado no startup
│   └── README.md
├── frontend/
│   ├── package.json
│   ├── vite.config.ts              # proxy /api -> backend em dev
│   ├── tailwind.config.ts
│   ├── postcss.config.cjs
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 # router (Dashboard / ClipForm)
│       ├── index.css               # tailwind base + tema night-mode
│       ├── lib/
│       │   ├── api.ts              # wrappers tipados sobre fetch
│       │   ├── time.ts             # parse/format HH:MM:SS.mmm <-> número
│       │   └── youtube.ts          # regex de validação de URL
│       ├── components/
│       │   ├── ui/                 # componentes gerados pelo shadcn/ui
│       │   ├── ClipCard.tsx
│       │   ├── CategorySection.tsx
│       │   ├── SearchBar.tsx
│       │   ├── ModeToggle.tsx
│       │   ├── VolumeSlider.tsx
│       │   ├── ConfirmDialog.tsx
│       │   ├── trimmer/
│       │   │   ├── Trimmer.tsx
│       │   │   ├── WaveformView.tsx
│       │   │   ├── TimeInput.tsx
│       │   │   └── TrimmerControls.tsx
│       │   └── thumbnail/
│       │       ├── ThumbnailDropzone.tsx
│       │       └── ThumbnailCropper.tsx
│       ├── pages/
│       │   ├── DashboardPage.tsx   # Tela 2
│       │   └── ClipFormPage.tsx    # Tela 1 (criação e edição)
│       └── hooks/
│           ├── useClips.ts
│           ├── usePrefetch.ts
│           └── useVolume.ts
└── installer/                      # placeholder p/ Inno Setup / NSIS (futuro)
    └── README.md
```

### 11.2 Convenções

* **Estrita separação** `backend/` vs `frontend/`, sem dependências cruzadas em runtime.
* **Imports** internos preferem caminhos relativos curtos; podem usar-se *path aliases* simples (`@/...`) configurados em `tsconfig` por workspace.
* **Build do frontend** vai para `frontend/dist/` e é servido pelo Express via `express.static` em produção.
* **Em desenvolvimento**, Vite corre em `http://localhost:5173` e faz proxy de `/api` e `/api/staging` para `http://localhost:3847`.
* **`/bin/`** é gerado por script (`scripts/fetch-binaries.mjs`); não é versionado.
* **Dados do utilizador** ficam **sempre** em `%APPDATA%/LocalSoundboardServer/`, nunca dentro do repo.

### 11.3 `package.json` (raiz)

```json
{
  "name": "personal-clip-player",
  "private": true,
  "version": "0.1.0",
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "fetch:bin": "node scripts/fetch-binaries.mjs",
    "dev:backend": "npm --workspace backend run dev",
    "dev:frontend": "npm --workspace frontend run dev",
    "dev": "npm-run-all --parallel dev:backend dev:frontend",
    "build:frontend": "npm --workspace frontend run build",
    "build:backend": "npm --workspace backend run build",
    "build": "npm run build:frontend && npm run build:backend",
    "start": "npm --workspace backend run start"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5",
    "typescript": "^5.4.0"
  }
}
```

### 11.4 `backend/package.json` (resumo das dependências v1)

```json
{
  "name": "@app/backend",
  "private": true,
  "version": "0.1.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "express": "^4.19.0",
    "multer": "^2.1.1",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/express": "^4.17.0",
    "@types/multer": "^2.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0"
  }
}
```

### 11.5 `frontend/package.json` (resumo)

```json
{
  "name": "@app/frontend",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.400.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-image-crop": "^11.0.5",
    "react-router-dom": "^6.24.0",
    "wavesurfer.js": "^7.8.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^6.4.2"
  }
}
```

> shadcn/ui não é uma dependência npm tradicional: é instalado via CLI (`npx shadcn-ui@latest add <component>`) e os ficheiros gerados ficam em `frontend/src/components/ui/`.

### 11.6 Fluxo de desenvolvimento

1. `npm install` na raiz (instala os dois workspaces).
2. `npm run fetch:bin` — popula `bin/` com `ffmpeg.exe`, `ffprobe.exe`, `ffplay.exe`, `yt-dlp.exe`.
3. `npm run dev` — corre backend (porta 3847) **e** frontend (porta 5173) em paralelo, com proxy.
4. `npm run build` — gera `frontend/dist` e `backend/dist`.
5. `npm start` — corre o backend em modo produção (servindo o `frontend/dist`).

---

## 12. Esqueleto inicial (mínimo executável)

Esta secção descreve o **mínimo** a implementar para a app arrancar e responder aos *health checks*, antes de adicionar regras de negócio. Serve como ponto de partida para a primeira *issue/commit*.

### 12.1 Migração SQL inicial (`backend/src/db/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    youtube_url TEXT NOT NULL,
    start_time TEXT NOT NULL,           -- HH:MM:SS.mmm
    end_time TEXT NOT NULL,             -- HH:MM:SS.mmm
    category_id INTEGER,
    tags TEXT,
    thumbnail_original_path TEXT NOT NULL,
    thumbnail_cropped_path TEXT NOT NULL,
    thumbnail_crop_meta TEXT,
    audio_path TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings(key, value) VALUES ('playback_volume', '75');
```

### 12.2 Bootstrap do backend (`backend/src/index.ts`)

Responsabilidades, por ordem:

1. Resolver `paths` (`%APPDATA%/LocalSoundboardServer/*`, `/bin/*`) e criar pastas em falta.
2. Inicializar o **logger** (`logs/latest.log`, **truncar** ao arrancar).
3. Carregar configuração de porta (`PORT` env > `config.json` > 3847).
4. Abrir a ligação SQLite e correr `migrate.ts`.
5. Limpar `media/temp/` removendo ficheiros com mais de 7 dias.
6. Construir a app Express (`app.ts`) e fazer `app.listen(port, '0.0.0.0')`.
7. Registar handlers para `SIGINT` / `SIGTERM` que parem reproduções activas (`audioPlayer.stop()`).

### 12.3 Endpoint de saúde (smoke test)

Para confirmar que o esqueleto está vivo antes de qualquer regra de negócio:

```
GET /api/health  ->  { "status": "ok", "version": "0.1.0", "appdata": "C:\\Users\\...\\LocalSoundboardServer" }
```

Não faz parte do contrato público (§6) mas é útil em desenvolvimento e instalação.

### 12.4 Ordem sugerida de implementação

1. Esqueleto + `/api/health` + DB com migrações + logger.
2. `GET /api/settings` / `PUT /api/settings` + slider de volume no frontend (sem áudio ainda).
3. `POST /api/clips/prefetch` + `GET /api/staging/:id/audio` + Tela 1 (apenas URL + botão *Carregar áudio* + waveform sem corte).
4. Trimmer com handles + validação dos 30 s + `POST /api/clips/test-play`.
5. Thumbnail + crop 1:1.
6. `POST /api/clips` (corte real com FFmpeg) + `POST /api/clips/:id/play` + `POST /api/clips/stop`.
7. `GET /api/clips` + Dashboard (Tela 2) com favoritos, pesquisa e modo edição.
8. `PUT /api/clips/:id` + `DELETE /api/clips/:id`.
9. *Tray* + empacotamento Windows.
