# Global leaderboard — server

A tiny Cloudflare Worker + D1 database that backs the global leaderboard in
Ben's Castle Defense. It is optional: **until you deploy this and paste the URL
into the game, the game behaves exactly as before** and only keeps the local
Hall of Fame. Nothing breaks if you never set it up.

Everything here fits comfortably inside Cloudflare's free tier for a game of
this size (100k Worker requests/day, 5M D1 rows read/day).

## Deploy it (about five minutes)

You need a free Cloudflare account and Node installed.

```bash
cd server
npm install -g wrangler          # one-time
wrangler login                   # opens a browser

# 1. Create the database — copy the database_id it prints
wrangler d1 create castle-defense

# 2. Paste that id into wrangler.toml (replace REPLACE_WITH_YOUR_D1_DATABASE_ID)

# 3. Create the tables
wrangler d1 execute castle-defense --remote --file=./schema.sql

# 4. Set the rate-limiting salt to any random string you like
wrangler secret put RATE_SALT

# 5. Ship it
wrangler deploy
```

Wrangler prints a URL like `https://castle-defense-leaderboard.<you>.workers.dev`.

## Turn it on in the game

Open `index.html`, find this line near the top of the script block, and paste
your Worker URL in:

```js
const LEADERBOARD_API = ''; // e.g. 'https://castle-defense-leaderboard.you.workers.dev'
```

Commit and push. The GLOBAL tab appears on the Hall of Fame screen and scores
start submitting at the end of each run.

Check it's alive at any time: `curl https://<your-worker>/api/health`

## What it stores — and what it deliberately does not

The players are children, so this is built to hold **no personal data at all**:

| Stored | Not stored |
| --- | --- |
| An opaque random token the browser generates for itself | Any email, login, or real name |
| A display name as *two indices into a fixed word list* plus a number | Any free text a player typed |
| Waves survived, world/wave, kills, bosses, run duration | Any IP address (only a salted, daily-rotating hash, for rate limiting, deleted nightly) |

Because a name is only ever `ADJECTIVES[i] + NOUNS[j] + number`, it is
structurally impossible for a player to put arbitrary text — a real name, a
slur, a phone number — into the database. That removes the moderation burden
that normally comes with a public board for kids, and it is why there is no
"choose your username" box in the game. Players reroll instead.

There are no accounts, so there is nothing to breach, and a player who clears
their browser storage simply becomes a new anonymous token.

If you later add anything that *does* identify a player, stop and get advice on
COPPA (US) and the UK/EU equivalents first — that is a genuinely different legal
posture from what is here.

## Anti-cheat — read this before treating it as competitive

Scores are computed by JavaScript on the player's own machine. That means a
determined person can always submit a score they did not earn. This is true of
every browser game with a leaderboard; it is not a bug you can patch away.

What the server does do:

- **Consistency** — `score` must equal exactly `(world - 1) * 15 + wave`, so
  scores can't be free-floating numbers.
- **Plausibility bounds** — kills, bosses and run duration must be within
  ranges a real run can produce. A "500 waves in 3 seconds" submission is
  rejected.
- **Rate limiting** — 20 submissions per hour, enforced against *both* the
  player token and a hashed network address, so minting fresh tokens doesn't
  help.

That stops casual tampering and accidental spam. It does not stop someone who
reads the code and crafts a plausible-looking request.

If the board ever matters enough to need real integrity, the fix is to make the
server authoritative — submit a compact input log for the run and re-simulate it
server-side, accepting the score only if the simulation agrees. That's a
significantly larger project and would need the game loop refactored to be
deterministic. Worth doing before you attach a prize to anything; overkill for
"who can beat World 3".

## Removing an entry

If something does need pulling:

```bash
wrangler d1 execute castle-defense --remote \
  --command "DELETE FROM scores WHERE id = 123"
```

To wipe the board entirely: `DELETE FROM scores`.

## Cost control

The Worker free tier covers 100,000 requests/day. The game submits once per
finished run and reads the board when a player opens the screen, so a few
thousand daily players fit fine. If you ever exceed it, Cloudflare's dashboard
lets you cap spend at zero rather than bill you.
