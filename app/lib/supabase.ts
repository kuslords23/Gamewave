import {createClient} from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Same SCN Supabase project and auth storage key as the hub. Never commit credentials.
export const supabase=url&&anonKey?createClient(url,anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:'kus-lords-auth'}}):null;
export const isSupabaseConfigured=()=>Boolean(supabase);
