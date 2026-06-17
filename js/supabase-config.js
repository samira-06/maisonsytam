// Supabase Configuration
// 1. Va sur https://supabase.com → New project
// 2. Dans Project Settings → API : copie l'URL et l'anon key
// 3. Colle-les ci-dessous

const SUPABASE_CONFIG = {
  url: 'https://fgzeadkjjwcwegbupstz.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnemVhZGtqandjd2VnYnVwc3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MzAxODMsImV4cCI6MjA5NzAwNjE4M30.hcLP-ECcbsNX0-F3ZPER8kkyfGBG61hhMGYth3BkiIc',
};

const SUPABASE_READY = SUPABASE_CONFIG.url !== 'https://ton-projet.supabase.co';
