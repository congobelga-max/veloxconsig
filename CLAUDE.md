# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

There is no build step, package manager, test suite, or linter. The app is static files served by XAMPP from `C:\xampp\htdocs\veloxconsig`.

- Open `http://localhost/veloxconsig/` in a browser (Apache must be running in the XAMPP control panel).
- To test a change: hard-reload the page (Ctrl+F5) — `app.js` is cached aggressively.

## Deploy

Production is `https://crm.veloxconsig.com.br/`, deployed from GitHub (`congobelga-max/veloxconsig`, branch `main`) via EasyPanel, **behind Cloudflare**.

Cloudflare caches everything under `assets/` for four hours (`Cache-Control: max-age=14400`) but not the `.php` documents. A deploy therefore goes live as *new HTML calling old JS and CSS* — the page looks broken or half-updated, and it looks exactly like a failed deploy when the deploy in fact worked. It was measured: `painel.js` was served at 16215 bytes against 19692 on disk, `cf-cache-status: HIT`, `age: 6922`.

Every local asset URL in `index.php` and `login.php` therefore carries `?v=<versão>`. **Bump that value in the same commit whenever anything under `assets/` changes** — a new URL is a new cache key, so the browser and Cloudflare both fetch the new file, and no cache purge is needed. CDN URLs are left alone; they are already versioned by path.

Before blaming a deploy, compare the byte counts: `Invoke-WebRequest https://crm.veloxconsig.com.br/assets/js/painel.js` against the local file. Equal sizes mean the deploy landed and the problem is elsewhere.
- Clipboard auto-paste (`colarTelegramAutomaticamente`) requires a secure context; it silently no-ops over plain `http://` on some browsers. `localhost` counts as secure in Chrome.

`index.php` contains no PHP — it is plain HTML with a `.php` extension. All dependencies (Bootstrap 5.3, Bootstrap Icons, SheetJS/`xlsx` 0.18.5) load from CDNs, so the app needs internet access to work.

Local assets are referenced relative to the document root of the app: `index.php` loads `assets/css/style.css` and `assets/js/app.js`, matching the on-disk layout. (These tags previously pointed at `css/`‑ and `js/`‑rooted paths that 404'd, leaving the served page with no stylesheet and no JavaScript.) There is no `.htaccess` and no rewrite rules — paths resolve exactly as written.

## Architecture

Single-page mobile CRM for a Brazilian payroll-loan (consignado) brokerage. One operator imports a spreadsheet of leads, works each card, and messages clients over WhatsApp. There is no backend and no server-side state — everything is in `assets/js/app.js` (~1200 lines, all globals, no modules).

### Login gate

`login.php` posts `{email, password}` to `AUTH_CONFIG.API_LOGIN` and stores the returned token. `index.php` calls `exigirAutenticacao()` in `<head>` (before any rendering) and redirects to the login page when there is no valid session. Removing those two `<script>` tags disables the gate entirely.

Credentials live in `AUTH_CONFIG` (`assets/js/auth.js`) — one place to edit. `montarCabecalhos()` in `login.js` always sends `x-api-key: <API_KEY>`, and adds `Authorization: Bearer <TOKEN_APP>` only when `TOKEN_APP` is non-empty and not the `YOUR_SECRET_TOKEN` placeholder — sending a placeholder would just earn a 401.

`x-api-key` is a custom header, so the browser makes this a preflighted request: the API must answer the `OPTIONS` probe with `Access-Control-Allow-Origin` for the serving origin and `Access-Control-Allow-Headers: x-api-key, content-type, authorization`. A missing preflight response surfaces as a `TypeError` from `fetch`, indistinguishable from an offline device — hence the error copy naming both causes. `curl` never reveals this, since CORS is enforced only by browsers.

Two things this is **not**: `API_KEY` is shipped to the browser and readable by anyone, so it is not a secret once deployed — keep it rotatable and scoped to the login endpoint, or move the call behind a backend proxy. And the redirect is a client-side convenience, not access control: `localStorage` is editable and the page is static. Treat both as UI, not security.

Session keys (`auth_token`, `auth_usuario`, `auth_expira`, `auth_email_lembrado`) are namespaced away from the per-CPF keys on purpose — `limparSessao()` must never wipe the operator's `status_` / `contato_` / `classificacao_` work. Sessions expire after `HORAS_SESSAO` (12h) unless the API returns `expires_in`; a token with no stored expiry is treated as expired.

The login response shape was never confirmed against the live API, so `extrairToken` / `extrairUsuario` / `extrairMensagem` in `assets/js/login.js` accept several common field spellings (`token`, `access_token`, `data.token`, Laravel-style `errors{}`). Once the real shape is known, collapse them to the actual path.

### Three screens, one page

`index.php` is a sidebar shell (`offcanvas-lg` — a drawer under 992px, a fixed column above) with sections toggled by `mostrarSecao()`:

- **Painel** (`assets/js/painel.js`) — the operator's work queue: a DataTable over `AUTH_CONFIG.API_CLIENTES`, WhatsApp and proposal modal.
- **Clientes** — a DataTables CRUD over `AUTH_CONFIG.API_CLIENTES`.
- **Importações** — spreadsheet upload + history over `AUTH_CONFIG.API_IMPORTACOES`.

Each table is built while hidden, so its section must call `columns.adjust().responsive.recalc()` on show or every column collapses to zero width. The Painel loads with the page, since it is the section shown on entry. Importações loads lazily on first visit.

**Clientes loads nothing on entry** — the full list is slow, and the usual reasons to open that screen are registering one client or looking one up. It opens with an empty table and a hint; `consultarClientes()` searches by CPF or name, and **Carregar todos** is the explicit way to pull everything. A search whose term is 11 digits sends `?cpf=` to the API, but `filtrarClientes()` also filters locally afterwards: that parameter was never confirmed to be supported, so it is treated as an optimization, not a guarantee. Name matching goes through `semAcento()`, so "jose d'avila" finds "JOSÉ D'ÁVILA".

**The three data sets are distinct.** `painelClientes` ← server (filtered); `clientesApi` ← server; `importacoes` ← server. `carregarPainel()` also assigns the global `clientes`, because `abrirModalProposta` / `enviarPropostaWhatsApp` in `app.js` look the record up there. Nothing flows Painel → server except by uploading a spreadsheet.

`sincronizarPainel()` reloads the Painel from the API and goes there. It deliberately does **not** hand over `clientesApi` — that array is whatever the Clientes search last returned, which may be a single record; the Painel does its own full fetch and applies its own rule (offer + celular). It also resets the date filter to **Todos** first: leaving it on the default *Hoje* made the Painel look empty right after syncing, because clients registered on any earlier day were filtered out by a rule that has nothing to do with syncing.

### Painel (`assets/js/painel.js`)

Four visible columns — **Nome**, **Contato**, **Origem** and **Data de criação** (`createdAtUtc`, newest first; it is column index **4**, since 0 is the Responsive control — the `order` config has to move whenever a visible column is inserted).

**Origem** has two sources, and the server wins. `/clientes` carries an `origem` field — a confirmed server enum with three members: `Importacao` (spreadsheet upload), `Webhook` (`POST /webhooks/leads`) and `Api` (`POST /api/clientes`). `ORIGENS_API` maps each to its pt-BR label, badge class and icon; lookup is case- and accent-insensitive, so a serialization change from `Importacao` to `importacao` doesn't blank the column. **A value with no entry there is displayed exactly as the server sent it** — swallowing an unknown value into "Base" would hide precisely the origin someone just added. That also covers the enum arriving as a number (`0`/`1`/`2`, which is System.Text.Json's default without `JsonStringEnumConverter`): the digit shows up in the column rather than being mapped by guessed declaration order, because guessing wrong would label a client with someone else's origin.

When the record carries no `origem` at all — rows created before the field existed — it falls back to the accumulated `leads_importados` — the local registry of every CPF ever imported in *this browser* — which yields **Planilha** or **Base**. That registry used to decide who got into the Painel without an offer; now that nobody needs an offer, this is its only remaining job. Like `contato_`, it changes with the list on screen, so `atualizarOrigensPainel()` resolves the column onto the row objects before every draw rather than at map time.

`origemFonte` (`"api"` / `"local"`) records which path answered, and the badge's `title` says so — a local guess must not read as a statement from the server, and it also quotes the raw value when the label was translated. The cell value *is* the label, so the table search filters by origin with no helper column. Missing `importacoes.js` costs only the fallback; the server field still renders.

**Leads of the last import** are marked from `localStorage.ultima_importacao` (written by `importacoes.js`). Like `contato_`, that key changes while the list is on screen, so `atualizarImportadosPainel()` copies it onto the row objects before every draw. Marked rows get a green **novo** badge next to the name, with the creation date in its `title`; the **Importados agora (N)** chip is a *third* independent dimension, combining with the date and contact filters rather than replacing them. The chip stays hidden until an import has been recorded — and hiding it also clears the filter, since a filter with no visible control would empty the list with nothing on screen explaining why. `sincronizarPainel()` clears it for the same reason it resets the date filter.

**Contato comes from the server and from nowhere else.** `contatoNivel` is `contatoStatus` run through `numeroContatoStatus()`, and it drives the label — **Contatado**, **Enviado**, **Não contatado** — while `contatado` collapses it to the single boolean the **Não contatados** chip filters on. There is **no localStorage copy**, and re-adding one would recreate the bug that removed it: `contato_inicial_<cpf>` is per origin, so the same client read *contatado* on `http://localhost` and *não contatado* on `https://crm.veloxconsig.com.br`, with nothing on screen explaining the disagreement.

Two consequences of that removal, both deliberate. **The label carries no timestamp** — the date and time were local keys and went with them; when the API exposes a contact date, `textoContatoPainel()` is where it goes. And **a failed PATCH means the row goes back to Não contatado**: `sincronizarContatoNaApi()` updates the in-memory record optimistically so the line reacts inside the click, then restores the previous value and redraws if the server refuses. What the screen shows is what the server accepted. The local key exists because it is written synchronously inside the click, so the row flips the instant the operator opens the conversation, before any request returns; the server field is what makes the mark survive a different browser. `atualizarContatosPainel()` reads both onto the row objects before every draw instead of the mapper reading them once at load. A row marked only by the server shows "Contatado" with no timestamp — the date/time keys are local. The **Não contatados** chip filters on it and is a *second, independent dimension*: it combines with the date filter rather than replacing it. The WhatsApp button goes through `contatarPainel()`, which calls `abrirWhatsapp()` and then redraws — with the filter on, the row leaves the list entirely (so `desenharPainel()`), with it off only the cell changes (so `rows().invalidate()`, which keeps the page and any open child row). Everything else lives in the Responsive child row: celular, CPF, offer count, and the **WhatsApp** / **Montar proposta** buttons. Those columns carry `className:"none"`, which keeps them out of the grid at *every* width — the child row is not a small-screen fallback here, it is where the detail is meant to be. The ⊕ toggle is column 0 (`className:"dtr-control"` + `responsive.details.type:"column"`).

**Two views over one table.** The Tabela/Cards toggle does not build a second data set: `renderizarCardsPainel()` reads `rows({page:"current", search:"applied", order:"applied"})`, so the cards are the DataTable's current page rendered differently and cannot drift from it. The `#cardsPainel` container is moved *into* the DataTables layout next to the `<table>` on init, and `.emCards` hides `table.dataTable` only — the wrapper stays, so the search box, page-length selector and paginator keep working in card mode. Both views share `valorComCopia()` and `botoesAcao()` for the same reason. Cards are re-rendered from the `draw` event and skipped entirely while the table view is active.

The copy buttons next to celular and CPF call `copiarTexto()` from `app.js`, which strips to digits and re-pads the CPF to 11 — that padding exists only on copy, so what is displayed and what lands on the clipboard differ by design for CPFs that lost leading zeros. `valorComCopia()` returns the whole `.linhaCampo` wrapper (value + button) rather than the two pieces loose, because that flex row is what pins the button to the right edge — in the child row the wrapper only spans the full width thanks to `flex:1` on `.dtr-data`.

**The Painel does not carry status.** It was there briefly and was taken out: no chips, and `mapearClientePainel` no longer reads `status_`/`data_`/`hora_`. Nothing in the app writes those keys now except a local spreadsheet import, so the read-only Status column in **Clientes** shows only history from before this change.

**The entry rule asks for two things, and an offer is not one of them.** `clienteDoPainel()` requires a dialable **celular** (≥ 10 digits) and a CPF, and nothing else — without a number there is no WhatsApp and no Telegram, which is all the row offers, and without a CPF there is no local key for the operator's history.

**`ofertas` is not an entry rule — it is a chip.** It used to gate the list (first for everyone, then for everyone except spreadsheet leads); a client with no offer is exactly the one still waiting to be queried, so gating on it kept the queue off the screen that exists to work it. The Painel is now the whole client list minus the records nothing can be done with, and **Com oferta (N)** is a *fourth* independent dimension next to Não contatados and Importados agora, combining with the date filter rather than replacing it. `marcarChipOferta()` keeps the count in the label and, unlike the import chip, never hides the control — a count of zero is the answer ("no bank query has come back yet"), not a reason to disappear. When the filter empties the list, the copy points at **Com oferta**, not at the date chips, because pointing at the wrong control is how an operator gets stuck. `irParaLeadsImportados()` and `sincronizarPainel()` clear it: a freshly imported lot has zero offers by definition and would open on an empty screen.

The general rule this follows: narrowing belongs in a chip with a visible control, not in the entry filter — a rule with nothing on screen to explain it reads as missing data.

`quantidadeOfertas()` accepts a count or an array under several spellings (`ofertas`, `qtdOfertas`, `totalOfertas`, …) because the field name was never confirmed in the `/clientes` payload — collapse it once the real name is known. A record with none of them counts as zero offers; there is deliberately **no fallback to `margemDisponivel`**, which is a different quantity. Rows at zero offers render `sem oferta ainda` in a neutral `seloOfertas.semOferta` rather than `0 ofertas`, which reads as a defect.

The date filter (Hoje / Ontem / a specific date) compares `chaveDoDia()` strings, not `Date` objects: `createdAtUtc` arrives in UTC and `<input type="date">` yields a local day, so both are reduced to a local `AAAA-MM-DD` key first. Parsing the picker value with `new Date("2026-07-30")` would read it as UTC and land on the previous day for anyone west of Greenwich — `formatarDiaBR()` splits the string instead. Filtering is done in plain JS and the rows are re-added; no `DataTable.ext.search` hook, which is global and would also reach the other two tables. A record with no `createdAtUtc` matches no day and is only visible under **Todos**.

The card/import/export code in `app.js` (`renderizarCards`, `atualizarDashboard`, `importarPlanilha`, `exportarPlanilha`, `aplicarFiltro`) is no longer reachable from the UI — its markup left `index.php`. It was kept because the proposal pipeline, `abrirWhatsapp` and `alterarStatus` sit in the same file, and every function that touched the removed DOM now checks the element first and no-ops. `alterarStatus` still ends by calling `renderizarCards()`, `atualizarDashboard()` and `irParaProximoCliente()`; all three find nothing to do and return, which is why the Painel redraws its own rows afterwards.

### CRUD layer

`assets/js/api.js` is transport only: `requisitarApi()` attaches `x-api-key` plus `Authorization: Bearer <session token>` from `obterToken()`, and turns failures into an `ErroApi` carrying `.status` (0 = network/CORS, since `fetch` cannot distinguish offline from a blocked preflight). A 401 clears the session and bounces to the login page — the server rejecting the token is the one case the local expiry check cannot catch.

`assets/js/clientes-crud.js` holds the UI plus `mapearClienteDaApi` / `mapearClienteParaApi`. A client record looks like this:

```json
{"id":1,"key":"38d302de-…","cpf":"50181123878","nome":"…","celular":"11950824546",
 "email":"…","margemDisponivel":220.16,"margemBruta":1732.06,
 "createdAtUtc":"2026-07-25T01:03:00.394955Z","updatedAtUtc":"…"}
```

Three consequences worth knowing before touching this:

- **The phone field is `celular`, not `telefone`** — the spreadsheet side uses `telefone`, so the two models differ by one name.
- **There is no margin `status` on the server.** That one is local, `localStorage.status_<cpf>`, exactly as the Painel writes it. The table renders it read-only and re-reads it on every draw; it is never sent in a payload. Not to be confused with **`contatoStatus`**, which *is* a server field (`1` não contatado, `2` contatado) — `mapearClienteParaApi` emits `{cpf, nome, celular, email}` plus `contatoStatus` **when the record already carries one**. It is not editable in that form; it is echoed back so that saving a name change cannot reset someone to "não contatado", which a whole-resource `PUT` would otherwise do.
- **`margemDisponivel` / `margemBruta` come from the bank queries**, not the operator, so they are display-only. They *are* echoed back on update — if `PUT` replaces the whole resource, omitting them would zero real margins.

The record shape is confirmed; the list *envelope* is not, so `extrairLista` still accepts `[…]`, `{data:[…]}`, `{clientes:[…]}` and paginated `{data:{data:[…]}}`.

**Two server identifiers, and `id` ≠ `id`.** The API sends both an integer `id` and a GUID `key`. Routes use the integer via `identificadorUrl()` — one line to switch to `key` if the backend disagrees. Locally, `cliente.id` means something else entirely: the CPF digits, because every localStorage key hangs off it. The server's PK is `idApi`. Never merge the two.

`apiAtualizarContatoStatus()` is the one partial write in the app: **`PATCH /clientes/:id` with `{contatoStatus}` only**. A `PUT` carrying just that field would blank the rest of the record if the route replaces the resource, so PATCH is tried first and only a 404/405/501 falls back to `PUT` — and that fallback re-sends the whole raw record the API itself returned (kept on `cliente.bruto`), never a half-filled body. Neither verb was confirmed against this route; if PATCH is unsupported the console shows which one answered.

On save, the sent payload is the base and the API response overlays it — an API that replies with only `{id:1}` would otherwise blank out the row. If no id comes back at all, the list is reloaded so edit/delete keep a target.

Currency and dates sort wrong if `render` returns formatted text for every type: return the raw number/ISO string for `sort`/`filter` and format only for `display`.

### Uploads (`assets/js/importacoes.js`)

`POST /importacoes-clientes` takes `multipart/form-data` with the file under the field name `arquivo`. **Never set `Content-Type` for it.** The `curl` recipe spells the header out because curl computes the boundary itself; in the browser, setting it by hand produces a body with no boundary and the server rejects the upload. `requisitarApi` takes `opcoes.formulario` (a `FormData`) precisely so it can skip that header — `opcoes.corpo` is the JSON path.

A successful upload reloads the import list and the Painel, since the server creates clients as a side effect. The Clientes table is only reloaded when the operator had already opened it (`tabelaIniciada`) — that screen loads nothing on entry by design, so refreshing it otherwise is a full list read thrown away.

**Which leads a given upload created is worked out client-side.** The POST returns nothing identifying them and the listing route may not even exist, so `enviarImportacao()` takes a snapshot of the CPFs already on the server *before* the upload and diffs it against the list read after. Comparing CPFs is exact and does not depend on the server's clock agreeing with the browser's; the timestamp path (`novosPorDataDeCriacao`, with five minutes of slack) is the fallback for when that first read fails, and the summary says so when it was used. Records with no CPF are excluded from both — without that, the same CPF-less record counts as new on every upload.

**Two keys are written, and they have different lifetimes.** Confusing them breaks one feature or the other:

- `ultima_importacao` — `{quando, arquivo, porData, ids, total, noPainel, linhas}`, **replaced** by every upload. It is only the last batch: the **Importados agora (N)** chip, the **novo** badge, and the summary text.
- `leads_importados` — `{"<cpf>": "<ISO>"}`, **accumulated**, never replaced. This is the one the Painel's **Origem** column reads, so replacing it would make every earlier batch start calling itself **Base** on the next upload, erasing how those clients arrived. It is merged, not overwritten, for that reason.

A lead that arrives without a phone still goes into `leads_importados`; it just doesn't pass the entry rule. If someone later fills its `celular` on the server, it shows up in the Painel on the next load — already marked **Planilha**, since the provenance was recorded at upload time.

`textoUltimaImportacao()` renders the summary for the Importações banner and the toast: leads created, how many the Painel accepted, and how many were left out for having no phone. A missing phone is the *only* way to be left out — the offer rule is gone entirely — so the copy must not claim otherwise.

Neither key existed before this feature, so leads imported earlier are not in `leads_importados` and the Painel shows them as **Base**. Only a fresh upload records provenance; there is no backfill, because nothing in the payload says which clients came from a spreadsheet. The registry is also per browser — an import done on another machine reads as **Base** here.

After the upload, `irParaLeadsImportados()` (in `painel.js`) opens the Painel filtered to that lot. It sets the date filter to **Todos** on purpose: the import marking is already the exact cut, and a day that disagrees — a file processed past midnight, a server clock ahead — would empty the screen at the one moment it should be showing the result. The **Data de criação** column still carries each lead's day.

Only the POST contract is confirmed. Listing and delete are assumed to follow REST convention on the same path; `carregarImportacoes()` treats 404/405 as "this API has no listing" and says so instead of showing an error. The record mapper accepts several field spellings for the same reason — collapse it once the shape is known.

### Session lifetime

The API's JWT carries `exp` about an hour out. `expiracaoDoToken()` decodes that claim and it takes precedence over the login response's `expires_in` and over `HORAS_SESSAO`. Without it the local session outlives the token and every action 401s until the operator works out that they need to log in again. Non-JWT tokens fall through to the older rules.

DataTables `render` callbacks do no escaping of their own, so every one of them goes through `escaparHtml` / `escaparArgumento`.

### Telegram

Every WhatsApp button has a Telegram twin — Painel card/row, proposal modal, contract wizard footer, and each listed proposal. They share the message: `textoDeContato()` builds the approach text, writes `contato_inicial_<cpf>` *and* calls `sincronizarContatoNaApi()`, so reaching a lead on Telegram counts as contacted exactly like WhatsApp — on the server too, not just in the grid. `contatarPainel()` takes the channel as an argument rather than existing twice.

**That one function is deliberately the only hook for marking contact.** Every channel and every screen funnels through it, so hanging the server update anywhere else (on the Painel's WhatsApp button, say) would leave the proposal modal and the contract wizard writing the local key without telling the server.

`contatoStatus` is a server enum with three members: **1 Não contatado, 2 Enviado, 3 Contatado**. The button writes **3** — 2 exists for whatever records it from outside this app, and is only ever read here. `numeroContatoStatus()` accepts the number or the name (`"Contatado"`), since the serialization was never confirmed, and an unrecognised value scores 0 so it reads as not-yet-approached. **The sync only ever moves the value up**: a record already at 3 is skipped, one at 2 is upgraded, and nothing downgrades when the operator reopens a conversation.

`sincronizarContatoNaApi()` sends `contatoStatus: 3` and is **not awaited** — `window.open` has to fire inside the click gesture, and waiting on the network first is exactly how a pop-up blocker eats the WhatsApp window. It runs on every contact attempt and is guarded only by the record's own status, so a lead the server still has at 1 or 2 is pushed up on the next approach. A failure surfaces as an error toast *and* reverts the row, because the operator needs to know the mark did not stick. A client not in memory with an `idApi` is skipped with a `console.warn` — there is no route to call without it.

**Which text the client receives is now a server decision too.** `textoDeContato()` reads `foiAbordado(cliente.contatoStatus)` to pick the opening wording or the follow-up, so a lead approached from another machine correctly gets the follow-up here. That read must stay **before** `sincronizarContatoNaApi()`, which raises the status to 3 optimistically — after it, every first contact would send the follow-up. The 50-wording rotation (`mensagem_inicial_<cpf>`, `rodizio_mensagem_inicial`) stays in localStorage: it is a drafting preference of this machine, not client state, and the API has no field for it.

**Telegram cannot pre-fill a message to a phone number.** `t.me/+<numero>` opens the right conversation but accepts no body; `t.me/share` accepts text but not a recipient. Since the recipient is what matters here, `abrirTelegramComTexto()` opens the conversation and puts the message on the clipboard, then says so in a toast — the operator pastes. Do not "fix" this by switching to `t.me/share`: that would ask the operator to pick the contact by hand, which is worse and loses the guarantee that the message goes to the right person.

### Toasts (`assets/js/toast.js`)

`notificar(mensagem, tipo)` replaced every `alert()` in the app — `alert` freezes the page and, on a phone, covers whatever the operator was reading. Types are `sucesso` / `erro` / `info`, which set the colour and how long it stays (errors linger longest); an unknown type falls back to `info`, and an empty message is dropped rather than showing an empty box.

The container is created on the first call, so no page needs markup for it, and it sits at `z-index: 2000` — **above Bootstrap's modal (1055)**, because most of these fire with a modal open (copying a proposal, generating a contract). The text goes in via `textContent`: several messages carry an API error string.

`confirm()` was **not** replaced. It blocks waiting for an answer, and the three places using it (deleting a client, deleting an import, generating a contract) all depend on that answer before acting.

### State model

Three module-level globals drive everything: `clientes` (the working array), `filtroAtual`, `pesquisaAtual`. `renderizarCards()` rebuilds `#clientes` from scratch on every change; `atualizarDashboard()` recounts the five dashboard tiles. Nearly every mutation ends by calling both.

Because cards are built as HTML strings with inline `onclick=` handlers, **every function invoked from a card or from `index.php` must be a top-level global**. Adding a bundler, `type="module"`, or an event-delegation refactor breaks all of them at once.

### Persistence: localStorage, keyed by CPF

The client `id` is the CPF stripped to digits (`somenteNumeros`), and it is the primary key for both the in-memory list and localStorage. Rows without a usable CPF are dropped at import. Keys written:

| Key | Written by | Meaning |
| --- | --- | --- |
| `status_<id>` | import, `alterarStatus` | `nao` \| `com` \| `sem` |
| `data_<id>`, `hora_<id>` | import, `alterarStatus` | when the status was set; cleared when status returns to `nao` |
| ~~`contato_inicial_<id>`~~, ~~`contato_data_<id>`~~, ~~`contato_hora_<id>`~~ | — | **Removed.** Contact state is the server's `contatoStatus`; nothing writes these any more. `migrarHistoricoCpf` still moves them so old machines don't lose the record, and reads elsewhere are gone |
| `classificacao_<id>`, `classificacao_texto_<id>` | `gerarProposta` | outcome of the last Telegram parse |
| `mensagem_inicial_<id>` | `abrirWhatsapp` | index of the opening message this client got |
| `rodizio_mensagem_inicial` | `abrirWhatsapp` | next position in the opening-message rotation (not per-CPF) |

Two keys are **not** per-CPF and are written by the upload flow: `ultima_importacao` (last batch) and `leads_importados` (every CPF ever imported, with its date — this one feeds the Painel's **Origem** column). Both are described under *Uploads*. `limparSessao()` must not wipe either — they are operator work, not session state.

### Opening messages (`assets/js/mensagens.js`)

`MENSAGENS_INICIAIS` holds **50 wordings of the same approach**, and `abrirWhatsapp` takes the next one in rotation for each new client. Blasting an identical text at lead after lead is what gets a WhatsApp number flagged as spam; the whole list is used before anything repeats.

The chosen index is stored per CPF, so reopening a conversation never swaps the text under a client who already read it — `rodizio_mensagem_inicial` only advances for someone new. That per-CPF key is in `migrarHistoricoCpf`'s prefix list for the usual reason: without it, padding the leading zeros would look like a fresh client and produce a *second, different* opening message for the same person.

Only the first-contact message rotates. The follow-up (sent once `contato_inicial_<id>` is set) is still a single text.

Nothing ever reads these back except import and the "aguardando" counters — the app has no boot-time restore, so a page refresh empties the client list and the operator must re-import.

### Import merge precedence (`importarPlanilha`)

Import *replaces* `clientes` rather than appending. Per row, status resolves in this order — changing it silently rewrites operator work:

1. `Status` column in the spreadsheet, if it reads `COM` / `SEM` / `NÃO CONSULTADO` (and variants)
2. status of a matching CPF already in the in-memory list
3. `localStorage.status_<id>`
4. `"nao"`

`data`/`hora` follow the same cascade, then are forcibly blanked when the final status is `nao`. Column names are matched by a hardcoded alias list (`NOME`/`Nome`/`CLIENTE`, `CPF`, `TELEFONE`/`CELULAR`, `Status`, `Data`, `Hora`) — new spreadsheet headers must be added there.

CPFs lose leading zeros when Excel stores them as numbers. `copiarTexto` re-pads to 11 digits *on copy only*; the displayed and exported value stays as imported. This does not apply to the CSV path, which parses with `raw:true` and keeps every value as text.

### CSV (`assets/js/csv.js`)

The reference layout is `nome;telefone;cpf`. Two things about Brazilian CSV decide whether it parses at all, and SheetJS gets both wrong by default:

- **Separator.** Excel in pt-BR writes `;`, SheetJS assumes `,`. `detectarSeparadorCsv()` counts candidates in the header line and the result is passed as `FS` to `XLSX.read`. Guessing from the header (not the whole file) matters — a name like `SILVA, JOSE` in the body would otherwise outvote the real separator.
- **Encoding.** Excel writes windows-1252, not UTF-8. `decodificarTexto()` strips a BOM, tries strict UTF-8, and falls back to 1252 — read as UTF-8, `JOSÉ` comes out corrupted.

`importarPlanilha` branches on `ehArquivoCsv()`: CSV goes through `lerWorkbookCsv` (text + `FS` + `raw:true`), everything else keeps the original binary path via `lerWorkbookBinario`. The old inline `reader.onload` body is now `processarPlanilha(workbook, entrada)`; both paths funnel into it.

Header matching is accent- and case-insensitive against `ALIASES_COLUNAS`, so `CPF`, `cpf`, `Documento` are one column. The upload modal calls `analisarCabecalhoCsv()` on selection and refuses to send a CSV missing a required column — the server would only reject it after the round trip. `.xlsx` is not inspected client-side; its layout is the API's business.

### CPF leading zeros are not cosmetic

Excel stores CPF as a number and eats leading zeros. In the reference lead file, 33 of 100 CPFs arrived with 9 or 10 digits; padded back to 11, **all 100 pass the check-digit test**, so padding is provably the right reading and not a guess.

`normalizarCpf()` pads anything under 11 digits and is the single entry point — `formatarCPF`, import, the API mapper and the duplicate check all go through it. Without it those 33 records get a 10-digit local key that can never match the server's 11-digit CPF, silently splitting one client into two.

Because the key changes, `migrarHistoricoCpf()` runs during import: it moves `status_`/`data_`/`hora_`/`contato_*`/`classificacao_*` from the truncated key to the padded one, and a value already stored under the new key wins (it is the more recent one). Without this, fixing the zeros would look like the operator's history vanished.

### Loading leads by path

A browser cannot open `C:\VeloxConsig\leads\leads_crm_04.csv` by path — no page can read the disk by path, ever. The file must either be picked through the file input or published over HTTP. `LEADS_CONFIG` in `csv.js` points at `/leads/`, which needs an Apache alias (the snippet is in that file's header comment); `Require local` keeps it off the network.

There is no button for this — the folder is tried automatically, falling back silently to the file picker (`console.warn` only). A missing alias is a setup detail, not something to interrupt the operator over.

- Importações modal → `abrirModalImportacao()` fires `tentarArquivoDoServidor()` without awaiting, so the modal opens instantly and the file attaches when it arrives. It bails if the operator already picked something in the meantime.
- `importarLeads()` in `app.js` did the same for the old Painel **Importar** button. That button is gone with the card layout, so this path is now unreachable.

### Offer simulation (`assets/js/simulacao.js`)

**Montar proposta** no longer just opens the modal: `montarProposta()` opens it and immediately queries OpenCredit for the client's CPF. Two calls, both confirmed against the live API — `POST /api/auth/login` with `{email, password}`, whose token is at **`data.accessToken`**, then `POST /api/tenants/<tenant>/integration/simulate` with `{cpf}` and `Authorization: Bearer`.

**The password ships to the browser.** It is in `SIMULACAO_CONFIG` in a file anyone can read from DevTools, so it is not a secret after deploy — whoever opens the page can authenticate as that account. The fix is a backend proxy holding the credential and exposing only the simulate route; until then treat it as rotatable and compromised, exactly like `API_KEY` in `auth.js`.

CORS was verified for `http://localhost`: the preflight reflects back whatever `Access-Control-Request-Headers` asks for, so `authorization` passes. A different serving origin has to be allowed by that API or every call fails as a `TypeError`, indistinguishable from being offline.

The token is kept **in memory only** — not `localStorage`, which holds the CRM's own session for a different service. Its validity is not tracked: it is reused until the server answers 401, which re-logs in and repeats the call exactly once.

Reading the response: `opcoesDaSimulacao()` returns one block *per bank that has offers*, ordered best-`liquidAmount`-first, each carrying its `banco` (`bankName`). That grouping is what lets two banks both offering 36x show up as distinct choices instead of two identical lines. (An earlier version flattened everything and deduplicated by `installments`; the grouping replaced it and no longer throws the weaker bank's terms away.)

**The bank is named on the operator's screens and never in the client's text.** The wizard's offer list, the selection summary, the step-4 recap and the proposal-modal notice all show `banco`; `montarMensagemOfertas()` numbers the same blocks as **"Opção 1", "Opção 2"**. The split is deliberate — the operator needs to know which bank they are selling, the client does not — so anything new that renders offers must pick a side, and the message builder is the one that must stay anonymous.

The text comes from `montarMensagemOfertas()` in `app.js`, shared with the Telegram path so the client sees the same wording either way — it takes blocks, and the Telegram side passes a single one. The `Opção N` header is printed **only when there is more than one block**: with one bank it separates nothing and the message stays exactly as it was. `MENSAGEM_SEM_OFERTA` is shared for the same reason.

When there are no offers, the reasons from the refused banks (plus `barriers`) go to the modal's `#avisoProposta` for the operator — reasons only, still no bank names. On any failure the Telegram paste-and-parse path is left intact as the fallback, and the error copy says so.

One interaction this created: `colarTelegramAutomaticamente()` used to auto-run `gerarProposta()` after pasting, which would silently overwrite the message the API had just written the moment the operator touched the Telegram field. It now only auto-generates when `#mensagemProposta` is still empty; the button remains for doing it on purpose.

### Contract wizard (`assets/js/contrato.js`)

**Gerar contrato** opens a four-step modal; no step advances until it is valid. Every route below was confirmed against the live API, and they all go through `chamarOpenCredit()` in `simulacao.js` (one token, 401 → re-login → retry once).

1. **Oferta** — the offer list, rendered as radio buttons, with **Copiar** / **WhatsApp** in the footer (same text and same helpers as the proposal screen). Exactly one must be picked, and advancing sends the selection to the API before moving on. The list comes from `obterSimulacao()`, which keeps one simulation **per CPF in memory**: `POST /simulate` is the slowest call in the flow and both screens ask for the same thing, so opening the wizard right after a proposal reuses that list instead of querying again. The panel says when it is reusing and offers **Consultar novamente**, which forces a fresh call — and clears the current selection first, since a new query can hand back different ids. Creating a contract drops the CPF from the cache. **`POST /simulate/:simulationId/select` runs when leaving step 1, and has to stay there.** Step 2 depends on it: the `pendingFields` that `/clients/validate?stage=propose` returns depend on the bank behind the chosen offer, so without the selection registered the form asks for the wrong documents. (It was briefly moved to just before `POST /proposals` — a probe had shown validate answering for a CPF that never went through a select, which only proves it answers *something*, not that it answers the right thing. Don't move it again.)

`contratoSelecaoConfirmada` guards the call, so going back and forward with the same offer doesn't re-send it; changing the offer clears the flag and the new choice is registered.

**`simulationId` is per bank, not per query** — `banks[]` carries one each — so the id sent to `/select` always comes from the same block as the chosen offer.
2. **Cadastro** — `GET /clients?cpf=` and `GET /clients/validate?cpf=&stage=propose`, fired together with `Promise.all`. **Only the restricted fields are shown**: `pendingFields` become required inputs validated against **the `regex` the API ships with each field**, and the rest of the record — already correct on the server — is not repeated on screen. Restrictions go in the form header: `validate.reason`, the `barriers` from `/clients`, and the count of blank fields. Advancing sends `PATCH /clients/:cpf` with those values, then re-runs `validate` and only moves on if the API stops reporting pendências; if it doesn't, the form re-renders with whatever is left.
3. **Banco** — pick an account from `client.bankAccounts` or fill the form. Advancing **creates the account** with `POST /clients/:cpf/bank-accounts` and keeps the returned id; nothing else happens here.
4. **Contrato** — a read-only summary of steps 1–3, an editable WhatsApp message, and **Gerar contrato**, which sends `POST /proposals` with **`{simulationId, bankAccountId}`**. No `offerId` in that body — step 1's select is what pinned the offer. The created proposal is rendered through the **same** `renderizarListaPropostas()` as the consultation, marked `recemCriada`, so there is one way a proposal looks on screen and it comes with the same **Enviar link ao cliente** / **Copiar link** buttons. Nothing is sent to the client automatically; the operator presses the button.

**The account has to exist before the proposal**, which is why it gets its own step. The body is `{banco, agencia, conta, contaDigito, tipoConta, operationType, apelido}`, where `banco` is a name ("Itaú") and not a code, `tipoConta` is `CC|CP` and `operationType` is `Pix|Ted|TitularidadeEmpregador`. The API demands only `banco`, `conta` and `tipoConta`; blank optional fields are left out of the body rather than sent empty. That route has no `GET`, which is why existing accounts are read from `client.bankAccounts` in the `/clients` payload.

The id of a freshly created account is kept in `contratoContaCriada`. Without it, going back to step 3 and forward again — or retrying after a failure — would register a **second** identical bank account on the client.

**Copiar / WhatsApp sit in the footer**, and `textoParaEnvioContrato()` picks what they send by step: the offer list (1), one combined request for the missing registration fields *and* the bank account (2), nothing on 3, the summary or signature link (4). Documents and account go out together on purpose — split across two steps, the client would be asked twice and answer twice. The account block is dropped when `client.bankAccounts` is already populated. Step 2's field list comes from `pendingFields`, but through `ROTULOS_CLIENTE`: the API's own `label` is written at the operator ("o número do RG **do cliente**") and reads wrong sent to the client.

Step 3 is the only one without them, and that is decided in `mostrarEtapaContrato()` **from the step number alone**. The CSS default is `display:flex`, so a JS failure leaves the buttons on screen rather than hiding them. An earlier version computed visibility by trying to build the text, which read `#mensagemContrato` — a field created *after* `mostrarEtapaContrato(4)` runs — and left the buttons permanently hidden. Never derive visibility from "can I build the content right now".

**Consultar proposta** exists in two places: step 4 of the wizard, and a button on every Painel card and table detail row that opens `#modalPropostas` directly — checking on a contract should not require walking back into the wizard. Both go through `carregarPropostasEm(caixa, cliente)` and `renderizarListaPropostas(caixa, itens, cliente)`, which take their container and client as arguments precisely so there is no "current client" global deciding what the buttons act on: the client id is written into each button's `onclick`, so a list rendered anywhere behaves the same.

The endpoint is `GET /proposals?cpf=`, which answers `{items:[…], meta:{total,page,limit}}`. Each item is rendered by walking `Object.keys(item)`, not a fixed field list, so a field the API starts returning shows up on its own instead of being silently dropped; `ROTULOS_PROPOSTA` only supplies pt-BR labels, falling back to the raw key. Values are typed by shape rather than by name: anything `http…` becomes a link, ISO dates under `*At`/`*Utc` keys get formatted, `cpf` gets masked.

Each listed proposal that has a `signUrl` gets **Enviar link ao cliente** and **Copiar mensagem**, so a contract created in an earlier session can still be delivered without regenerating anything. Both call `mensagemLinkProposta()` — copying and sending must put the *same* text in front of the client, or the operator who pastes gets a different message from the one the button sends. There is also a small copy button beside the link row itself, right-aligned, for when only the bare URL is wanted. The message carries the link and nothing else — no proposal number, no ids, which are internal. The URL survives the round trip through the `onclick` attribute because `escaparArgumento` escapes it for the JS string and then for HTML (`&` → `&amp;`), and the attribute parser hands the original back to the handler.

Its `try` wraps **only the request**. Wrapped around the rendering too, a mistake while drawing — or in the success toast — would blank the list and report itself as an API failure; that actually happened while this was being built.

The step-4 message is built by `mensagemResumoContrato()` and **rewritten after the proposal is created** so it carries the `signUrl`: before generating it asks the client to confirm, after generating it is the signature link. An earlier version opened WhatsApp by itself right after the POST; that `window.open` ran outside the click gesture and pop-up blockers ate it, so sending is now always a deliberate button press. (`abrirWhatsappComTexto()` still returns the window handle, which is how a blocked open can be detected.) The footer's Copiar/WhatsApp pair is shared with step 1 — `textoParaEnvioContrato()` picks the offer list or this message by step, so two buttons serve both, and they stay visible after the contract is created because that is how the link reaches the client.

What remains unconfirmed in step 3: the **field the creation route returns the id under**. Testing it would write a real bank account onto a real client, so `idDaContaCriada()` accepts the likely spellings and, finding none, stops with a clear message instead of sending the proposal without an account.

The write route is `PATCH /clients/:cpf` — **with the CPF in the path**; `PATCH /clients` alone is a 404, which is what made it look like there was no write route at all. Sending an unknown key makes it answer with the full whitelist, which is how the accepted names were established: `nome, nome_mae, celular, email, data_nascimento, endereco_cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, estado_civil, rg, orgao_emissor, uf_emissor, data_expedicao, genero`. They are snake_case and match `pendingFields[].field` exactly, so the field name from the validation response is sent back verbatim — no translation table to drift.

**Avançar is never disabled** (outside a load). It used to grey out until step 2's fields validated, which left the operator staring at a dead button with nothing saying why. Now the click validates and `avisoContrato` names the offending fields by their `ROTULOS_CLIENTE` label; invalid ones also get a red border, while blank ones stay neutral until the click.

`normalizarCampoPendente()` runs before the regex, and the same normalized value is what the PATCH sends. The API's patterns are literal — `^\d{5,14}$` rejects an RG typed with punctuation, `^(AC|AL|…)$` rejects `mg` in lowercase — so without it the operator types a perfectly correct value and is blocked with no explanation. The rule is derived from the pattern rather than the field name: strip `\d`, quantifiers and anchors, and if nothing is left the field is digits-only (so the mask can be dropped); a pattern with no lowercase range but uppercase literals gets upper-cased. `^\d{2}/\d{2}/\d{4}$` leaves `//` behind and is correctly left alone.

### Telegram proposal parser (`gerarProposta`)

The operator queries a Telegram bot for bank offers, pastes the raw reply into the modal, and this turns it into a client-ready WhatsApp message. Pipeline:

`normalizarRetornoTelegram` (unicode/dash/whitespace cleanup — every regex downstream assumes its output) → `ofertasPaypro` (offers under the "Paypro — ofertas disponíveis" block) → `resumoBancos` (fallback: the per-bank summary lines) → classification cascade.

The cascade order is deliberate, since a single reply can match several patterns:

1. **Offers found** → list every installment option, headline the largest `liberado`. Paypro wins when present; otherwise the bank with the highest released amount.
2. **Timeout** ("banco não respondeu a tempo", "tente novamente…") — checked *before* no-offer, because a retry is still worthwhile.
3. **Not eligible** (explicit text, or `Margem disponível: R$ 0,00`).
4. **No offer** ("nenhum banco disponível", "não aprovado pelo motor de crédito") — distinguishes margin > 0 (worth revisiting) from no margin.
5. Nothing matched → warn that the bot reply looks truncated.

The line regexes are tightly coupled to the bot's exact format (`1 — Banco — 84x R$ 123,45 → R$ 6.789,00`). If the bot's output changes, these are what break. `valorBR` converts pt-BR decimals (`1.234,56`) for comparison; all display strings stay pt-BR formatted.

### Escaping in card markup

Cards are assembled as HTML strings, so anything coming from the spreadsheet must go through a helper — names like `D'Ávila` or `Sant'Ana` are common and used to corrupt the markup:

- `escaparHtml(v)` for text content and plain attribute values.
- `escaparArgumento(v)` for a value landing inside a single-quoted JS string within an `onclick` (escapes for JS first, then for HTML). The browser decodes the entities when parsing the attribute, so the handler receives the original value.

`cliente.id` is exempt — it is `somenteNumeros(cpf)`, and rows without one are dropped at import, so it can only ever be digits.

### Shared predicates

`aguardandoResposta(cliente)` (status `nao` + `contato_inicial_<id>` set) backs the dashboard tile, the card badge, and `filtroAtual == "aguardando"` alike. Any new "which clients count as X" rule belongs in one function for the same reason — these three drifted apart before.

## Conventions

All identifiers, comments, and UI copy are Portuguese (pt-BR) — keep new code in the same language. Dates and times use `toLocaleDateString("pt-BR")` / `toLocaleTimeString("pt-BR")`. Phone numbers are stored formatted (`(11) 91234-5678`) and stripped plus prefixed with `55` only when opening `wa.me`.
