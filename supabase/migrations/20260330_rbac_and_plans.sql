-- 1. Profiles Table with RBAC and Approval Status
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'Resident' CHECK (role IN ('Resident', 'Barangay Admin', 'Secretary', 'Captain', 'Custodian', 'Super Admin')),
    status TEXT NOT NULL DEFAULT 'Pending Approval' CHECK (status IN ('Pending Approval', 'Approved', 'Rejected')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Plans Table
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) DEFAULT 0.00,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Resident Plans (Assignments/Applications)
CREATE TABLE IF NOT EXISTS resident_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Expired', 'Cancelled')),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    approved_by UUID REFERENCES user_profiles(id)
);

-- 4. Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_plans ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Profiles: Users can read their own profile, Admins can read all in their tenant
CREATE POLICY profile_user_read ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY profile_admin_read ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() 
            AND role IN ('Barangay Admin', 'Captain', 'Super Admin')
            AND tenant_id = user_profiles.tenant_id
        )
    );

-- Plans: Everyone in the tenant can read plans
CREATE POLICY plans_select ON plans
    FOR SELECT USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- Resident Plans: Users can see their own, Admins can see all in tenant
CREATE POLICY res_plan_user_read ON resident_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY res_plan_admin_all ON resident_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() 
            AND role IN ('Barangay Admin', 'Captain', 'Super Admin')
            AND tenant_id = resident_plans.tenant_id
        )
    );

-- 6. Trigger for profile creation (Optional but recommended for consistency)
-- For now, we'll handle profile creation in the frontend to ensure tenant_id is set correctly.
