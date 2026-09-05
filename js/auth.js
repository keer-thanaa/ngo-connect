import { supabase } from './supabaseClient.js';

// Basic client-side input hygiene. Real enforcement lives in Postgres
// (constraints + RLS in schema.sql) — this is just a fast, friendly
// first check so people get feedback before hitting the network.
export function cleanText(value, maxLen = 500) {
  return String(value || '').trim().slice(0, maxLen);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function getSessionProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, profile: null };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) return { session, profile: null };
  return { session, profile };
}

export async function requireAuth(redirectTo = 'login.html') {
  const { session, profile } = await getSessionProfile();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return { session, profile };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}
