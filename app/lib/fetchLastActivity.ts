import { supabase } from './supabaseClient';

export async function fetchLastActivity(symbols?: string[]) {
  let query = supabase
    .from('assetjet_last_activity')
    .select('*');

  if (symbols && symbols.length) {
    query = query.in('symbol', symbols);
  }

  const { data, error } = await query.order('symbol', { ascending: true });

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  return data ?? [];
}
