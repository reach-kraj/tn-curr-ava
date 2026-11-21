# TN Current Booking

Pick any Tamil Nadu railway station and see every train departing it, with the exact time
**current booking** opens — worked out from when each train leaves its *source* station.

Opens on Tambaram (TBM) by default. Example: 16103 Tambaram → Rameswaram leaves Tambaram at 6:10 PM, so at Chengalpattu current booking opens at **8:10 AM** (10-hour rule).

## Stack

- Next.js 16 (App Router) as a **static export** (`out/`) — no server code
- No map: a fast, accessible two-column board (station summary + tabs); each train's route is shown as a list of stops
- All booking maths runs in the browser, in IST
- Reminders: Google Calendar link, `.ics` file with alarms (10 min before + at opening), share sheet
- **Advance booking & festivals** tab: when booking opens (60 days before the source-station journey date, 8:00 AM IST; Tatkal the day before), plus Tamil Nadu holidays (G.O.(Ms.) No.613, 06.10.2026) grouped into long weekends with go/return booking dates and reminders
- **Sync** button: downloads the latest GTFS feed in the browser (web worker), rebuilds the Tamil Nadu timetable if newer and keeps it on the device
- Hosted on Cloudflare Workers static assets (`wrangler.jsonc`)

## Commands (bun)

| Command | What it does |
|---|---|
| `bun install` | Install dependencies |
| `bun dev` | Local dev server |
| `bun run data` | Rebuild `public/data/tn.json` from the GTFS feed (`--refresh` to re-download) |
| `bun run check` | Typecheck, lint, tests, production build |
| `bun run build` | Static export to `out/` |
| `bunx wrangler dev` | Serve `out/` exactly as Cloudflare will |

## Cloudflare (Git-connected Worker)

- Build command: `bun run build`
- Deploy command: `npx wrangler deploy`

## Data

- Timetable: unofficial Indian Railways GTFS feed — https://github.com/Neo2308/indianrailways-gtfs
- State outlines: https://github.com/geohacker/india

Times are scheduled, not live. EMU/MEMU/DEMU/passenger trains (numbers starting 4–7) are unreserved.
The booking rule (10 h default, 8 h reported 2025 rule, 4 h) is selectable in the UI.
