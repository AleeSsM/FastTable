import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { assertSupabaseConfigured, env } from '@/constants/env';
import { fetchForSupabase } from '@/lib/fetch-android';

assertSupabaseConfigured();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  global: {
    fetch: fetchForSupabase(),
  },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
