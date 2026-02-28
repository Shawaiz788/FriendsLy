import { supabase } from './supabaseClient.js';

export async function registerUser(email, password) {
  return await supabase.auth.signUp({ email, password });
}

export async function loginUser(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}
