import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !url.includes('YOUR_PROJECT') && key !== 'YOUR_PUBLIC_KEY');
export const supabase = configured ? createClient(url, key) : null;
export const authRedirect = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;
