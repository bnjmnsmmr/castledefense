/**
 * Ben's Castle Defense — global leaderboard API (Cloudflare Worker + D1).
 *
 * Design constraints, in priority order:
 *
 * 1. NO PERSONAL DATA. The audience is children. There are no accounts, no
 *    emails, and no free-text names. A display name is a pair of indices into
 *    the fixed word lists below plus a number, so the database physically
 *    cannot hold arbitrary text a player typed. IP addresses are used only as
 *    a salted hash for rate limiting and are never stored raw.
 *
 * 2. FAIL SAFE. Every endpoint returns quickly and the game treats any error
 *    as "no global board today" — the local Hall of Fame keeps working.
 *
 * 3. BEST-EFFORT INTEGRITY. Scores come from a client-side game, so they can
 *    never be fully trusted. We reject implausible submissions and rate-limit
 *    hard, which stops casual nonsense. It does not stop a determined forger.
 *    See the "Anti-cheat" section of README.md before treating this as a
 *    competitive ranking.
 */

// Must stay byte-identical to the lists in index.html (getPlayerIdentity).
const ADJECTIVES = [
  'Brave', 'Swift', 'Iron', 'Golden', 'Mighty', 'Clever', 'Silent', 'Royal',
  'Fierce', 'Noble', 'Stormy', 'Blazing', 'Frosty', 'Shadow', 'Crimson', 'Azure',
  'Jolly', 'Lucky', 'Bold', 'Sunny', 'Cosmic', 'Emerald', 'Thunder', 'Mystic',
  'Gallant', 'Rugged', 'Nimble', 'Radiant', 'Valiant', 'Wandering', 'Ancient', 'Merry',
];
const NOUNS = [
  'Falcon', 'Badger', 'Dragon', 'Knight', 'Otter', 'Wolf', 'Griffin', 'Turtle',
  'Phoenix', 'Bear', 'Fox', 'Hawk', 'Lion', 'Raven', 'Stag', 'Tiger',
  'Wizard', 'Archer', 'Ranger', 'Guardian', 'Paladin', 'Sentry', 'Warden', 'Champion',
  'Comet', 'Boulder', 'Lantern', 'Anvil', 'Compass', 'Beacon', 'Bastion', 'Banner',
];

const WAVES_PER_WORLD = 15;   // mirrors DIFFICULTY.wavesPerWorld
const MAX_SUBMITS_PER_HOUR = 20;
const BOARD_LIMIT_MAX = 50;

function corsHeaders(env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env) },
  });
}

/** Salted, rotating hash — lets us rate-limit without ever storing an IP. */
async function bucketHash(value, env) {
  const day = Math.floor(Date.now() / 86400000);
  const salt = env.RATE_SALT || 'castle-defense';
  const data = new TextEncoder().encode(`${salt}:${day}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkRateLimit(env, key) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 3600;
  const row = await env.DB.prepare('SELECT count, window_start FROM rate_limit WHERE bucket = ?')
    .bind(key).first();
  if (!row || row.window_start < windowStart) {
    await env.DB.prepare(
      'INSERT INTO rate_limit (bucket, count, window_start) VALUES (?, 1, ?) ' +
      'ON CONFLICT(bucket) DO UPDATE SET count = 1, window_start = excluded.window_start'
    ).bind(key, now).run();
    return true;
  }
  if (row.count >= MAX_SUBMITS_PER_HOUR) return false;
  await env.DB.prepare('UPDATE rate_limit SET count = count + 1 WHERE bucket = ?').bind(key).run();
  return true;
}

/**
 * Reject anything that could not have come from a real run.
 * Returns null when valid, or a human-readable reason.
 */
function validateSubmission(b) {
  const int = (v) => Number.isInteger(v) ? v : NaN;

  if (typeof b !== 'object' || b === null) return 'malformed body';
  if (typeof b.token !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(b.token)) return 'bad token';
  if (b.mode !== 'run' && b.mode !== 'daily') return 'bad mode';

  const adj = int(b.adj), noun = int(b.noun), num = int(b.num);
  if (!(adj >= 0 && adj < ADJECTIVES.length)) return 'bad name';
  if (!(noun >= 0 && noun < NOUNS.length)) return 'bad name';
  if (!(num >= 0 && num <= 9999)) return 'bad name';

  const score = int(b.score), world = int(b.world), wave = int(b.wave);
  const kills = int(b.kills), bosses = int(b.bosses), duration = int(b.durationMs);
  if (!(world >= 1 && world <= 200)) return 'world out of range';
  if (!(wave >= 1 && wave <= WAVES_PER_WORLD)) return 'wave out of range';
  if (!(score >= 1 && score <= 3000)) return 'score out of range';

  // Score must be exactly what the world/wave pair implies — no free-floating numbers.
  if (score !== (world - 1) * WAVES_PER_WORLD + wave) return 'score inconsistent with progress';

  if (!(kills >= 0 && kills <= score * 400)) return 'kills implausible';
  if (!(bosses >= 0 && bosses <= world)) return 'bosses implausible';

  // A run genuinely takes time. Even at 3x speed a wave cannot resolve instantly.
  if (!(duration >= 0 && duration <= 24 * 3600 * 1000)) return 'duration out of range';
  if (duration > 0 && duration < score * 1500) return 'duration too short for progress';

  return null;
}

async function handleSubmit(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400, env); }

  const reason = validateSubmission(body);
  if (reason) return json({ error: reason }, 400, env);

  // Rate limit on the player token AND the (hashed) network address, so one
  // client cannot mint fresh tokens to spam the board.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const [tokenBucket, ipBucket] = await Promise.all([
    bucketHash('t:' + body.token, env),
    bucketHash('i:' + ip, env),
  ]);
  const [tokenOk, ipOk] = [await checkRateLimit(env, tokenBucket), await checkRateLimit(env, ipBucket)];
  if (!tokenOk || !ipOk) return json({ error: 'rate limited' }, 429, env);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'INSERT INTO scores (token, adj, noun, num, score, world, wave, kills, bosses, duration_ms, mode, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    body.token, body.adj, body.noun, body.num, body.score, body.world, body.wave,
    body.kills, body.bosses, body.durationMs || 0, body.mode, now
  ).run();

  const rank = await playerRank(env, body.mode, body.score);
  return json({ ok: true, rank }, 200, env);
}

/** How many distinct players have a better best-score than this one. */
async function playerRank(env, mode, score) {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS better FROM (SELECT token, MAX(score) AS best FROM scores WHERE mode = ? GROUP BY token) ' +
    'WHERE best > ?'
  ).bind(mode, score).first();
  return (row ? row.better : 0) + 1;
}

function periodCutoff(period) {
  const now = Math.floor(Date.now() / 1000);
  if (period === 'today') return now - 86400;
  if (period === 'week') return now - 7 * 86400;
  return 0;
}

async function handleBoard(url, env) {
  const period = ['today', 'week', 'all'].includes(url.searchParams.get('period'))
    ? url.searchParams.get('period') : 'all';
  const mode = url.searchParams.get('mode') === 'daily' ? 'daily' : 'run';
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 25, BOARD_LIMIT_MAX);
  const token = url.searchParams.get('token');
  const cutoff = periodCutoff(period);

  // One row per player — their best run in the window.
  const { results } = await env.DB.prepare(
    'SELECT token, adj, noun, num, score, world, wave, kills, bosses, created_at, ' +
    '  ROW_NUMBER() OVER (ORDER BY score DESC, kills DESC, created_at ASC) AS rank ' +
    'FROM ( ' +
    '  SELECT token, adj, noun, num, score, world, wave, kills, bosses, created_at, ' +
    '    ROW_NUMBER() OVER (PARTITION BY token ORDER BY score DESC, kills DESC) AS rn ' +
    '  FROM scores WHERE mode = ? AND created_at >= ? ' +
    ') WHERE rn = 1 ORDER BY score DESC, kills DESC, created_at ASC LIMIT ?'
  ).bind(mode, cutoff, limit).all();

  const entries = (results || []).map(r => ({
    rank: r.rank,
    name: `${ADJECTIVES[r.adj] || '?'} ${NOUNS[r.noun] || '?'} ${String(r.num).padStart(4, '0')}`,
    score: r.score, world: r.world, wave: r.wave, kills: r.kills, bosses: r.bosses,
    at: r.created_at,
    you: !!(token && r.token === token),
  }));

  let you = null;
  if (token && /^[a-zA-Z0-9_-]{16,64}$/.test(token)) {
    const mine = await env.DB.prepare(
      'SELECT MAX(score) AS best FROM scores WHERE mode = ? AND token = ? AND created_at >= ?'
    ).bind(mode, token, cutoff).first();
    if (mine && mine.best != null) {
      you = { score: mine.best, rank: await playerRank(env, mode, mine.best) };
    }
  }

  const total = await env.DB.prepare(
    'SELECT COUNT(DISTINCT token) AS n FROM scores WHERE mode = ? AND created_at >= ?'
  ).bind(mode, cutoff).first();

  return json({ period, mode, entries, you, players: total ? total.n : 0 }, 200, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (!env.DB) return json({ error: 'database not bound' }, 500, env);

    try {
      if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
        return await handleBoard(url, env);
      }
      if (url.pathname === '/api/score' && request.method === 'POST') {
        return await handleSubmit(request, env);
      }
      if (url.pathname === '/api/health') {
        return json({ ok: true }, 200, env);
      }
    } catch (err) {
      // Never leak internals to a game client; the game just falls back to local scores.
      console.error('leaderboard error', err && err.stack || err);
      return json({ error: 'server error' }, 500, env);
    }
    return json({ error: 'not found' }, 404, env);
  },

  /** Nightly: drop stale rate-limit rows and keep the table from growing forever. */
  async scheduled(event, env) {
    const cutoff = Math.floor(Date.now() / 1000) - 86400;
    await env.DB.prepare('DELETE FROM rate_limit WHERE window_start < ?').bind(cutoff).run();
  },
};
