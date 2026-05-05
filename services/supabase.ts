
import { createClient } from '@supabase/supabase-js';

// Admin/Main Project
const supabaseAdminUrl = 'https://tqouzxlnihfjdyxqlbqs.supabase.co';
const supabaseAdminKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxb3V6eGxuaWhmamR5eHFsYnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjc5NzEsImV4cCI6MjA4NTcwMzk3MX0.INIjCt3RFHlq5KYSMymI1mcjVR_l-rHF-9LI5gFYRlY';

export const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey);

// Default export
export const supabase = supabaseAdmin;
