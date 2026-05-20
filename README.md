# DryBooks Scrubber

A browser-based QC tool that scrubs DryBooks drying reports against IICRC S500 rules and SLA timestamps to catch issues that will cost you revenue with carriers.

## What it catches

**Timestamp & SLA rules**

- Customer contact > 1 hour after Loss Received
- Customer Called BEFORE Loss Received (data integrity failure)
- Site inspection > 4 hours after Loss Received
- Loss Received before Date of Loss (impossible timeline)
- Loss reported > 48 hours late (carrier challenge risk)

**Equipment & timeline integrity**

- Equipment placed BEFORE site was inspected (backdating signal)
- Equipment placed BEFORE loss was received
- Days to Achieve Dry Standard outside the 5–7 day window
- Extended drying without adjuster authorization documented

**Zone composition (S500 validation)**

- Dehumidifier capacity placed < required PPD per zone
- Air movers placed outside the required range
- Class of Water mismatch vs. computed affected percentages
- Category of Water mismatch vs. narrative keywords (sewage, supply line, etc.)

**Fabricated-readings detection**

- Identical outside atmospheric readings across 3+ days
- GDep < 6 in dehumidifier readings (insufficient pressure differential)
- GPP ≤ 32 in affected zone during Day 1–2 (suspicious for active loss)
- Material readings forming perfect arithmetic sequences
- Static material readings (4+ identical consecutive values)

**Documentation gaps**

- Days appearing in the report with NO readings recorded
- Missing daily atmospheric readings during active drying window
- Communication gaps > 48 hours in Daily Narrative
- No adjuster contact documented in narrative

**AI judgment layer** (optional)

- Pattern analysis of full readings tables
- Narrative quality and adjuster-authorization completeness
- Anything else a carrier reviewer would flag

## Deploy to GitHub Pages

1. Create a new GitHub repo (public or private — Pages works on both with paid plans, or public for free).
2. Drop `index.html` into the repo root.
3. Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / root → Save.
4. Wait ~30 seconds. Your URL will be `https://YOUR-USERNAME.github.io/REPO-NAME/`.
5. Share that URL with your QC team.

## Setting up AI scrubbing

You have two deployment models. Pick one.

### Option A: Shared Worker (recommended for teams) — one key, all reviewers use it

Reviewers don't manage any keys. You set up a free Cloudflare Worker that holds the Gemini key on the server side. Your team just opens the URL and uses the tool. Cost: **$0/month**.

**Full Cloudflare Worker setup (~15 minutes, one-time):**

1. **Get a free Gemini API key first.**
   - Go to https://aistudio.google.com/app/apikey
   - Sign in with any Google account.
   - Click "Create API key" → "Create API key in new project."
   - Copy the key (starts with `AIza...`). Save it temporarily in a text editor.

2. **Sign up for Cloudflare (free, no credit card required).**
   - Go to https://dash.cloudflare.com/sign-up
   - Use any email. Verify it.

3. **Create the Worker.**
   - In the Cloudflare dashboard, click **Workers & Pages** in the left sidebar.
   - Click **Create application** → **Create Worker**.
   - Give it a name like `drybooks-scrubber` (this becomes part of the URL).
   - Click **Deploy** (it will deploy a default "Hello World" — that's fine for now).

4. **Paste the Worker script.**
   - On the Worker's overview page, click **Edit code** in the top right.
   - You'll see a code editor with a default script. Delete everything.
   - Open `cloudflare-worker.js` from this repo, copy the entire contents, and paste into the editor.
   - Click **Save and deploy** in the top right.

5. **Add your Gemini key as an encrypted secret.**
   - Click the **Settings** tab on the Worker page.
   - Click **Variables** in the left sub-menu.
   - Under "Environment Variables," click **Add variable**.
   - Variable name: `GEMINI_API_KEY` (exactly that, all caps with underscore).
   - Value: paste your Gemini API key from step 1.
   - Click **Encrypt** (this is critical — it hides the key).
   - Click **Save and deploy**.

6. **(Optional) Add a shared password to prevent random people from using your Worker.**
   - Same Variables page, click **Add variable** again.
   - Name: `SHARED_PASSWORD`
   - Value: any password you choose (e.g., `landers-qc-2026`).
   - Click **Encrypt** → **Save and deploy**.
   - Share this password with your team so they can paste it into the HTML's Settings.

7. **Copy the Worker URL.**
   - On the Worker overview page, you'll see a URL like `https://drybooks-scrubber.YOURNAME.workers.dev`.
   - Copy it.

8. **Share with your team.**
   - Tell each reviewer to open the GitHub Pages URL.
   - In Settings, they pick "Shared Worker" as the provider, paste the Worker URL, and (if you set one) the password.
   - They click Save and they're done. They never need a key.

**That's it.** Your team has frictionless AI scrubbing at $0/month.

To check usage: Cloudflare dashboard → your Worker → **Metrics** tab.

To revoke access: delete the Worker (or change the `SHARED_PASSWORD` secret and notify your team).

### Option B: Bring Your Own Key (BYOK) — each reviewer manages their own key

Use this if you don't want to set up a Worker, or for power users who want to use Claude/GPT instead of Gemini.

Each reviewer configures their own API key. Keys stay in their browser (localStorage) — they're never sent to any server other than the AI provider.

**Free option — Google Gemini Flash**

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with any Google account
3. Click "Create API key" → copy it
4. In the scrubber, click Settings → paste key → Save

Free tier: 1,500 requests per day. No credit card needed.

**Better quality — Anthropic Claude**

1. Go to https://console.anthropic.com/
2. Create an account (free $5 credit)
3. Create an API key under Settings → API Keys
4. In the scrubber, Settings → Provider: Anthropic → paste key

Cost: roughly $0.05–$0.20 per report scrubbed.

**Also supported — OpenAI**

Same flow at https://platform.openai.com/api-keys

**No AI option**

Settings → Provider: "No AI (hard rules only)". The hard rules alone catch most documentation and timeline failures.

## Privacy & security

- PDFs are parsed entirely in the browser using PDF.js. The PDF file itself never leaves the user's computer.
- Only a structured summary (the parsed fields, readings, and findings) is sent to the AI provider — never the raw PDF.
- API keys are stored only in the user's browser localStorage. Each reviewer manages their own.
- Nothing is logged or persisted on any server. Close the tab, refresh the page — no traces beyond the user's own browser.

## Files

- `index.html` — the entire app. Single file, drop-in for GitHub Pages.
- `cloudflare-worker.js` — the Worker proxy script. Only needed if you use the Shared Worker setup (Option A above).
- `verify.js` / `verify_clean.js` — Node.js test harness used during development. Not needed for deployment.
- `README.md` — this file.

## What it does NOT do

- It does not edit DryBooks records. It is read-only on the PDF.
- It does not eliminate the need for human review. The findings are a *first pass* — they highlight issues for a QC reviewer to investigate.
- Class of Water detection from material types is a rough estimate based on affected percentages. Class 4 (deeply held water in plaster/wood/concrete) requires manual review of the material readings.
- AI judgment quality depends on the provider you choose. Gemini Flash is good for spotting patterns; Claude/GPT are stronger on nuanced narrative review.

## Tuning the rules

All rules live in the `runRules()` function in `index.html`. Each rule has a code like `R-001` and a severity level. To adjust thresholds, edit the relevant rule. To add new rules, follow the pattern and call `add(severity, code, title, message, evidence)`.

## Roadmap

- When you stand up cloud-based digital workers, swap the BYOK model for a proxied server-side AI call so each reviewer doesn't manage their own key.
- Optional integration to log findings to a shared spreadsheet (Google Sheets, SharePoint) so trends across jobs/techs become visible.
- Rules tuning based on which findings actually drove carrier chargebacks vs. false positives.
