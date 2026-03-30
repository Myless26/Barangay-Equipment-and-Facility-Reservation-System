
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmins() {
    try {
        const { data: users, error: uErr } = await supabase.from('user_profiles').select('*').eq('email', 'angkolrogar69@gmail.com');
        if (uErr) throw uErr;
        console.log('--- User Profiles for angkolrogar69@gmail.com ---');
        console.log(users);

        const { data: allUsers, error: aErr } = await supabase.from('user_profiles').select('*').limit(10);
        console.log('--- Recent Profiles ---');
        console.log(allUsers);
    } catch (err) {
        console.error('Error during check:', err);
    }
}

checkAdmins();
