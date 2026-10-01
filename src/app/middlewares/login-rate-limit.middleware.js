const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function getKey(req) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  return `${req.ip}:${email}`;
}

export function loginRateLimit(req, res, next) {
  const key = getKey(req);
  const current = attempts.get(key);
  const now = Date.now();

  if (current && now - current.startedAt < WINDOW_MS && current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' });
  }

  res.once('finish', () => {
    if (res.statusCode === 200) {
      attempts.delete(key);
      return;
    }
    if (res.statusCode !== 401) return;

    const entry = current && now - current.startedAt < WINDOW_MS
      ? current
      : { count: 0, startedAt: now };
    entry.count += 1;
    attempts.set(key, entry);
  });

  next();
}
