# Deploying Umzila on umzila.magubanelabs.co.za

Same setup as Bonisa: GitHub → Render (Frankfurt, persistent disk for SQLite) → Cloudflare DNS. It launches as an **invite-only pilot**: learners need a class code from a teacher or an `INVITE_CODES` code, and teachers need an `EDUCATOR_CODES` code.

## Stage 1: GitHub

1. On github.com, create a **private** repository named `umzila` under `Nmagubane`. Leave it empty: no README, licence or .gitignore.
2. In PowerShell:

```powershell
cd C:\Users\neoma\dev\Education\umzila
git init -b main
git add .
git status          # check that src/shared/data/ is listed, and node_modules, dist and data are not
git commit -m "Umzila: first version"
git remote add origin https://github.com/Nmagubane/umzila.git
git push -u origin main
```

## Stage 2: Render

1. **Render** → **New** → **Blueprint** → connect the `umzila` repo. Render reads `render.yaml` and proposes a web service called `umzila` in Frankfurt with a 1 GB disk.
2. Fill in the secrets it asks for:

| Key | Value |
|---|---|
| `INVITE_CODES` | One or two codes for learners without a class, e.g. `UMZILA-PILOT` |
| `EDUCATOR_CODES` | A private code for teachers, e.g. `TEACH-UMZILA-2027`. Different from Bonisa's. |
| `PUBLIC_URL` | `https://umzila.magubanelabs.co.za` |
| `CONTACT_EMAIL` | `privacy@magubanelabs.co.za` |
| `EMAIL_API_KEY` | Your Brevo API key (the same one Bonisa uses is fine) |
| `EMAIL_FROM` | The sender address already verified in Brevo for Bonisa |

3. **Apply**. The first build takes a few minutes.

**Check:** `https://umzila.onrender.com/api/health` shows `{"ok":true}`. In the Render **Logs**, the startup lines say `Sign-up: invite` and `Email: brevo`.

## Stage 3: the address

Render's free Hobby workspace includes two custom domains, and Bonisa uses both, so this third one costs $0.25 a month (added 6 Nov 2026). The Cloudflare record is DNS only, like `learn`.

1. **Render** → `umzila` → **Settings** → **Custom Domains** → **Add** `umzila.magubanelabs.co.za`. Render shows a CNAME target (`umzila.onrender.com`).
2. **Cloudflare** → `magubanelabs.co.za` → **DNS** → **Add record**: type `CNAME`, name `umzila`, target the value Render showed. **Proxy status: the same as your `learn` record.**
3. Wait for Render to show **Verified** and **Certificate issued**.

**Check:**
- `https://umzila.magubanelabs.co.za/api/health` shows `{"ok":true}`.
- The home page loads, and searching "doctor" opens the doctor route.
- Create a teacher account with the educator code. The 6-digit code arrives by email from "Umzila". Create a class.
- In a private window, sign up as a learner with that class code (choose "under 18" and use a second email address of yours as the guardian). The guardian email arrives after you confirm. The learner appears in the class report.

## Before you hand codes to a school
- Hand-check the UP rows and the five flagged rows (`docs/DATA.md`). The `/sources` page lists what is still to confirm.
- Optional demo data: Render → **Shell** → `npm run seed:demo`. **Only on a pilot you're showing, never on a database real learners use.**

## Notes
- Like Bonisa, this needs a paid instance because of the disk: a second monthly Render charge.
- If the product is renamed, add the new subdomain in Render and Cloudflare. The old one can redirect.
- Backups: the database is one file at `/var/data/umzila.db`. Render disk snapshots cover it; for more, add a scheduled copy later.
