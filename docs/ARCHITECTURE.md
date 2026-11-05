# Umzila: architecture and decisions

Short and opinionated. If the code and this file disagree, fix one of them.

## 1. What it is

A career-route and subject-choice planner for **Grades 9–12, South Africa (CAPS/NSC)**. A learner says what they want to become; Umzila shows the route from their grade to that career: the subjects that keep it open, the marks to aim for, the programmes and their published minimums, deadlines, funding, the post-school training and registration, and the other ways in if plan A fails.

The most important moment is the end of Grade 9, when learners choose between Mathematics and Mathematical Literacy. Umzila makes that choice concrete ("2 of 25 careers stay open"), which serves the same mission as Bonisa.

Separate product, separate repo and deployment (decision: Neo, Nov 2026). Same stack and conventions as Bonisa so the code feels familiar. Intended address: `umzila.magubanelabs.co.za` (or the final product name).

## 2. The loop

```
Ask: "what do you want to become?"  ──►  Career page: route map, subjects, requirements, alternatives, funding
        │                                        │
        ▼                                        ▼
Subjects (pick Maths/Maths Lit + 3 electives) ─► every route updates; closed routes show ✗
        │
        ▼
Marks (term report) ─► APS, NSC pass estimate, gap per programme, "work on X first"
        │
        ▼
My plan (main goal + 2 backups, printable for parents) ─► join a class
        │
        ▼
Teacher: class report, sorted by "needs a conversation"
```

Everything up to "My plan" works **without an account** (kept in the browser). Signing up moves it to the account. Accounts are needed only to keep the plan and share it with a teacher.

## 3. Architecture

```
src/shared   pure TypeScript, no I/O
  data/      careers, programmes (requirements), subjects, funding, sources  ← the product
  engine/    plan.ts (APS, pass estimate, subject checks, programme fit), roadmap.ts, search.ts
  api.ts     zod request schemas + response types
src/server   node:http + node:sqlite (no framework, no ORM). Auth, plans, marks, classes.
src/client   React 19, tiny router, plain CSS with tokens. Uses the same engine as the server.
```

Runtime dependencies: react, react-dom, zod. Dev: esbuild, tsx, typescript.

**Why the engine runs on both sides:** a teacher's class report and a learner's phone must never disagree. One function, `checkProgramme`, decides "meets / close / gap / blocked" everywhere.

### Data rules (see docs/DATA.md)
- A requirement exists in the app only if we read it in a source. Each programme row carries `source`, `intake` year and, when unsure, `review` (shown to learners as "Check this").
- Secondary sources are allowed only with a `review` note. A test enforces this.
- A career's "essential" subject must be required by **every** programme listed for it. A test enforces this (it already caught one overclaim: general BEd does not require Mathematics).
- No LLM generates requirements, dates or advice. If an AI adviser is added later, it explains this data; it never invents it.

### Engine definitions
- **APS:** the common method: the six 20-credit subjects on the 1–7 scale, Life Orientation excluded, max 42 (UP's published method). Universities with their own scales (Wits, UKZN, UCT…) are not modelled yet; the UI says so.
- **Pass estimate:** DBE rules. Bachelor: HL ≥ 40%, four non-LO subjects ≥ 50%, six of seven ≥ 30%. Labelled an estimate.
- **Fit:** `blocked` (missing a required subject) → `incomplete` (marks missing) → `meets` → `close` (every subject within 10 points and APS within 3) → `gap`.
- **Targets:** the minimum of the first (main) programme listed for the career, plus a visible 10-point margin. The text names the programme and the range across others.

### Data model (SQLite, `src/server/db.ts`)
`users` (role learner|teacher, is_minor, guardian name/email, consent version), `sessions` (hashed tokens), `email_codes` (HMAC, 10 min, 5 tries), `email_log`, `app_settings`, `plans` (grade, english_is, maths, electives, careers), `marks` (per grade and term, JSON), `classes` (join code), `class_members`.

`canAccessLearner` in `auth.ts` is the single access rule: the learner, or a verified teacher of an active class they joined.

## 4. Design language: "route map"

A sibling of Bonisa's study desk: same typeface (Instrument Sans), its own ground and its own bold element.

| Token | Hex | Meaning |
|---|---|---|
| ground | `#EDF0F3` | cool map paper |
| sheet | `#FFFFFF` | panels |
| ink / line | `#15191E` | text and the route line |
| here | `#FFD84D` | "you are here" and the one thing to work on next |
| link | `#2347D6` | things you can change |
| open / risk / closed | `#13784A` / `#8F5600` / `#B3261E` | status, always with ✓ ! ✗ and words |

**The one bold thing:** the route map. A transit line from the learner's grade to registration. Grade interchanges, stations for decisions, targets, deadlines and training. A closed route marks ✗ and the line goes dashed from the next phase. Mark targets show a ruler: minimum (solid tick), aim (dashed tick), current mark.

Home opens with the question itself as the hero: "What do you want to become?" with a large underlined input and live results. No illustrations, no card grids: lists are lists.

Phone rules carried over from Bonisa's October 2026 audit (`minmax(0, 1fr)`, wrapping flex bases, full-width fields, wrapping button labels). Checked at 320 and 412 px with no page overflow.

## 5. Not built yet (on purpose)
- University-specific APS scales (Wits, UKZN, UCT FPS).
- More institutions per career (target: at least one university, one university of technology and one TVET route each).
- Application calendar with email reminders.
- A bursary directory beyond NSFAS, Funza Lushaka and Thuthuka.
- Sign-in shared with Bonisa, and "practise this on Bonisa" links from mark targets.
- Billing. The pilot is free; price it with pilot schools (docs/BUSINESS.md).
- Any AI adviser.

## 6. Before real learners use it
- **Verify every `review` row** against the official prospectus (list on `/sources` and in docs/DATA.md).
- **POPIA:** under-18s sign up with a guardian's name and email; the guardian is emailed once confirmed. Get the privacy notice reviewed, sign a DPA with the email provider, and record the hosting region (render.yaml: Frankfurt).
- Re-check every requirement each year when new prospectuses come out (usually early in the year before intake).
