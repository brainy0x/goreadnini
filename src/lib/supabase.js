import { createClient } from '@supabase/supabase-js'

// Hardcoded for instant access to the realm
const supabaseUrl = 'https://supabase.com/dashboard/project/llrvlycosonztcgurdrt'
const supabaseKey = 'sb_publishable_bWISGfxvN4MYwbjwVs1X_w_z5-FUOrG'

export const supabase = createClient(supabaseUrl, supabaseKey)
export const isConfigured = supabaseUrl !== 'https://supabase.co' && supabaseKey !== 'sb_publishable_bWISGfxvN4MYwbjwVs1X_w_z5-FUOrG'
