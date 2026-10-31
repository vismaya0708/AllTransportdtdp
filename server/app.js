import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { DEST, LOCALITIES, buses, metroLines, mmtsRoutes } from './data/transport.js';

const profileFields = {
  full_name: z.string().trim().min(1).max(120),
  year_of_study: z.enum(['1st Year', '2nd Year', '3rd Year', '4th Year']),
  locality: z.enum(['LB Nagar', 'Kukatpally', 'KPHB'])
};
const profilePatch = z.object(profileFields).partial().strict().refine(value => Object.keys(value).length > 0);
const studentQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).regex(/^[\p{L}\p{N}\s_-]*$/u).default(''),
  locality: z.enum(['LB Nagar', 'Kukatpally', 'KPHB']).optional()
}).strict();
const meta = { sample: true, source: 'original prototype fixtures', timezone: 'Asia/Kolkata' };
export const busesFor = locality => buses.filter(bus => bus.to === DEST && bus.stops.some(stop => stop.startsWith(locality)));

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ApiError(status, code, message); };
const data = async query => {
  const result = await query;
  if (result.error) {
    if (result.error.code === '23505') fail(409, 'CONFLICT', 'That record already exists.');
    fail(502, 'DATABASE_ERROR', 'Unable to access your data. Please try again.');
  }
  return result;
};

export function createApp(options = {}) {
  const env = options.env || process.env;
  const app = express();
  app.disable('x-powered-by');
  const origins = (env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
  // Supabase Auth requires HTTPS/WSS connections to the configured project.
  let projectOrigin;
  try { projectOrigin = new URL(env.SUPABASE_URL).origin; } catch { /* setup mode */ }
  app.use(helmet({ contentSecurityPolicy: { directives: {
    'connect-src': ["'self'", ...(projectOrigin ? [projectOrigin, projectOrigin.replace('https:', 'wss:')] : [])],
    'img-src': ["'self'", 'data:'], 'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"], 'upgrade-insecure-requests': null
  } } }));
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); } }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } }) }));
  app.use(express.json({ limit: '16kb' }));
  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));

  const createDb = options.createDb || (token => createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }));
  api.use(async (req, _res, next) => {
    const token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) fail(401, 'UNAUTHORIZED', 'Sign in to continue.');
    if (!options.createDb && (!projectOrigin || !env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_URL.includes('YOUR_PROJECT'))) {
      fail(503, 'SETUP_REQUIRED', 'Configure Supabase and apply the database migration.');
    }
    req.db = createDb(token);
    const verified = await req.db.auth.getUser(token);
    if (verified.error || !verified.data?.user) fail(401, 'UNAUTHORIZED', 'Your session is invalid or expired. Sign in again.');
    req.user = verified.data.user;
    const roles = await data(req.db.from('user_roles').select('role').eq('user_id', req.user.id).maybeSingle());
    if (!roles.data || !['student', 'hod'].includes(roles.data.role)) fail(403, 'FORBIDDEN', 'Your account has no assigned role.');
    req.role = roles.data.role;
    next();
  });
  const role = expected => (req, _res, next) => {
    if (req.role !== expected) fail(403, 'FORBIDDEN', 'This action is unavailable for your account.');
    next();
  };
  const ownProfile = async req => {
    const result = await data(req.db.from('profiles').select('*').eq('id', req.user.id).maybeSingle());
    if (!result.data) fail(404, 'NOT_FOUND', 'Profile not found. Apply the signup migration before creating accounts.');
    return { ...result.data, email: req.user.email, role: req.role };
  };
  api.get('/me', async (req, res) => res.json({ data: await ownProfile(req) }));
  api.patch('/me', role('student'), async (req, res) => {
    const patch = profilePatch.parse(req.body);
    await data(req.db.from('profiles').update(patch).eq('id', req.user.id));
    res.json({ data: await ownProfile(req) });
  });
  api.get('/localities', (_req, res) => res.json({ data: LOCALITIES }));
  api.get('/buses', (req, res) => {
    const locality = req.query.locality;
    if (locality !== undefined && !LOCALITIES.some(l => l.name === locality)) fail(400, 'VALIDATION_ERROR', 'Unknown locality.');
    res.json({ data: locality ? busesFor(locality) : buses, meta });
  });
  for (const [path, records, key] of [['buses', buses, 'no'], ['metro/lines', metroLines, 'id'], ['mmts/routes', mmtsRoutes, 'id']]) {
    if (path !== 'buses') api.get(`/${path}`, (_req, res) => res.json({ data: records, meta }));
    api.get(`/${path}/:id`, (req, res) => {
      const record = records.find(item => item[key] === req.params.id);
      if (!record) fail(404, 'NOT_FOUND', 'Route not found.');
      res.json({ data: record, meta });
    });
  }
  api.use('/me/saved-routes', role('student'));
  api.get('/me/saved-routes', async (req, res) => {
    const result = await data(req.db.from('saved_routes').select('route_no,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false }));
    res.json({ data: result.data.map(row => ({ ...row, bus: buses.find(b => b.no === row.route_no) || null })) });
  });
  api.put('/me/saved-routes/:no', async (req, res) => {
    if (!buses.some(bus => bus.no === req.params.no)) fail(404, 'NOT_FOUND', 'Bus not found.');
    await data(req.db.from('saved_routes').upsert({ user_id: req.user.id, route_no: req.params.no }, { onConflict: 'user_id,route_no', ignoreDuplicates: true }));
    const result = await data(req.db.from('saved_routes').select('route_no,created_at').eq('user_id', req.user.id).eq('route_no', req.params.no).single());
    res.json({ data: result.data });
  });
  api.delete('/me/saved-routes/:no', async (req, res) => {
    await data(req.db.from('saved_routes').delete().eq('user_id', req.user.id).eq('route_no', req.params.no));
    res.status(204).end();
  });
  api.use('/admin', role('hod'));
  api.get('/admin/summary', async (req, res) => {
    const result = await data(req.db.rpc('student_profiles', {}, { count: 'exact' }).limit(0));
    res.json({ data: { students: result.count, buses: buses.length, localities: LOCALITIES.length } });
  });
  api.get('/admin/students', async (req, res) => {
    const { page, limit, search, locality } = studentQuery.parse(req.query);
    let query = req.db.rpc('student_profiles', {}, { count: 'exact' });
    if (locality) query = query.eq('locality', locality);
    if (search) {
      // Restrict grammar above before building a PostgREST OR expression.
      const term = search.replace(/_/g, '\\_');
      query = query.or(`full_name.ilike.%${term}%,roll_number.ilike.%${term}%,locality.ilike.%${term}%`);
    }
    const result = await data(query.order('full_name').order('id').range((page - 1) * limit, page * limit - 1));
    res.json({ data: result.data, pagination: { page, limit, total: result.count } });
  });
  api.get('/admin/students/:id', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const result = await data(req.db.rpc('student_profiles').eq('id', id).maybeSingle());
    if (!result.data) fail(404, 'NOT_FOUND', 'Student not found.');
    res.json({ data: { ...result.data, buses: busesFor(result.data.locality) } });
  });
  api.get('/admin/localities', async (req, res) => {
    const rows = await Promise.all(LOCALITIES.map(async locality => {
      const result = await data(req.db.rpc('student_profiles', {}, { count: 'exact' }).eq('locality', locality.name).limit(0));
      return { ...locality, students: result.count, buses: busesFor(locality.name).length };
    }));
    res.json({ data: rows });
  });
  api.use((_req, _res) => fail(404, 'NOT_FOUND', 'Endpoint not found.'));
  app.use('/api/v1', api);
  app.use('/api', (_req, _res) => fail(404, 'NOT_FOUND', 'Endpoint not found.'));

  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  if (existsSync(resolve(dist, 'index.html'))) {
    app.use(express.static(dist, { setHeaders(res, path) {
      if (/index\.html$|service-worker\.js$/.test(path)) res.set('Cache-Control', 'no-cache');
    } }));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    const validation = error instanceof z.ZodError || error.type === 'entity.parse.failed';
    const status = validation ? 400 : error.type === 'entity.too.large' ? 413 : error.status || 500;
    res.status(status).json({ error: {
      code: validation ? 'VALIDATION_ERROR' : error.code || 'INTERNAL_ERROR',
      message: validation ? 'Check your input and try again.' : error instanceof ApiError ? error.message : 'Unable to complete the request.'
    } });
  });
  return app;
}
