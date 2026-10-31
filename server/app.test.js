import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from './app.js';
import { buses, metroLines, mmtsRoutes } from './data/transport.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const HOD = '33333333-3333-4333-8333-333333333333';
function fixture() {
  const rows = {
    profiles: [A, B, HOD].map((id, index) => ({ id, full_name: ['Asha', 'Bala', 'Head'][index], roll_number: `DT${index}`, year_of_study: '1st Year', locality: 'LB Nagar' })),
    user_roles: [A, B, HOD].map(id => ({ user_id: id, role: id === HOD ? 'hod' : 'student' })),
    saved_routes: []
  };
  const calls = [];
  function createDb(token) {
    const id = { a: A, b: B, hod: HOD }[token];
    function query(table) {
      const filters = [];
      let single = false, operation = 'select', payload, upsertOptions, range;
      const builder = {
        select() { return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        order() { return this; },
        limit(n) { range = [0, n - 1]; return this; },
        range(start, end) { range = [start, end]; return this; },
        maybeSingle() { single = true; return this; },
        single() { single = true; return this; },
        update(value) { operation = 'update'; payload = value; return this; },
        upsert(value, options) { operation = 'upsert'; payload = value; upsertOptions = options; return this; },
        delete() { operation = 'delete'; return this; },
        or() { return this; },
        then(resolve, reject) {
          try {
            calls.push({ table, filters, operation, payload, upsertOptions });
            const source = table === 'students' ? rows.profiles.filter(row => row.id !== HOD) : rows[table];
            let selected = source.filter(row => filters.every(([key, value]) => row[key] === value));
            if (operation === 'update') selected.forEach(row => Object.assign(row, payload));
            if (operation === 'delete') rows[table] = source.filter(row => !selected.includes(row));
            if (operation === 'upsert' && !source.some(row => row.user_id === payload.user_id && row.route_no === payload.route_no)) source.push({ ...payload, created_at: '2026-10-31T00:00:00Z' });
            const count = selected.length;
            if (range) selected = selected.slice(range[0], range[1] + 1);
            return Promise.resolve({ data: single ? selected[0] || null : selected, count, error: null }).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        }
      };
      return builder;
    }
    return {
      auth: { async getUser() { return { data: { user: id ? { id, email: `${token}@example.edu` } : null }, error: id ? null : new Error('invalid token') }; } },
      from: query,
      rpc() { return query('students'); }
    };
  }
  return { app: createApp({ createDb }), rows, calls };
}
const auth = (app, method, path, token = 'a') => request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

test('public health works without Supabase; protected endpoints require verified tokens', async () => {
  const { app } = fixture();
  assert.equal((await request(app).get('/api/v1/health')).body.data.status, 'ok');
  assert.equal((await request(app).get('/api/v1/me')).status, 401);
  for (const token of ['forged.jwt.token', 'expired']) assert.equal((await auth(app, 'get', '/me', token)).status, 401);
});
test('setup mode returns a useful error without fabricating authentication', async () => {
  const response = await auth(createApp({ env: {} }), 'get', '/me');
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'SETUP_REQUIRED');
});
test('transport API preserves all fixture records and returns real 404s', async () => {
  const { app } = fixture();
  for (const [path, records] of [['/buses', buses], ['/metro/lines', metroLines], ['/mmts/routes', mmtsRoutes]]) {
    const response = await auth(app, 'get', path);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, records);
    assert.equal(response.body.meta.sample, true);
    assert.equal((await auth(app, 'get', `${path}/missing`)).status, 404);
  }
  assert.equal(buses.length, 9);
  assert.equal((await auth(app, 'get', '/buses?locality=LB%20Nagar')).body.data.length, 3);
  assert.equal((await auth(app, 'get', '/buses?locality=unknown')).status, 400);
});
test('student cannot access any admin endpoint and cannot elevate privileges', async () => {
  const { app, rows } = fixture();
  for (const path of ['/admin/summary', '/admin/students', `/admin/students/${B}`, '/admin/localities']) assert.equal((await auth(app, 'get', path)).status, 403);
  for (const body of [{ role: 'hod' }, { id: B }, { roll_number: 'CHANGE' }, { full_name: '' }, { locality: 'unknown' }, {}]) assert.equal((await auth(app, 'patch', '/me').send(body)).status, 400);
  assert.equal(rows.user_roles[0].role, 'student');
});
test('profile update targets verified caller only', async () => {
  const { app, rows } = fixture();
  const response = await auth(app, 'patch', '/me').send({ full_name: 'New name', locality: 'KPHB' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.id, A);
  assert.equal(rows.profiles[0].full_name, 'New name');
  assert.equal(rows.profiles[1].full_name, 'Bala');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal((await auth(app, 'patch', '/me', 'hod').send({ full_name: 'New' })).status, 403);
});
test('saved routes are idempotent, scoped to caller, and removable', async () => {
  const { app, rows, calls } = fixture();
  const first = await auth(app, 'put', '/me/saved-routes/218-A');
  const second = await auth(app, 'put', '/me/saved-routes/218-A');
  assert.equal(first.status, 200);
  assert.deepEqual(second.body, first.body);
  assert.equal(rows.saved_routes.length, 1);
  assert.equal(rows.saved_routes[0].user_id, A);
  assert.equal(calls.find(call => call.operation === 'upsert').upsertOptions.ignoreDuplicates, true);
  assert.equal((await auth(app, 'get', '/me/saved-routes', 'b')).body.data.length, 0);
  assert.equal((await auth(app, 'get', '/me/saved-routes')).body.data[0].bus.no, '218-A');
  assert.equal((await auth(app, 'delete', '/me/saved-routes/218-A', 'b')).status, 204);
  assert.equal(rows.saved_routes.length, 1);
  assert.equal((await auth(app, 'delete', '/me/saved-routes/218-A')).status, 204);
  assert.equal(rows.saved_routes.length, 0);
  assert.equal((await auth(app, 'put', '/me/saved-routes/missing')).status, 404);
  assert.equal((await auth(app, 'put', '/me/saved-routes/218-A', 'hod')).status, 403);
});
test('HOD counts and student directory exclude HOD accounts; filters are validated', async () => {
  const { app } = fixture();
  assert.equal((await auth(app, 'get', '/admin/summary', 'hod')).body.data.students, 2);
  const list = await auth(app, 'get', '/admin/students?limit=1&page=2', 'hod');
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.pagination.total, 2);
  assert.equal((await auth(app, 'get', `/admin/students/${HOD}`, 'hod')).status, 404);
  assert.equal((await auth(app, 'get', `/admin/students/${A}`, 'hod')).body.data.buses.length, 3);
  for (const query of ['page=0', 'limit=101', 'search=x,role.eq.hod', 'locality=unknown']) assert.equal((await auth(app, 'get', `/admin/students?${query}`, 'hod')).status, 400);
});
test('malformed JSON is normalized and unknown API routes cannot return SPA HTML', async () => {
  const { app } = fixture();
  assert.equal((await auth(app, 'patch', '/me').set('Content-Type', 'application/json').send('{')).status, 400);
  const response = await auth(app, 'get', '/not-found');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});
