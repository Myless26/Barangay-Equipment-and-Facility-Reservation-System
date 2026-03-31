import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function injectPlans() {
    console.log('--- Injecting Basic Plans (Compatible Schema) ---');
    const { data: tenants, error: tError } = await supabase.from('tenants').select('id, name, domain');

    if (!tenants) {
        console.error('Failed to fetch tenants:', tError);
        return;
    }

    for (const t of tenants) {
        // Skip if plans already exist for this tenant
        const { data: existing } = await supabase.from('plans').select('id').eq('tenant_id', t.id);
        if (existing && existing.length > 0) {
            console.log(`Plans already exist for ${t.name} (${t.domain}). Skipping.`);
            continue;
        }

        console.log(`Injecting plans for ${t.name} (${t.domain})...`);
        const samplePlans = [
            { name: 'Standard Resident', price: 99, tenant_id: t.id },
            { name: 'Premium Resident', price: 199, tenant_id: t.id },
            { name: 'Business Enterprise', price: 499, tenant_id: t.id }
        ];

        const { error } = await supabase.from('plans').insert(samplePlans);
        if (error) console.error(`Error injecting for ${t.name}:`, error.message);
        else console.log(`Successfully injected 3 plans for ${t.name}.`);
    }
}

injectPlans();
