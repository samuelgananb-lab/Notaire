import { supabaseAuth } from '../database/supabase.js';

export const DEFAULT_PREFS = Object.freeze({
  browser: true,
  h24: true,
  h1: true,
  gastos: true,
  semanal: false,
  presupuesto: 0
});

export function normalizePrefs(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const bool = (key) => (typeof source[key] === 'boolean' ? source[key] : DEFAULT_PREFS[key]);
  const presupuesto = Number(source.presupuesto);
  return {
    browser: bool('browser'),
    h24: bool('h24'),
    h1: bool('h1'),
    gastos: bool('gastos'),
    semanal: bool('semanal'),
    presupuesto: Number.isFinite(presupuesto) && presupuesto > 0 ? Math.round(presupuesto) : 0
  };
}

export async function getPrefs(authId) {
  if (!authId) return { ...DEFAULT_PREFS };
  try {
    const { data, error } = await supabaseAuth.auth.admin.getUserById(authId);
    if (error) throw error;
    return normalizePrefs(data?.user?.user_metadata?.notificaciones);
  } catch (error) {
    console.error('No se pudieron leer las preferencias de notificación:', error.message);
    return { ...DEFAULT_PREFS };
  }
}

export async function savePrefs(authId, prefs) {
  const { data, error } = await supabaseAuth.auth.admin.getUserById(authId);
  if (error) throw error;
  const normalized = normalizePrefs(prefs);
  const metadata = { ...(data?.user?.user_metadata || {}), notificaciones: normalized };
  const { error: updateError } = await supabaseAuth.auth.admin.updateUserById(authId, { user_metadata: metadata });
  if (updateError) throw updateError;
  return normalized;
}
