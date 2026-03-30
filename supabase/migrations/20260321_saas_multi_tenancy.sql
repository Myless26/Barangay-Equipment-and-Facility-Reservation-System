-- Multi-tenancy Isolation Migration
-- This script adds tenant_id to all relevant tables and enables RLS for data isolation.

-- 1. Ensure 'tenants' table exists with necessary fields
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'Basic',
    contact_name TEXT,
    contact_email TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add tenant_id to all tenant-scoped tables
-- Residents Table
CREATE TABLE IF NOT EXISTS residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified')),
    vax_status TEXT DEFAULT 'Unvaccinated',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment Table (Ensure columns match JS)
ALTER TABLE IF EXISTS equipment ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Reservations Table (Ensure columns match JS)
ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID, 
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for Tenant Isolation
-- For simplicity in this demo, we use a custom 'tenant-id' context set via set_config
-- or assume the app passes it in queries.

-- NOTE: In production, you'd use (auth.jwt() ->> 'tenant_id')::uuid
-- or a trigger-based approach.

DROP POLICY IF EXISTS tenant_isolation_select ON residents;
CREATE POLICY tenant_isolation_select ON residents
    FOR SELECT USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS tenant_isolation_select ON equipment;
CREATE POLICY tenant_isolation_select ON equipment
    FOR SELECT USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS tenant_isolation_select ON reservations;
CREATE POLICY tenant_isolation_select ON reservations
    FOR SELECT USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
