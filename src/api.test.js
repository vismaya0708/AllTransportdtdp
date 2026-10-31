import { it, expect, vi } from 'vitest';
import { createApi } from './api.js';
it('forwards current Supabase token and never caches private API responses', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { id: 'a' } }) });
  const api = createApi(async () => ({ data: { session: { access_token: 'verified-session' } } }), fetcher);
  expect((await api('/me')).data.id).toBe('a');
  expect(fetcher).toHaveBeenCalledWith('/api/v1/me', expect.objectContaining({ cache: 'no-store', headers: { Authorization: 'Bearer verified-session' } }));
});
it('rejects missing sessions without making requests', async () => {
  const fetcher = vi.fn();
  const api = createApi(async () => ({ data: { session: null } }), fetcher);
  await expect(api('/me')).rejects.toThrow('expired');
  expect(fetcher).not.toHaveBeenCalled();
});
it('handles errors and bodyless deletes', async () => {
  const session = async () => ({ data: { session: { access_token: 'a' } } });
  const api = createApi(session, vi.fn().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Forbidden' } }) }).mockResolvedValueOnce({ status: 204 }));
  await expect(api('/admin/summary')).rejects.toThrow('Forbidden');
  await expect(api('/me/saved-routes/218', { method: 'DELETE' })).resolves.toBeNull();
});
