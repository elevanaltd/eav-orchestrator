-- ============================================================================
-- EAV ORCHESTRATOR SEED DATA
-- Extracted from 14 migration files during schema reset
-- Critical-Engineer: consulted for Database schema evolution strategy
-- ============================================================================

-- Disable RLS for seeding (will be re-enabled by schema)
SET session_replication_role = replica;

-- ============================================================================
-- SECTION 1: AUTHENTICATION USERS (5-Role System)
-- ============================================================================

-- Create admin user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'admin@example.com',
  '$2a$10$rMegaUgzaRhJWzEcfWmIa.dN7t8e5G8P3Q5a2I7S8hLCRv0XkZKxW',
  NOW(),
  NOW(),
  '',
  NOW(),
  '',
  NOW(),
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Admin User"}',
  false,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NOW(),
  '',
  0,
  NULL,
  '',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create internal user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated',
  'authenticated',
  'internal@example.com',
  '$2a$10$rMegaUgzaRhJWzEcfWmIa.dN7t8e5G8P3Q5a2I7S8hLCRv0XkZKxW',
  NOW(),
  NOW(),
  '',
  NOW(),
  '',
  NOW(),
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Internal User"}',
  false,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NOW(),
  '',
  0,
  NULL,
  '',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create freelancer user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333',
  'authenticated',
  'authenticated',
  'freelancer@example.com',
  '$2a$10$rMegaUgzaRhJWzEcfWmIa.dN7t8e5G8P3Q5a2I7S8hLCRv0XkZKxW',
  NOW(),
  NOW(),
  '',
  NOW(),
  '',
  NOW(),
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Freelancer User"}',
  false,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NOW(),
  '',
  0,
  NULL,
  '',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create client user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '44444444-4444-4444-4444-444444444444',
  'authenticated',
  'authenticated',
  'client@example.com',
  '$2a$10$rMegaUgzaRhJWzEcfWmIa.dN7t8e5G8P3Q5a2I7S8hLCRv0XkZKxW',
  NOW(),
  NOW(),
  '',
  NOW(),
  '',
  NOW(),
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Client User"}',
  false,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NOW(),
  '',
  0,
  NULL,
  '',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create viewer user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-5555-5555-555555555555',
  'authenticated',
  'authenticated',
  'viewer@example.com',
  '$2a$10$rMegaUgzaRhJWzEcfWmIa.dN7t8e5G8P3Q5a2I7S8hLCRv0XkZKxW',
  NOW(),
  NOW(),
  '',
  NOW(),
  '',
  NOW(),
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Viewer User"}',
  false,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NOW(),
  '',
  0,
  NULL,
  '',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create system user for data migration and system operations
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-9999-9999-999999999999',
  'authenticated',
  'authenticated',
  'system@eav-orchestrator.local',
  '$2a$10$rMegaUgzaRhJWzEcfWmIa.dN7t8e5G8P3Q5a2I7S8hLCRv0XkZKxW',
  NOW(),
  NOW(),
  '',
  NOW(),
  '',
  NOW(),
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "System User"}',
  false,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NOW(),
  '',
  0,
  NULL,
  '',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 2: USER PROFILES (Matches Authentication Users)
-- ============================================================================

-- Create corresponding user profiles (using the trigger)
-- The trigger should automatically create these, but let's ensure they exist
INSERT INTO user_profiles (user_id, name, email, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Admin User', 'admin@example.com', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Internal User', 'internal@example.com', 'internal'),
  ('33333333-3333-3333-3333-333333333333', 'Freelancer User', 'freelancer@example.com', 'freelancer'),
  ('44444444-4444-4444-4444-444444444444', 'Client User', 'client@example.com', 'client'),
  ('55555555-5555-5555-5555-555555555555', 'Viewer User', 'viewer@example.com', 'viewer')
ON CONFLICT (user_id) DO NOTHING;

-- Create corresponding user profile for system user
INSERT INTO user_profiles (
  user_id,
  name,
  email,
  role
) VALUES (
  '99999999-9999-9999-9999-999999999999',
  'System User',
  'system@eav-orchestrator.local',
  'admin'
) ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- SECTION 3: SYSTEM DEFAULT RECORDS
-- ============================================================================

-- System default client
INSERT INTO clients (
  client_id,
  client_name,
  contact_email,
  is_system_default,
  created_by,
  updated_by
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'System Default Client',
  'system@eav-orchestrator.local',
  true,
  '99999999-9999-9999-9999-999999999999',
  '99999999-9999-9999-9999-999999999999'
) ON CONFLICT (client_id) DO NOTHING;

-- System default project
INSERT INTO projects (
  project_id,
  client_id,
  project_name,
  project_code,
  project_status,
  is_system_default,
  created_by,
  updated_by
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'System Default Project',
  'SYS000',
  'active',
  true,
  '99999999-9999-9999-9999-999999999999',
  '99999999-9999-9999-9999-999999999999'
) ON CONFLICT (project_id) DO NOTHING;

-- System default video
INSERT INTO videos (
  video_id,
  project_id,
  video_title,
  video_description,
  video_status,
  is_system_default,
  created_by,
  updated_by
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'System Default Video',
  'Default video for system initialization',
  'planning',
  true,
  '99999999-9999-9999-9999-999999999999',
  '99999999-9999-9999-9999-999999999999'
) ON CONFLICT (video_id) DO NOTHING;

-- ============================================================================
-- SECTION 4: TEST DATA FOR DEVELOPMENT
-- ============================================================================

-- Insert test client if not exists
INSERT INTO clients (client_id, client_name, contact_email)
VALUES ('00000000-0000-0000-0000-000000000011', 'Test Client', 'test@example.com')
ON CONFLICT (client_id) DO NOTHING;

-- Insert test project if not exists
INSERT INTO projects (project_id, client_id, project_name, project_code, project_status)
VALUES ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000011', 'EAV007 Test Project', 'EAV007', 'collection')
ON CONFLICT (project_id) DO NOTHING;

-- Insert test videos from SmartSuite data
INSERT INTO videos (video_id, project_id, video_title, video_description, video_status)
VALUES
  ('68c2c7c8-108d-1de0-6aa1-b7c200000001', '00000000-0000-0000-0000-000000000012', 'Test Video 1', 'Test video for EAV007 project', 'planning'),
  ('68c2c7c8-108d-1de0-6aa1-b7c200000002', '00000000-0000-0000-0000-000000000012', 'Test Video 2', 'Second test video for EAV007 project', 'in_production')
ON CONFLICT (video_id) DO NOTHING;

-- Re-enable RLS after seeding
SET session_replication_role = DEFAULT;

-- ============================================================================
-- SEED COMPLETE - All essential data for EAV Orchestrator operation
-- ============================================================================