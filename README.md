# Umzila

**By Magubane Labs.** Tell us what you want to become, and Umzila shows the route from Grade 9 to that career: the subjects that keep it open, the marks to aim for, where to study and what they ask for, how to pay for it, how long it takes to qualify, and the other ways in if plan A fails. Teachers get a class report that shows which learners are about to close the door on their own goal.

*Umzila* is isiZulu for "path". It's a working name: change `Umzila` in `src/client/ui/bits.tsx`, `public/index.html` and the email templates.

## Run it

Needs Node.js 22.13 or newer.

```bash
npm install
npm run seed:demo   # optional: a teacher, a Grade 9 class and 10 learners
npm run dev         # http://localhost:5175
```

Demo logins (password `Demo#Route2026`): teacher `ms.dlamini@demo.umzila.test`, learner `thando@demo.umzila.test`.

Without an email provider, sign-up codes are printed in the server log.

```bash
npm test            # engine, data-integrity and end-to-end API tests
npm run typecheck
npm run build && npm start
```

## Where things are
- `src/shared/data/` holds the career library, programme requirements, subjects, funding and sources. **This is the product.** Read `docs/DATA.md` before editing it.
- `src/shared/engine/` has the APS, pass estimate, subject checks, programme fit, roadmap and search. It's pure and tested, and used by both server and client.
- `src/server/` has auth (email + code, guardian consent for under-18s), plans, marks and classes.
- `src/client/` is the React app. Design notes are in `docs/ARCHITECTURE.md` §4.

## Docs
- `docs/ARCHITECTURE.md`: decisions, data model and design language
- `docs/DATA.md`: sources, what is verified and what must be checked before launch
- `docs/BUSINESS.md`: who pays, pricing hypotheses and the pilot plan

## Deploy
`render.yaml` is a Render Blueprint (Frankfurt, persistent disk). Point `umzila.magubanelabs.co.za` (CNAME) at the Render service and set `PUBLIC_URL` to match.
