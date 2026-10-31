export function createApi(getSession, fetcher = fetch) {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
  return async (path, options = {}) => {
    const { data, error } = await getSession();
    if (error || !data.session) throw new Error('Your session has expired. Please sign in again.');
    const response = await fetcher(`${base}${path}`, {
      ...options, cache: 'no-store',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
        Authorization: `Bearer ${data.session.access_token}`
      }
    });
    if (response.status === 204) return null;
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message || 'The server is unavailable. Please try again.');
    if (!result || !Object.hasOwn(result, 'data')) throw new Error('The server returned an invalid response.');
    return result;
  };
}
