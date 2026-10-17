# Banque de QCM, mode examen, historique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a QCM bank loaded from `qcm/`, pre-start options (shuffle questions/choices, exam mode with timer), exam auto-submit and anti-escape rules, attempt history with progress chart, print/PDF of results, and a "Marquées seulement" navigation filter to the single-file Lucerna app.

**Architecture:** Everything stays in `index.html`. Pure, DOM-free logic moves into a new `<script>` block that defines `window.LucernaCore` (placed before the app IIFE, which uses it). The app keeps its central `state` + full re-render via `render()` + `data-action` click delegation. Tests run in headless Edge/Chrome: a Python runner serves the repo over HTTP, opens `tests/test.html`, which calls `LucernaCore` directly and drives the real app inside an `<iframe>` (same origin, so tests read/write the iframe's `localStorage` and DOM).

**Tech Stack:** Vanilla JS (ES5 style like the existing code: `var`, `function`, string-concatenated HTML), CSS custom properties, Python 3 (test runner only), Microsoft Edge or Chrome headless (already installed on this machine). No npm, no libraries.

**Spec:** `docs/superpowers/specs/2026-10-18-banque-examen-historique-design.md`

## Global Constraints

- One self-contained `index.html`; data files in `qcm/`. No build step, no new CDN libraries.
- All UI copy in French. Reuse CSS tokens (`--ink`, `--surface`, `--accent`, `--gold`, `--gold-soft`, `--gold-ink`, `--success`, `--danger`, …) and existing classes (`.card`, `.btn*`, `.status-pill`, `.modal-back`/`.modal`).
- Every string coming from a quiz JSON (bank or import) goes through `esc()` before it is concatenated into HTML.
- Bank files load with **relative** URLs (`qcm/index.json`, `qcm/<file>`) — the site is served under `/lucerna/` on GitHub Pages.
- Default exam duration: **1 h 30** (90 min). Accepted range: **1 to 600 minutes**.
- Timer warning threshold: **5 minutes** remaining.
- Exam deadline is absolute: `deadline = startedAt + durationMin * 60000`, persisted in the session.
- Storage keys: session `lucerna:quiz-session:v2` (migrate and remove `lucerna:quiz-session:v1`), history `lucerna:history:v1`, theme `lucerna:theme` (unchanged).
- Quiz identity for history: bank quiz → `"bank:" + fileName` (e.g. `bank:ccdv-f.json`); imported quiz → `"import:" + title`.
- Remove `DEMO_QUIZ` and the « Essayer avec un exemple » button.
- Exact copy fixed by the spec: « Banque indisponible hors ligne — importez un fichier JSON », « Mélanger les questions », « Mélanger les choix de réponse », « Mode examen avec minuteur », « Abandonner l'examen », « Marquées seulement », « Imprimer / PDF », « Mes résultats », « Effacer l'historique », « Dernier : X % · Meilleur : Y % », letter reminder « B (D dans l'explication) ».

## Review Focus

1. **Bank unreachable** (page opened via `file://`, manifest 404, one bad file in the manifest): the home page still renders, the import dropzone still works, the valid bank files still show. → Task 3, tests `bank: manifest missing shows offline message and import still works` and `bank: invalid file is skipped, valid ones shown`.
2. **Reload on the results screen** (or reopen after auto-submit): the attempt must not be recorded twice. → Task 6, test `history: reload on results does not record twice`.
3. **Flag filter edge cases**: no flagged questions; un-flagging the current question while filtered. → Task 8, tests `flag filter: disabled with no flags` and `flag filter: unflag current keeps position, next skips to flagged`.
4. **Old v1 session in localStorage** from the current production app: it must resume, not crash. → Task 2, test `session: v1 session migrates to v2`.
5. **Bad duration input** (0, empty, letters, > 10 h): start is blocked with a French error message, nothing is saved. → Task 4, test `options: invalid duration blocks start`.

---

### Task 1: Headless browser test harness

**Files:**
- Create: `tests/run_tests.py`
- Create: `tests/test.html`
- Create: `tests/harness.js`
- Create: `tests/smoke.test.js`

**Interfaces:**
- Produces (in `tests/harness.js`, globals on the test page):
  - `test(name: string, fn: async () => void)` — registers a test; runs sequentially; `?grep=<substr>` in the test page URL filters by name.
  - `assert.ok(v, msg)`, `assert.equal(actual, expected, msg)` (strict `===`), `assert.deepEqual(actual, expected, msg)` (JSON comparison), `assert.match(str, regex, msg)`.
  - `app.load(opts?: { storage?: {[key]: any}, query?: string }) -> Promise<{ win, doc }>` — clears `localStorage`, writes each `storage` entry with `JSON.stringify` (strings written as-is), (re)creates the `<iframe id="app-frame">` with `src="../index.html" + (query || "")`, resolves once `#app` has child elements.
  - `app.reload() -> Promise<{ win, doc }>` — reloads the iframe **without** touching `localStorage`.
  - `app.click(selector: string)` — clicks the first match in the iframe doc; throws if none.
  - `app.$(selector)`, `app.$$(selector)` — query helpers on the iframe doc.
  - `app.waitFor(predicate: () => any, timeoutMs = 3000) -> Promise<any>` — polls every 20 ms; rejects with a timeout error.
  - On completion, the page writes `<pre id="results">` (one line per test: `PASS name` / `FAIL name — message`, then `SUMMARY passed=N failed=M`) and sets `document.body.dataset.done = "1"`.
- Produces (runner): `python tests/run_tests.py [--grep TEXT]` — exit code 0 iff `failed=0` and `done` was set.

- [ ] **Step 1: Write the runner and the smoke test**

`tests/run_tests.py`: start `http.server.ThreadingHTTPServer` with `SimpleHTTPRequestHandler` rooted at the repo root on port 0 (free port) in a daemon thread; locate the browser (first that exists: `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`, `C:/Program Files/Microsoft/Edge/Application/msedge.exe`, `C:/Program Files/Google/Chrome/Application/chrome.exe`, then `shutil.which` of `msedge`, `chrome`, `google-chrome`, `chromium`); run it with `--headless=new --disable-gpu --no-first-run --user-data-dir=<tempdir> --virtual-time-budget=120000 --dump-dom http://127.0.0.1:<port>/tests/test.html?grep=<urlencoded>`; print the text of `<pre id="results">` (unescape HTML entities); exit 1 if `data-done="1"` is missing (print "TIMEOUT") or `failed=` is not 0. Silence request logging.

`tests/test.html`: loads `harness.js`, then every `*.test.js` file (listed explicitly with `<script>` tags; later tasks add theirs), then calls `runTests()`.

`tests/smoke.test.js`:

```js
test("smoke: app loads home screen", async function(){
  await app.load();
  assert.ok(app.$("#dropzone"), "dropzone present");
  assert.ok(app.$('[data-action="pick-file"]'), "import button present");
});
```

- [ ] **Step 2: Run it**

Run: `python tests/run_tests.py`
Expected: `PASS smoke: app loads home screen` and `SUMMARY passed=1 failed=0`, exit 0. (This exercises the harness itself against the unchanged app.) Then temporarily change the selector to `#nope`, rerun, confirm `FAIL` + exit 1, and revert.

- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m "test: add headless browser test harness"
```

---

### Task 2: `LucernaCore` pure helpers + session v2 with migration

**Files:**
- Modify: `index.html` (new `<script>` block right before the existing app `<script>`; app IIFE: `normalizeQuiz`, `isCorrectAnswer`, `save`, `loadSavedSession`, `clearSaved`, `resumeSession`, `startQuiz`, `STORAGE_KEY`)
- Create: `tests/core.test.js`, `tests/session.test.js`; Modify: `tests/test.html`

**Interfaces:**
- Produces `window.LucernaCore`:
  - `shuffle(arr: any[], rand?: () => number) -> any[]` — new array, Fisher–Yates; `rand` defaults to `Math.random`.
  - `choiceLetter(i: number) -> string` — `"A"` for 0 (moved here from the IIFE; the IIFE uses `LucernaCore.choiceLetter`).
  - `prepareQuiz(quiz, opts: { shuffleQuestions: bool, shuffleChoices: bool }, rand?) -> quiz` — deep copy; permutes `questions` and/or each question's `choices`; never mutates the input.
  - `isCorrect(selected: string[], correctAnswers: string[]) -> bool` — order-insensitive exact set match; `false` when `selected` is empty.
  - `parseDuration(hours: string|number, minutes: string|number) -> { ok: true, minutes: number } | { ok: false, error: string }` — empty field counts as 0; non-integer or negative → error « Durée invalide : utilisez des nombres entiers. »; total outside 1..600 → error « La durée doit être comprise entre 1 minute et 10 heures. ».
  - `formatClock(ms: number) -> string` — `"1:30:00"` when ≥ 1 h, else `"4:05"`; values ≤ 0 → `"0:00"`; rounds **up** to the second (so 1 ms left shows `"0:01"`).
  - `formatDuration(ms: number) -> string` — `"1 h 12 min"`, `"12 min 5 s"`, `"45 s"`.
  - `nextIndex(current: number, dir: 1|-1, allowed: number[]) -> number` — nearest allowed index strictly after/before `current` in `dir`, or `-1`.
- `normalizeQuiz` now also sets `origLetter` on each choice = `choiceLetter(originalIndexInFile)`.
- Session v2 object (`lucerna:quiz-session:v2`): `{ quiz, quizId, options: { shuffleQuestions, shuffleChoices, exam, durationMin }, current, answers, flags, visited, startedAt, deadline (number|null), submittedAt, screen, timeExpired (bool), recorded (bool), flagFilter (bool) }`. New `state` fields with the same names: `quizId`, `options`, `deadline`, `timeExpired`, `recorded`, `flagFilter`.
- `loadSavedSession()` returns a v2-shaped object or `null`; when only v1 exists it converts it (`quizId = "import:" + quiz.title`, `options = { shuffleQuestions:false, shuffleChoices:false, exam:false, durationMin:90 }`, `deadline:null`, `timeExpired:false`, `recorded: screen === "results"`, `flagFilter:false`, `origLetter` filled by position for each choice), writes it under v2 and removes v1.

- [ ] **Step 1: Write the failing tests**

`tests/core.test.js` (call through `app.load()` then `var C = app.win.LucernaCore`):

```js
test("core: shuffle is a permutation and does not mutate", ...)   // shuffle([1,2,3,4], seq) sorted deepEqual [1,2,3,4]; input unchanged
test("core: prepareQuiz keeps ids, origLetter and answers", ...)  // with rand=()=>0: questions reversed-order permutation; every choice keeps id+origLetter; correctAnswers unchanged; input quiz unchanged
test("core: isCorrect", ...)       // (["B","A"],["A","B"]) true; (["A"],["A","B"]) false; ([],["A"]) false
test("core: parseDuration", ...)   // ("1","30") → {ok:true,minutes:90}; ("","45") → 45; ("0","0") not ok; ("10","1") not ok; ("1.5","0") not ok; ("abc","") not ok; ("10","0") → 600
test("core: formatClock", ...)     // 5400000 → "1:30:00"; 245000 → "4:05"; 1 → "0:01"; -5 → "0:00"
test("core: formatDuration", ...)  // 4320000 → "1 h 12 min"; 725000 → "12 min 5 s"; 45000 → "45 s"
test("core: nextIndex", ...)       // (2,1,[0,3,5]) → 3; (3,-1,[0,3,5]) → 0; (5,1,[0,3,5]) → -1; (2,1,[]) → -1
```

`tests/session.test.js`:

```js
test("session: v1 session migrates to v2", async function(){
  await app.load({ storage: { "lucerna:quiz-session:v1": {
    quiz: { title:"Ancien", description:"", questions:[
      { id:1, question:"Q1", choices:[{id:"A",text:"a"},{id:"B",text:"b"}], correctAnswers:["B"], explanation:null, image:null, category:null, difficulty:null } ] },
    current:0, answers:{"1":["A"]}, flags:{}, visited:{"1":true}, startedAt: 1, submittedAt:null, screen:"quiz" } } });
  app.click('[data-action="resume"]');
  await app.waitFor(function(){ return app.$("#question-card"); });
  var v2 = JSON.parse(app.win.localStorage.getItem("lucerna:quiz-session:v2"));
  assert.equal(v2.quizId, "import:Ancien");
  assert.equal(v2.options.exam, false);
  assert.equal(v2.quiz.questions[0].choices[1].origLetter, "B");
  assert.equal(app.win.localStorage.getItem("lucerna:quiz-session:v1"), null);
});
test("session: corrupted v2 is ignored", ...) // storage v2 = "not json{" → home renders, no resume banner, no throw
```

Add both files to `tests/test.html`.

- [ ] **Step 2: Run to verify they fail**

Run: `python tests/run_tests.py --grep core` then `--grep session`
Expected: FAIL (`LucernaCore` undefined; v2 key absent).

- [ ] **Step 3: Implement `LucernaCore` and session v2** in `index.html` as specified in Interfaces. `isCorrectAnswer(q)` in the IIFE delegates to `LucernaCore.isCorrect`. `startQuiz` initializes the new state fields with defaults (options default `{ shuffleQuestions:false, shuffleChoices:false, exam:false, durationMin:90 }`; Task 4 replaces this).

- [ ] **Step 4: Run all tests**

Run: `python tests/run_tests.py`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/
git commit -m "feat: add LucernaCore helpers and session v2 with v1 migration"
```

---

### Task 3: QCM bank on the home page (remove demo)

**Files:**
- Modify: `index.html` (home render, init, data-actions; delete `DEMO_QUIZ` and `try-demo`)
- Create: `qcm/index.json` (`["ccdv-f.json"]`), add existing `qcm/ccdv-f.json` to git
- Create: `tests/fixtures/bank-ok/index.json` (`["good.json", "bad.json", "missing.json"]`), `tests/fixtures/bank-ok/good.json` (valid, 2 questions, title `"Fixture QCM"`, description containing `<b>x</b>` to test escaping), `tests/fixtures/bank-ok/bad.json` (`{"questions": []}`)
- Create: `tests/bank.test.js`; Modify: `tests/test.html`

**Interfaces:**
- Consumes: `validateQuiz`, `normalizeQuiz` (existing).
- Produces:
  - Manifest URL: `new URLSearchParams(location.search).get("bank")` if present, else `"qcm/index.json"`. Quiz file URL = manifest's directory + file name (e.g. `tests/fixtures/bank-ok/good.json`).
  - `state.bank = { status: "loading" | "ready" | "error", items: Array<{ file: string, quizId: string, quiz }> }`; `quizId = "bank:" + file`.
  - `loadBank() -> void` — called once at init; fetches the manifest and each file in parallel; invalid/unreachable files are skipped with `console.warn`; sets `status` and re-renders.
  - Bank card markup: `<button class="card bank-card" data-action="open-bank" data-file="<file>">` showing title, description, `N questions`. Clicking sets `state.importPreview = quiz` and `state.previewQuizId = "bank:" + file`; a manual import sets `state.previewQuizId = "import:" + title`. `startQuiz` stores it as `state.quizId`.
  - Offline/error message element: `<div id="bank-offline">Banque indisponible hors ligne — importez un fichier JSON</div>`.

- [ ] **Step 1: Write the failing tests** (`tests/bank.test.js`)

```js
test("bank: lists quizzes from manifest", ...)
  // app.load({query:"?bank=tests/fixtures/bank-ok/index.json"}); waitFor .bank-card
  // exactly 1 .bank-card; text contains "Fixture QCM" and "2 questions"; innerHTML contains "&lt;b&gt;" (escaped)
test("bank: invalid file is skipped, valid ones shown", ...)   // same load: 1 card, no #bank-offline
test("bank: manifest missing shows offline message and import still works", ...)
  // query "?bank=tests/fixtures/nope/index.json"; waitFor #bank-offline; #dropzone and [data-action="pick-file"] present
test("bank: open card shows preview and starts quiz with bank quizId", ...)
  // click .bank-card → [data-action="begin-imported"] visible → click → waitFor #question-card;
  // session v2 quizId === "bank:good.json"
test("bank: real manifest lists CCDV-F", ...)                   // app.load() default; a card contains "91 questions"
test("bank: demo button removed", ...)                          // no [data-action="try-demo"]
```

- [ ] **Step 2: Run to verify they fail**

Run: `python tests/run_tests.py --grep bank`
Expected: FAIL (no `.bank-card`).

- [ ] **Step 3: Implement** the bank as specified. Layout on home (builder's call within the existing style): bank section first, below the resume banner; the import hero/dropzone stays beside or below it; the preview card keeps its position. Keep the three feature cards or adapt their copy — builder's call. Update `injectResponsiveTweaks` for any new grid.

- [ ] **Step 4: Run all tests**

Run: `python tests/run_tests.py`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html qcm/ tests/
git commit -m "feat: add QCM bank loaded from qcm/index.json, remove demo quiz"
```

---

### Task 4: Pre-start options + shuffle + letter reminder in correction

**Files:**
- Modify: `index.html` (preview card, `startQuiz`, `retakeSameQuiz`, `renderQuestionCard`, `renderCorrection`, a document `change` listener)
- Create: `tests/options.test.js`; Modify: `tests/test.html`

**Interfaces:**
- Consumes: `LucernaCore.prepareQuiz`, `LucernaCore.parseDuration`, `LucernaCore.choiceLetter`, `state.previewQuizId` (Task 3).
- Produces:
  - `state.launch = { shuffleQuestions:false, shuffleChoices:false, exam:false, hours:"1", minutes:"30" }` — reset whenever a new preview opens; kept across re-renders.
  - Preview inputs, each with `data-launch="<field>"`: checkboxes `#opt-shuffle-q`, `#opt-shuffle-c`, `#opt-exam`; number inputs `#opt-hours`, `#opt-minutes` (shown only while `#opt-exam` is checked). A document `change`/`input` listener copies `[data-launch]` values into `state.launch`; it re-renders only when `exam` toggles.
  - `startQuiz(quiz, quizId, options)` — `options = { shuffleQuestions, shuffleChoices, exam, durationMin }`; stores `state.quiz = LucernaCore.prepareQuiz(quiz, options)`, `state.quizId`, `state.options`; `deadline` is set in Task 5 (leave `null` here).
  - On « Commencer le QCM » with exam checked and `parseDuration` not ok: no start, `state.error = <message>` shown in the preview card (`#launch-error`), nothing saved.
  - `retakeSameQuiz()` calls `startQuiz(state.quiz, state.quizId, state.options)` (new shuffle draw when enabled).
  - Correction: each answer line shows `<positional letter>. <text>`, where positional letter = `choiceLetter(index in state.quiz's choice order)`; when it differs from `choice.origLetter`, append `<span class="orig-letter"> (<origLetter> dans l'explication)</span>`.

- [ ] **Step 1: Write the failing tests** (use `?bank=tests/fixtures/bank-ok/index.json`; helper in the file: `openFixturePreview()` loads and clicks the card)

```js
test("options: defaults", ...)  // #opt-shuffle-q/#opt-shuffle-c/#opt-exam unchecked; check #opt-exam (dispatch change) → #opt-hours.value "1", #opt-minutes.value "30"
test("options: invalid duration blocks start", ...)
  // check exam; set #opt-hours "0", #opt-minutes "0" (dispatch input); click begin → #launch-error text matches /entre 1 minute et 10 heures/;
  // no #question-card; localStorage v2 key null
test("options: shuffle choices keeps letters positional and shows reminder", ...)
  // check #opt-shuffle-c; begin; override app.win.Math.random = function(){return 0;} BEFORE clicking begin
  // question card's first .choice-mark text === "A"; answer, submit (confirm if needed), results:
  // some .orig-letter text matches /\([A-D] dans l'explication\)/
test("options: no shuffle → no reminder", ...)   // begin without options, submit → no .orig-letter
test("options: retake keeps options", ...)       // start with shuffle-q checked → submit → retake → session v2 options.shuffleQuestions === true
```

- [ ] **Step 2: Run to verify they fail**

Run: `python tests/run_tests.py --grep options`
Expected: FAIL (no `#opt-shuffle-q`).

- [ ] **Step 3: Implement** as specified. Note `Math.random` is read at call time inside `prepareQuiz` (use `rand || Math.random` at call time, not captured at definition) so the test override works.

- [ ] **Step 4: Run all tests**

Run: `python tests/run_tests.py`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/
git commit -m "feat: add pre-start options with question/choice shuffle"
```

---

### Task 5: Exam mode — timer, auto-submit, reload and abandon rules

**Files:**
- Modify: `index.html` (`startQuiz`, quiz/review top bars, `doSubmit`, init, `renderHome` resume banner, results header, new modal, timer tick)
- Create: `tests/exam.test.js`; Modify: `tests/test.html`

**Interfaces:**
- Consumes: `LucernaCore.formatClock`, `LucernaCore.formatDuration`, session v2 fields.
- Produces:
  - `startQuiz` sets `state.deadline = options.exam ? state.startedAt + options.durationMin * 60000 : null`.
  - Timer element `<span id="exam-timer">` in the quiz and review top bars, text `formatClock(deadline - Date.now())`; class `warn` when ≤ 300000 ms (style with `--danger`/`--danger-soft`). Updated by a single `setInterval(tickTimer, 1000)` that only rewrites `#exam-timer` (no full render) and calls `doSubmit({ expired: true })` when time is up.
  - `doSubmit(opts?: { expired?: bool })` — sets `state.timeExpired = !!opts.expired`; no confirmation modal when expired. (History recording hooks in here in Task 6.)
  - Init rule: saved v2 session with `options.exam` and no `submittedAt`: if `Date.now() >= deadline` → restore it and `doSubmit({ expired:true })`; else restore it straight into its saved screen (`quiz` or `review`) — no banner. Non-exam sessions keep the current banner behaviour (« Reprendre / Ignorer »).
  - Button `data-action="abandon-exam"` « Abandonner l'examen » in the quiz and review screens (exam only) → modal (`role="alertdialog"`) with `data-action="confirm-abandon"` / `data-action="cancel-abandon"`; confirm → `doSubmit()`.
  - Results (exam only): `#exam-summary` showing « Temps écoulé » pill when `timeExpired`, and « Temps utilisé : <formatDuration(min(submittedAt, deadline) - startedAt)> ».
  - In exam mode the quiz/review top bars do not offer any way home other than abandon (« Importer un autre QCM » only exists on results).

- [ ] **Step 1: Write the failing tests**

Helper: `examSession(overrides)` builds a v2 session object for the fixture quiz with `options.exam = true`, `durationMin = 90`, `startedAt = Date.now() - 1000`, `deadline = startedAt + 5400000`, `screen = "quiz"`, `recorded = false`, `submittedAt = null`.

```js
test("exam: timer shown and formatted", ...)          // start via preview with #opt-exam checked → #exam-timer text matches /^1:(29|30):\d\d$/
test("exam: warning under 5 minutes", ...)            // load storage v2 = examSession({deadline: Date.now()+120000}) → #exam-timer has class "warn"
test("exam: reload goes straight back into quiz", ...)// load storage v2 = examSession() → #question-card present, no [data-action="resume"]
test("exam: expired on load is auto-submitted", ...)  // examSession({deadline: Date.now()-1000}) → waitFor #exam-summary; text contains "Temps écoulé"; session v2 submittedAt not null, timeExpired true
test("exam: expires while open", ...)                 // examSession({deadline: Date.now()+1500}) → waitFor #exam-summary within 5000 ms; no confirm modal
test("exam: abandon asks confirmation then submits", ...)
  // examSession() → click abandon-exam → [data-action="confirm-abandon"] present → click → waitFor results; timeExpired false
test("exam: non-exam session keeps resume banner", ...) // v2 session with options.exam false → [data-action="resume"] present
```

- [ ] **Step 2: Run to verify they fail**

Run: `python tests/run_tests.py --grep exam`
Expected: FAIL.

- [ ] **Step 3: Implement** as specified.

- [ ] **Step 4: Run all tests**

Run: `python tests/run_tests.py`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/
git commit -m "feat: add exam mode with persistent timer, auto-submit and abandon"
```

---

### Task 6: Attempt history, bank card scores, progress chart

**Files:**
- Modify: `index.html` (`LucernaCore`, `doSubmit`, home render, new modal, data-actions)
- Create: `tests/history.test.js`; Modify: `tests/test.html`

**Interfaces:**
- Consumes: `computeResults()`, `state.quizId`, `state.options`, `state.timeExpired`, `state.recorded`.
- Produces:
  - Attempt: `{ id: string (= quizId + "@" + startedAt), quizId, title, date: submittedAt (ms), pct, correct, incorrect, unanswered, total, exam: bool, timeExpired: bool, usedMs: number, shuffleQuestions: bool, shuffleChoices: bool }`.
  - `LucernaCore.summarize(attempts, quizId) -> { count, last: number|null, best: number|null }` (`last` = pct of the most recent by `date`).
  - `loadHistory() -> Attempt[]`, `saveHistory(list)` on key `lucerna:history:v1` (try/catch like `save()`); keep the 500 most recent.
  - `recordAttempt()` — called from `doSubmit`; no-op when `state.recorded`; also no-op if an attempt with the same `id` already exists; then sets `state.recorded = true` and `save()`s.
  - Bank card adds `<div class="bank-score">Dernier : X % · Meilleur : Y %</div>` when `count > 0`.
  - Home section `#history` titled « Mes résultats » (hidden when empty): one `.history-row` per attempt, most recent first (title, date `toLocaleString("fr-FR")`, pct, `correct/total`, an « Examen » pill when `exam`, « Temps écoulé » when `timeExpired`); one inline SVG line chart per quiz with ≥ 2 attempts (`<svg class="history-chart">`, y 0–100 %, points in date order, colors from tokens so it works in both themes); button `data-action="clear-history"` « Effacer l'historique » → confirm modal (`data-action="confirm-clear-history"` / `cancel-clear-history`).

- [ ] **Step 1: Write the failing tests**

```js
test("core: summarize", ...)  // attempts for q1 dated 1,2,3 with pct 50,80,60 + one other quizId → {count:3,last:60,best:80}; unknown id → {count:0,last:null,best:null}
test("history: submit records one attempt", ...)
  // fixture bank → start → answer Q1 → review → submit → confirm → history length 1, quizId "bank:good.json", total 2
test("history: reload on results does not record twice", ...)  // after the above: app.reload() → still length 1
test("history: expired exam recorded once with timeExpired", ...) // load examSession({deadline: past}) → length 1, timeExpired true
test("history: bank card shows last and best", ...)
  // storage history = two attempts for "bank:good.json" pct 40 (date 1) and 70 (date 2) → .bank-score text "Dernier : 70 % · Meilleur : 70 %"
test("history: list and chart", ...)       // same storage → 2 .history-row, first contains "70"; one svg.history-chart
test("history: clear asks confirmation", ...) // click clear-history → confirm-clear-history → no #history, storage key empty or "[]"
```

- [ ] **Step 2: Run to verify they fail**

Run: `python tests/run_tests.py --grep history` and `--grep summarize`
Expected: FAIL.

- [ ] **Step 3: Implement** as specified.

- [ ] **Step 4: Run all tests**

Run: `python tests/run_tests.py`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/
git commit -m "feat: add attempt history with scores on bank cards and progress chart"
```

---

### Task 7: Print / PDF of results

**Files:**
- Modify: `index.html` (results buttons, `renderCorrection`, `<style>` `@media print`, data-actions)
- Create: `tests/print.test.js`; Modify: `tests/test.html`

**Interfaces:**
- Produces:
  - Button `data-action="print"` « Imprimer / PDF » on results.
  - `state.printing` (bool): when true, `renderCorrection` ignores `correctionFilter` and renders every question. Action `print`: set `printing = true`, `render()`, `window.print()`, then on `afterprint` (and right after `print()` returns, as a fallback) set `printing = false` and `render()`.
  - Print header `<div class="print-only" id="print-header">` on results: quiz title, date `toLocaleString("fr-FR")`, score `correct/total — pct %`, the three counts, « Temps écoulé » when relevant.
  - `@media print`: hide `.topbar`, `.btn`, `.modal-back`, `[data-action]` controls and the score ring area; show `.print-only` (hidden on screen); force light tokens on `:root` regardless of `data-theme`; `.card { break-inside: avoid; box-shadow: none; }`.

- [ ] **Step 1: Write the failing tests**

```js
test("print: prints all questions even when filtered", ...)
  // fixture quiz, answer Q1 correctly, leave Q2, submit → click filter-incorrect →
  // var count; app.win.print = function(){ count = app.$$(".correction-item").length; };
  // click [data-action="print"] → assert count === 2 (renderCorrection items need class "correction-item")
test("print: header present", ...)  // #print-header text contains "Fixture QCM" and "%"
```

- [ ] **Step 2: Run to verify they fail**

Run: `python tests/run_tests.py --grep print`
Expected: FAIL.

- [ ] **Step 3: Implement** as specified. Add class `correction-item` to each correction card.

- [ ] **Step 4: Run all tests, then check the print preview manually once**

Run: `python tests/run_tests.py` → all PASS. Then `python -m http.server 8000`, open `http://localhost:8000/`, finish a quiz, click « Imprimer / PDF » and confirm the preview shows header + full correction, no buttons, light theme even when the app is in dark mode.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/
git commit -m "feat: add print/PDF export of results"
```

---

### Task 8: « Marquées seulement » navigation filter

**Files:**
- Modify: `index.html` (`renderNavGrid`, quiz footer prev/next, keydown handler, data-actions)
- Create: `tests/flagfilter.test.js`; Modify: `tests/test.html`

**Interfaces:**
- Consumes: `LucernaCore.nextIndex`, `state.flagFilter` (persisted in session v2).
- Produces:
  - Toggle button `data-action="toggle-flag-filter"` « Marquées seulement » in the nav grid header, `aria-pressed`; `disabled` when no question is flagged (and `state.flagFilter` is then forced to `false`).
  - When on: the grid shows only flagged questions; Prev/Next and ArrowLeft/ArrowRight go to `nextIndex(current, ±1, flaggedIndices)`; buttons are disabled when that returns `-1`. Un-flagging the current question keeps `current` unchanged.
  - Off: current behaviour.

- [ ] **Step 1: Write the failing tests** (use a fixture with ≥ 4 questions: add `tests/fixtures/bank-ok/four.json` to the fixture manifest only if needed — or build a v2 session in storage with a 4-question quiz)

```js
test("flag filter: disabled with no flags", ...)          // toggle button has disabled attribute
test("flag filter: grid and next restricted to flagged", ...)
  // flags {"2":true,"4":true}, current 0 → toggle → 2 .qbadge; click next → "Question 2 / 4"; next → "Question 4 / 4"; next disabled
test("flag filter: unflag current keeps position, next skips to flagged", ...)
  // flags {"1":true,"2":true,"4":true}, filter on, current 1 (Question 2) → toggle-flag (unflag) → still "Question 2 / 4"; next → "Question 4 / 4"
test("flag filter: arrow keys follow filter", ...)        // dispatch keydown ArrowRight on app.doc → same as next
```

- [ ] **Step 2: Run to verify they fail**

Run: `python tests/run_tests.py --grep "flag filter"`
Expected: FAIL.

- [ ] **Step 3: Implement** as specified.

- [ ] **Step 4: Run all tests**

Run: `python tests/run_tests.py`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/
git commit -m "feat: add flagged-only navigation filter"
```

---

### Task 9: Documentation and final verification

**Files:**
- Modify: `README.md`, `CLAUDE.md` (gitignored — update locally, not committed)

- [ ] **Step 1: Update `README.md`** — replace `lucerna.html` with `index.html`; démarrage rapide via GitHub Pages and via `python -m http.server` locally (bank needs HTTP); new sections: Banque de QCM (format of `qcm/index.json`, how to add a quiz), Options de lancement, Mode examen (reload/abandon/expiry rules), Historique, Impression / PDF, filtre « Marquées seulement », Tests (`python tests/run_tests.py`, requires Edge or Chrome); remove the demo mention; move ideas 2–4 out of « Idées d'évolution » (keep idea 1); add history to « Limites connues »; update the Sommaire.

- [ ] **Step 2: Update `CLAUDE.md`** — test command and harness description, `LucernaCore` block, bank manifest + `?bank=` override, session v2 / history keys, exam rules.

- [ ] **Step 3: Full verification**

Run: `python tests/run_tests.py`
Expected: all PASS. Then manual pass with `python -m http.server 8000`: home in light/dark and at 375 px width; CCDV-F card; exam with 1-minute duration expires and records; open `index.html` by double-click → offline message, import works.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document bank, exam mode, history, print and tests"
```
