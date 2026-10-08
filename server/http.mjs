import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { z } from 'zod';

const input = z
  .object({
    requestId: z.uuid().transform((id) => id.toLowerCase()),
    text: z
      .string()
      .min(1)
      .max(4000)
      .refine((t) => t.trim().length > 0)
      // No NUL, other C0 controls, DEL or C1 controls; tab and newline are allowed.
      .refine((t) => !/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/.test(t)),
  })
  .strict();
/**
 * Rate-limit key. With `trustProxy` hops of trusted reverse proxies, each appends the
 * address it received from, so the client is the entry `trustProxy` from the right of
 * X-Forwarded-For. Entries further left are client-supplied and never used. A missing,
 * too-short or malformed header falls back to the socket address.
 */
export function clientAddress(req, trustProxy = 0) {
  const socket = req.socket.remoteAddress;
  if (!(trustProxy >= 1)) return socket;
  const header = req.headers['x-forwarded-for'];
  if (typeof header !== 'string') return socket;
  const hops = header.split(',').map((entry) => entry.trim());
  const entry = hops[hops.length - trustProxy];
  return entry && isIP(entry) ? entry : socket;
}

const publicWish = (w) => ({
  id: w.id,
  status: w.status,
  story: w.story,
  ...(w.status === 'pending'
    ? { message: 'Your Wish is saved. Story creation is pending; retry to check it.' }
    : {}),
});

export function createWishServer({
  store,
  createStory,
  origins = [],
  rateLimit = 10,
  trustProxy = 0,
  enabled = false,
  onError = () => {},
}) {
  const pending = new Map();
  const rates = new Map();
  let submissionTail = Promise.resolve();
  async function reconcile(wish) {
    wish = store.read().wishes.find((row) => row.id === wish.id);
    if (wish.status === 'submitted') return wish;
    if (pending.has(wish.id)) return pending.get(wish.id);
    // Story writer and Git operations share a checkout; serialize them as well as YAML writes.
    const work = submissionTail
      .then(async () => {
        try {
          const story = await createStory(wish);
          return await store.mutate((db) => {
            const row = db.wishes.find((w) => w.id === wish.id);
            row.story = story;
            row.status = 'submitted';
            row.updatedAt = new Date().toISOString();
            return row;
          });
        } catch (error) {
          onError(error);
          return store.read().wishes.find((w) => w.id === wish.id);
        }
      })
      .finally(() => pending.delete(wish.id));
    submissionTail = work.catch(() => {});
    pending.set(wish.id, work);
    return work;
  }
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.url === '/healthz' && req.method === 'GET') return send(200, { status: 'ok' });
      // WISH_ENABLED gates the whole route; while off it is indistinguishable from unknown paths.
      if (req.url !== '/api/wishes' || !enabled) return send(404, { message: 'Not found' });
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin))
        return send(403, { message: 'This game origin is not allowed.' });
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204);
        return res.end();
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return send(405, { message: 'Use POST to submit a Wish.' });
      }
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json')
        return send(415, { message: 'Send JSON.' });
      let body = '',
        bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 32768) return send(413, { message: 'Wish request is too large.' });
        body += chunk.toString('latin1');
      }
      let decoded;
      try {
        decoded = input.parse(JSON.parse(Buffer.from(body, 'latin1').toString('utf8')));
      } catch {
        return send(400, { message: 'Use a request UUID and 1–4000 characters of Wish text.' });
      }
      const { requestId, text } = decoded;
      // Every valid submission counts, retries included: a retry of a pending Wish
      // re-runs story creation and its Git fetch/push.
      const now = Date.now();
      for (const [key, value] of rates) if (value.until <= now) rates.delete(key);
      const key = clientAddress(req, trustProxy);
      const rate = rates.get(key) ?? { count: 0, until: now + 60000 };
      if (rate.count >= rateLimit) {
        res.setHeader('Retry-After', '60');
        return send(429, { message: 'Too many Wishes. Please retry in a minute.' });
      }
      rate.count++;
      rates.set(key, rate);
      const existing = store.read().wishes.find((w) => w.id === requestId);
      if (existing && existing.text !== text)
        return send(409, { message: 'This request ID already belongs to a different Wish.' });
      let conflict = false,
        created = false;
      const saved = await store.mutate((db) => {
        let row = db.wishes.find((w) => w.id === requestId);
        if (row) {
          conflict = row.text !== text;
          return row;
        }
        created = true;
        const now = new Date().toISOString();
        row = {
          id: requestId,
          text,
          status: 'pending',
          story: null,
          createdAt: now,
          updatedAt: now,
          worker: { status: 'queued' },
        };
        db.wishes.push(row);
        return row;
      });
      if (conflict)
        return send(409, { message: 'This request ID already belongs to a different Wish.' });
      const linked = await reconcile(saved);
      send(linked.status === 'pending' ? 202 : created ? 201 : 200, publicWish(linked));
    } catch (error) {
      onError(error);
      if (!res.headersSent)
        send(503, { message: 'Could not confirm your Wish. Keep your text and retry.' });
      else res.end();
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.drain = () => submissionTail;
  return server;
}
