// supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zbjrmohdxtnqqkkubkbu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpianJtb2hkeHRucXFra3Via2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0MTY5MjcsImV4cCI6MjA2ODk5MjkyN30.yG4k75FUUKKGVXEbC30IP36w7JIXk6_CB8g6CU7aAWo';

export const supabase = createClient(supabaseUrl, supabaseKey);