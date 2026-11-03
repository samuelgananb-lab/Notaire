import { supabaseAuth } from '../database/supabase.js';

export const DEFAULT_PREFS = Object.freeze({
  browser: true,
  h24: true,
  h1: true,
  gastos: true,
  semanal: false,
  daily: true,
  monthly: true,
  presupuesto: 0,
  presupuesto_categorias: null,
  presupuesto_categorias_version: 2
});

function normalizeBudgetCategories(value) {
  if (!Array.isArray(value)) return null;
  return value
    .filter(category => category && typeof category === 'object')
    .slice(0, 100)
    .map(category => {
      const amount = Number(category.value);
      const priority = Number(category.priority);
      return {
        id: String(category.id || '').trim().slice(0, 80),
        name: String(category.name || '').trim().slice(0, 40),
        emoji: String(category.emoji || '🏷️').slice(0, 12),
        value: Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0,
        priority: Number.isInteger(priority) && priority > 0 ? priority : 1
      };
    })
    .filter(category => category.id && category.name);
}

export function normalizePrefs(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const bool = (key) => (typeof source[key] === 'boolean' ? source[key] : DEFAULT_PREFS[key]);
  const presupuesto = Number(source.presupuesto);
  const categoriesVersion = Number(source.presupuesto_categorias_version);
  return {
    browser: bool('browser'),
    h24: bool('h24'),
    h1: bool('h1'),
    gastos: bool('gastos'),
    semanal: bool('semanal'),
    daily: bool('daily'),
    monthly: bool('monthly'),
    presupuesto: Number.isFinite(presupuesto) && presupuesto > 0 ? Math.round(presupuesto) : 0,
    presupuesto_categorias: normalizeBudgetCategories(source.presupuesto_categorias),
    presupuesto_categorias_version: Number.isInteger(categoriesVersion) && categoriesVersion >= 0
      ? categoriesVersion
      : Array.isArray(source.presupuesto_categorias) ? 0 : DEFAULT_PREFS.presupuesto_categorias_version
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
