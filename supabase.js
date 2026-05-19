import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cvcaednwgxfmtjdwktlj.supabase.co'
const SUPABASE_KEY = 'sb_publishable_1tfjLV9OndRtq25dd_jE-g_8y-QMeLk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
