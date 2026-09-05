// ============================================================
// Fill these in from your Supabase project:
// Project Settings → API → Project URL / anon public key
//
// The anon key is safe to expose in frontend code — it only
// grants what your Row Level Security policies (sql/schema.sql)
// allow it to do. Never put your service_role key here.
// ============================================================
const SUPABASE_URL = 'https://focglwzfsnnqyemxbmcf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvY2dsd3pmc25ucXllbXhibWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxOTg0NDIsImV4cCI6MjEwMTc3NDQ0Mn0.loFY2Qsel59hkekA242c4kR8UNvfeAIp8Iin43z6Jp0';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
