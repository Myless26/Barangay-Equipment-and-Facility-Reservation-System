
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
    console.log('Fetching all tenants...');
    const { data, error } = await supabase.from('tenants').select('*');
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('Tenants found:', data.length);
    data.forEach(t => {
        console.log(`- ${t.name} (${t.domain}) [${t.status}] ID: ${t.id}`);
    });
}

checkTenants();
