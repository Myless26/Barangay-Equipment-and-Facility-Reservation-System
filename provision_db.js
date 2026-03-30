
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function provision() {
    console.log('[Setup] Synchronizing Community Registry (Safe Mode v2)...');

    const barangays = [
        { name: 'Barangay Carmen', domain: 'carmen', status: 'active', contact_email: 'carmen_admin@brgyhub.pro', plan: 'Enterprise', contact_name: 'Carmen Official' },
        { name: 'Barangay Gusa', domain: 'gusa', status: 'active', contact_email: 'gusa_admin@brgyhub.pro', plan: 'Enterprise', contact_name: 'Gusa Official' },
        { name: 'Barangay Iponan', domain: 'iponan', status: 'active', contact_email: 'angkolrogar69@gmail.com', plan: 'Enterprise', contact_name: 'Iponan Official' }
    ];

    for (const b of barangays) {
        const { data: existing } = await supabase.from('tenants').select('*').eq('domain', b.domain).maybeSingle();
        if (!existing) {
            console.log(`[Provisioning] Node: ${b.name}`);
            const { error: insErr } = await supabase.from('tenants').insert([b]);
            if (insErr) console.error(`[Fail] ${b.name}: ${insErr.message}`);
            else console.log(`[Success] Node: ${b.name} was added.`);
        } else {
            console.log(`[Active] Node: ${b.name} (${existing.id})`);
        }
    }

    console.log('[Setup] Mission Complete.');
}

provision();
