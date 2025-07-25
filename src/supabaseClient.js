import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://knzwfzvcvxpumqmfvjrh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuendmenZjdnhwdW1xbWZ2anJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyODgxODMsImV4cCI6MjA2ODg2NDE4M30.kpyz7bJCl15GIsZcQ8onQvzA1diiKvrZhRXjOG_SSoA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
