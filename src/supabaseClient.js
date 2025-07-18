import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tmibztgvgnfjkkzaolgc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtaWJ6dGd2Z25mamtremFvbGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NDk2MDcsImV4cCI6MjA2ODQyNTYwN30.oiNVXw8mn9ft4qpnih7bwoCTJyB_jEWUopXzMwJr8Oc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
