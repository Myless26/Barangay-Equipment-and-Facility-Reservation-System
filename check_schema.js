
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: profiles, error } = await supabase.from('user_profiles').select('*');
    if (error) console.error('Error fetching profiles:', error.message);
    else {
        console.log('--- Columns detected in user_profiles ---');
        const sample = profiles[0] || {};
        console.log(Object.keys(sample));
    }
}

check();
