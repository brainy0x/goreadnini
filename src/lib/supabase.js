import { createClient } from '@supabase/supabase-js'

// Hardcoded for instant access to the realm
const supabaseUrl = 'https://llrvlycosonztcgurdrt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscnZseWNvc29uenRjZ3VyZHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Nzc2MDIsImV4cCI6MjA5MjI1MzYwMn0.311KXaQib1OnN922dZjcVtBq93ZBcaHiCR-SYb1HD50'

export const supabase = createClient(supabaseUrl, supabaseKey)
export const isConfigured = supabaseUrl !== 'https://supabase.co' && supabaseKey !== 'sb_publishable_bWISGfxvN4MYwbjwVs1X_w_z5-FUOrG'
