
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function provisionProfiles() {
    const { data: tenants } = await supabase.from('tenants').select('*');
    const iponan = tenants.find(t => t.domain === 'iponan');
    const carmen = tenants.find(t => t.domain === 'carmen');
    const gusa = tenants.find(t => t.domain === 'gusa');

    if (!iponan || !carmen || !gusa) throw new Error('Missing tenants in database.');

    const profiles = [
        { full_name: 'Iponan Admin', email: 'angkolrogar69@gmail.com', role: 'Barangay Admin', tenant_id: iponan.id, status: 'Approved' },
        { full_name: 'Resident Iponan', email: 'resident_iponan@brgyhub.pro', role: 'Resident', tenant_id: iponan.id, status: 'Approved' },
        { full_name: 'Carmen Admin', email: 'carmen_admin@brgyhub.pro', role: 'Barangay Admin', tenant_id: carmen.id, status: 'Approved' },
        { full_name: 'Resident Carmen', email: 'resident_carmen@brgyhub.pro', role: 'Resident', tenant_id: carmen.id, status: 'Approved' },
        { full_name: 'Gusa Admin', email: 'gusa_admin@brgyhub.pro', role: 'Barangay Admin', tenant_id: gusa.id, status: 'Approved' },
        { full_name: 'Resident Gusa', email: 'resident_gusa@brgyhub.pro', role: 'Resident', tenant_id: gusa.id, status: 'Approved' }
    ];

    console.log('[Setup] Synchronizing Identities (Manual Link mode)...');

    for (const p of profiles) {
        const { data: existing } = await supabase.from('user_profiles').select('email').eq('email', p.email).maybeSingle();
        if (!existing) {
            console.log(`[Adding] Identity: ${p.full_name}`);
            const { error: insErr } = await supabase.from('user_profiles').insert([p]);
            if (insErr) console.error(`[Fail] ${p.full_name}: ${insErr.message}`);
            else console.log(`[Success] Identity Registered: ${p.full_name}`);
        } else {
            console.log(`[Active] Identity Node Registered: ${p.full_name}`);
        }
    }

    console.log('[Setup] Environment Synchronized.');
}

provisionProfiles();
