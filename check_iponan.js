
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmins() {
    try {
        const { data: tenants, error: tErr } = await supabase.from('tenants').select('*');
        if (tErr) throw tErr;

        console.log('--- ALL Tenants ---');
        tenants.forEach(t => console.log(`${t.name} (domain: ${t.domain}, id: ${t.id})`));

        const iponan = tenants.find(t => t.name.toLowerCase().includes('iponan') || t.domain === 'iponan');

        if (iponan) {
            const { data: users, error: uErr } = await supabase.from('user_profiles').select('*').eq('tenant_id', iponan.id).eq('role', 'Barangay Admin');
            if (uErr) throw uErr;
            console.log('--- Iponan Admins ---');
            console.log(users);
        } else {
            console.log('No Iponan tenant found!');
        }
    } catch (err) {
        console.error('Error during check:', err);
    }
}

checkAdmins();
