# Hosting the Global FPV Dashboard — Options, Costs & Recommendation

*Prepared for the FPV team — July 2026. All prices are current 2026 figures; verify
at deploy time as tiers change frequently.*

## 1. Executive summary

The dashboard splits cleanly into three things that get hosted very differently:

1. **A static front end** (the React/Vite build) — cheap or free forever, everywhere.
2. **A Node/Express API that talks to Google Earth Engine** — this is the real cost
   driver, because to feel professional it must stay awake (no "cold start") .
3. **A small writable store for community contributions** — needs storage that
   survives restarts, which free tiers usually do *not* guarantee.

**Recommendation:** put the front end on **Cloudflare Pages (free, unlimited
bandwidth)**, the API on a **Render Starter instance ($7/month, always-on)**, and the
contribution data in **Neon Postgres (free, auto-resume)** — total **≈ $7/month**, no
cold starts, no data loss, custom domain and HTTPS included. Use the **all-free**
version (Render free tier + Cloudflare) only for internal testing, because of the
~1-minute wake-up delay and non-persistent storage.

## 2. What actually needs hosting

| Component | Nature | Hosting implication |
|---|---|---|
| React/Vite front end | Static files (HTML/JS/CSS) after `npm run build` | Cheapest part; a CDN serves it for free |
| Express API + GEE client | Always-listening Node process | Must stay warm; this is where money goes |
| Köppen raster (~23 MB) + `wb_cache.json` | Read-only files | Ship inside the deploy image — no special storage |
| `submissions.json` (contributions) | **Writable** at runtime | Needs a persistent disk **or** a database |
| Google Earth Engine | External service (tiles, metrics) | Free for research use; licensing note in §7 |

The single technical reason the contribution feature pushes you toward paid hosting:
**free tiers use an *ephemeral* filesystem** — every redeploy or restart wipes files
written at runtime, so `submissions.json` (and every community submission in it) can
vanish. The fix is either a small persistent disk or an external database.

## 3. The two limits that separate "free" from "professional"

**(a) Cold starts.** Free backend tiers spin the server down after ~15 minutes of
inactivity. The next visitor then waits **up to a minute** while it boots — which is
exactly the "Render takes a minute to wake up" behaviour. Fine for a demo, not for a
public launch or a live presentation.

**(b) Persistence.** Free tiers don't guarantee that runtime-written data survives, and
free databases can expire (Render's free Postgres is deleted after 30 days) or pause
after inactivity (Supabase pauses after 1 week and needs a *manual* un-pause).

## 4. Front-end hosting (the easy, stays-free part)

| Host | Free tier | Notes |
|---|---|---|
| **Cloudflare Pages** ✅ | **Unlimited bandwidth**, 500 builds/mo | Best free tier in 2026; 300+ edge locations; no egress fees |
| Netlify | 300 credits/mo, 300 build min | Generous, simple; credit system caps usage |
| Vercel | 100 GB bandwidth, 1 M function calls | Great DX, but **commercial use restricted to paid plans** |

**Pick Cloudflare Pages.** The front end is read-only and static, so unlimited free
bandwidth means it scales to any amount of traffic at $0, and it avoids Vercel's
commercial-use restriction.

## 5. Back-end hosting (where the cost is)

| Platform | Model | Always-on small Node service | Best at |
|---|---|---|---|
| **Render** ✅ | Fixed instance price + optional workspace fee | **$7/mo** Starter (no cold start); $25/mo Standard for more RAM | Predictability, simplest setup |
| Railway | Per-second metered on top of a plan fee | ~low tens of $/mo (Hobby $5, Pro $20 incl. credits) | Cheapest for bursty solo workloads |
| Fly.io | Pure pay-as-you-go per second | ~$2/mo (shared-cpu-1x, 256 MB) + ~$5/GB RAM | Lowest raw cost & latency, most ops effort |

Render **free** tier: 750 instance-hours/mo, 100 GB bandwidth — but spins down after
15 min (≤1-min cold start) and has an ephemeral disk. Render **Starter ($7/mo)** keeps
the service always-on, which removes the cold start entirely.

**Pick Render Starter ($7/mo)** for the launch: it's the simplest path from your
current setup, and $7 is the whole "paid version" story for a single always-on API.
Fly.io is ~$2/mo if you want the absolute cheapest and don't mind more manual ops;
Railway is fine but its metered billing is less predictable for a research budget.

## 6. Where the contribution data lives

| Option | Cost | Persistence behaviour |
|---|---|---|
| **Neon Postgres (free)** ✅ | $0 | 0.5 GB, scale-to-zero, **auto-resumes in ~ms** — no manual un-pause |
| Render persistent disk | $0.25/GB/mo (~$0.25 for this app) | Keeps the existing `submissions.json` approach unchanged |
| Supabase (free) | $0 | 500 MB, but **pauses after 1 week idle** and needs manual un-pause — avoid for a live demo |

Two clean choices: keep the current JSON file and attach a **Render persistent disk**
(~$0.25/mo, zero code change beyond a mount path), or move contributions to **Neon**
(free, and the right long-term answer). The code already reads a `DATA_DIR`
environment variable and routes all storage through two functions
(`readStore`/`writeStore`), so a Neon migration touches only those two functions.

## 7. Google Earth Engine — the licensing caveat

Earth Engine is **free for research, education, and non-commercial use**, which covers
a public academic dashboard. If the project is ever *commercialised* (charging users,
a company product), Google requires a **paid commercial EE licence** through Google
Cloud, billed separately from any host above. For a research paper this is worth a
sentence: hosting cost and Earth Engine's commercial terms are independent, and the
non-commercial path keeps EE at $0. *(Confirm against Google's current EE terms before
publishing.)*

## 8. Recommended architecture & total cost

```
Visitor ──▶ Cloudflare Pages (static React front end)      $0  (unlimited bandwidth)
                     │  calls /api/*
                     ▼
             Render Starter — Node/Express + GEE           $7 /month  (always-on)
                     │
                     ├─ Köppen raster + wb_cache.json  →  shipped in image ($0)
                     └─ contributions  →  Neon Postgres (free)  or disk (~$0.25/mo)
```

**Total: about $7/month**, with no cold starts, persistent contributions, HTTPS, and a
custom domain. For comparison: all-free = $0 but cold starts + data loss; a full
team/Pro setup on Render is ~$25–50/month if you later need more RAM or team seats.

## 9. Rollout plan (what we're doing now vs at launch)

1. **Now — free test deploy.** Front end on Cloudflare Pages, API on Render **free**.
   Share the link with the team to exercise every feature (search, climate zones,
   contribute, admin review). Two known quirks to expect: the first click after idle
   takes ~1 min while the server wakes, and test contributions may reset on redeploy.
2. **Collect feedback**, fix issues.
3. **Launch — paid.** Flip the API to Render **Starter ($7/mo)** to kill the cold
   start, and point contributions at Neon (or attach a persistent disk). Nothing else
   changes.

## 10. Optional: keeping the free demo warm

For the testing phase, a free uptime pinger (UptimeRobot, cron-job.org) hitting the
API every ~10 minutes prevents it from sleeping, hiding the cold start during a demo.
It's a stopgap — it consumes most of the 750 free hours and isn't a substitute for the
$7 always-on tier at launch.

## 11. Risks & caveats

- Free-tier terms change often (Supabase tightened its pause window in Feb 2026) —
  re-check limits at deploy time.
- The Node process mainly orchestrates GEE calls, so 512 MB (Starter) should be
  enough; if memory errors appear under load, Standard ($25) is the next step.
- Contributions are anonymous and unthrottled — add basic rate-limiting/captcha before
  a wide public launch (independent of hosting).

## Sources

- [Render Pricing (official)](https://render.com/pricing)
- [Render Pricing 2026 analysis](https://kuberns.com/blogs/render-pricing/)
- [Render vs Railway vs Fly.io — 2026 pricing](https://expresstech.io/render-vs-railway-vs-fly-io-2026-pricing-showdown/)
- [Render vs Railway vs Fly.io pricing compared (2026)](https://dev.to/pavel-hostim/render-vs-railway-vs-flyio-pricing-compared-2026-2e5p)
- [Cloudflare Pages vs Netlify vs Vercel (2026)](https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026)
- [Vercel vs Netlify vs Cloudflare Pages pricing 2026](https://www.devtoolreviews.com/reviews/vercel-vs-netlify-vs-cloudflare-pages-pricing-comparison-2026)
- [Supabase vs Neon free tier deep dive (2026)](https://agentdeals.dev/neon-vs-supabase)
- [Supabase free tier limits 2026](https://www.itpathsolutions.com/supabase-free-tier-limits)
