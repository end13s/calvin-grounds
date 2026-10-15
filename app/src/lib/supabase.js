import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

// null until app/.env is filled in; main.jsx shows setup steps instead of a blank page
export const supabase = isConfigured ? createClient(url, anonKey) : null
