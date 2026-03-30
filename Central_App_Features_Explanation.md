# Barangay Equipment and Facility Reservation System
## Central App Features Overview

### 1. Add / Tenant Signup & Provisioning
**How it works:** 
In the robust `CentralLanding` portal, there is a registration modal where new barangays can sign up. When submitted, the system first verifies the ReCAPTCHA token via the backend API to prevent spam. Then, it checks if the requested `domain` alias is already taken. If it's available, it inserts a new record into the `tenants` table in Supabase with their chosen plan, colors, and admin details. It automatically provisions an admin account for them in the authentication system and sets their initial status to `active`.

### 2. Tenant Activation / Deactivation
**How it works:** 
In the `SuperAdminDashboard`, the Super Admin has a "Toggle Status" button. Clicking this triggers a function which asks for confirmation and then updates the `status` column in the `tenants` table to either `'active'` or `'disabled'`. If a tenant is disabled, they are immediately restricted from accessing the platform.

### 3. Create DB (Logical Database Isolation)
**How it works:** 
Instead of creating heavy, separate physical databases for every single barangay, the system brilliantly uses **Logical Isolation via Row Level Security (RLS)** in Supabase. Every row in the database tables (like users, reservations, equipment) has a `tenant_id`. The Super Admin panel inserts the primary `tenant` record, and subsequent app logic uses this ID to ensure that Barangay A can never see or access Barangay B's data.

### 4. Create Domain (System Aliases)
**How it works:** 
During the tenant signup, the system captures a unique `domain` variable (e.g., `casisang`). This acts as the unique identifier and domain route (e.g., `casisang.brgyhub.pro` or `brgyhub.pro/casisang`). When users visit that specific route, the frontend queries the `tenants` table for that exact domain string to load the specific branding colors, features, and isolated database context for that barangay.

### 5. Tenant Update
**How it works:** 
In the `SuperAdminDashboard` registry tab, clicking the "Edit Metadata" on a barangay opens an edit modal. It populates the form with their current details, and upon saving, uses an "edit mode" to execute a Supabase `update()` query to modify their name, contact info, domain, and current plan.

### 6. Tenant Subscription Update
**How it works:** 
The Super Admin can click the "Manage Subscription" icon. This opens a dedicated modal that interacts with the `subscription_expires_at` timestamp column in the database. The system updates this date, allowing the administrators to easily extend or revoke a barangay's subscription access to the platform.

### 7. Tenant Notification / Email Broadcasts
**How it works:** 
The "Alert Network" feature in the Super Admin dashboard utilizes a newly created `notifications` table. The Super Admin writes an alert payload and chooses either a specific Barangay or "Global Broadcast". The system then inserts these alerts into the database, associating them with the correct `tenant_id` and targeting specific user roles. The use of Supabase Realtime means these alerts can pop up instantly on the tenant's screen.

### 8. Add Features if Needed (Feature Flags)
**How it works:** 
Inside the specific "Manage Plan" modal in the Super Admin dashboard, there are toggle switches for "Advanced Analytics" and "Custom Branding". These interact with a `features` JSONB column in the database. The frontend updates this JSON object (e.g., `{"analytics": true, "custom_branding": false}`). The Tenant App then checks this JSON object to conditionally show or hide premium UI features dynamically.

***
*Prepared for the 7:00 AM Presentation*
