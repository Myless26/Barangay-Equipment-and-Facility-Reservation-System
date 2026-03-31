
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
    const iponanID = '00000000-0000-0000-0000-000000000000';

    console.log('[Seed] Inserting Admin Profile...');
    const { error: profileError } = await supabase.from('user_profiles').upsert([{
        id: '00000000-0000-0000-0000-000000000001', // Mock Supabase ID
        email: 'admin@iponan.brgy',
        full_name: 'Iponan Admin',
        role: 'Barangay Admin',
        tenant_id: iponanID,
        status: 'Approved'
    }]);
    if (profileError) console.error('Profile Error:', profileError.message);

    console.log('[Seed] Inserting Residents...');
    const { error: resError } = await supabase.from('residents').upsert([
        { full_name: 'Juan Dela Cruz', email: 'juan@example.com', tenant_id: iponanID, status: 'Active' },
        { full_name: 'Maria Clara', email: 'maria@example.com', tenant_id: iponanID, status: 'Active' },
        { full_name: 'Pedro Penduko', email: 'pedro@example.com', tenant_id: iponanID, status: 'Active' }
    ]);
    if (resError) console.error('Resident Error:', resError.message);

    console.log('[Seed] Inserting Plans...');
    const { error: planError } = await supabase.from('plans').upsert([
        { name: 'Basic Access', price: 0, tenant_id: iponanID },
        { name: 'Premium Resident', price: 150, tenant_id: iponanID },
        { name: 'Enterprise Hub', price: 500, tenant_id: iponanID }
    ]);
    if (planError) console.error('Plan Error:', planError);

    console.log('[Seed] Mission Complete.');
}

seedData();
