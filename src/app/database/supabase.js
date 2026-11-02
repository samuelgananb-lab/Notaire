import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (process.env.NODE_ENV === 'production' && supabaseUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('SUPABASE_URL debe ser una URL válida en producción.');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('SUPABASE_URL debe usar HTTPS en producción.');
  }
}

const missingSupabaseVariables = [
  !supabaseUrl && 'SUPABASE_URL',
  !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY'
].filter(Boolean);

if (missingSupabaseVariables.length) {
  throw new Error(
    `Faltan estas variables de entorno de Supabase: ${missingSupabaseVariables.join(', ')}. ` +
    'Configúralas en .env; consulta .env.example. No uses valores de ejemplo.'
  );
}

const authOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
};

export const supabase = createClient(supabaseUrl, supabaseServiceKey, authOptions);
export const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, authOptions);