-- Revenue Claims Table (Certificates, Fees, etc.)
CREATE TABLE IF NOT EXISTS revenue_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Cancelled', 'Paid')),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES user_profiles(id)
);

ALTER TABLE revenue_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY revenue_user_read ON revenue_claims
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY revenue_admin_all ON revenue_claims
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() 
            AND role IN ('Barangay Admin', 'Captain', 'Super Admin')
            AND tenant_id = revenue_claims.tenant_id
        )
    );
