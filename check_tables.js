
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // We can't list all tables, but we can try to query them to see if they exist
    const tables = ['tenants', 'user_profiles', 'equipment', 'reservations', 'plans', 'resident_plans', 'notifications'];
    for (const t of tables) {
        const { error } = await supabase.from(t).select('id').limit(1);
        if (error) {
            console.log(`[Table] ${t}: FAILED (${error.message})`);
        } else {
            console.log(`[Table] ${t}: OK`);
        }
    }
}

listTables();
