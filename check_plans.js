
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlans() {
    const iponanID = '00000000-0000-0000-0000-000000000000';
    console.log(`Fetching plans for tenant: ${iponanID}`);
    const { data, error } = await supabase.from('plans').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Sample plan data:', data);
    data.forEach(p => {
        console.log(`- ${p.name} ($${p.price}) ID: ${p.id}`);
    });
}

checkPlans();
