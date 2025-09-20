-- ============================================================================
-- Create Test Users for Development Authentication
-- ============================================================================
-- IMPLEMENTATION_LEAD: Production-ready test user creation
-- Creates users for each role in the 5-role system
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
  created_at,
  updated_at,
  confirmation_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Admin User", "role": "admin"}'
)
ON CONFLICT (id) DO NOTHING;

-- Create internal user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated',
  'authenticated',
  'internal@example.com',
  crypt('internal123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Internal User", "role": "internal"}'
)
ON CONFLICT (id) DO NOTHING;

-- Create freelancer user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333',
  'authenticated',
  'authenticated',
  'freelancer@example.com',
  crypt('freelancer123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Freelancer User", "role": "freelancer"}'
)
ON CONFLICT (id) DO NOTHING;

-- Create client user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '44444444-4444-4444-4444-444444444444',
  'authenticated',
  'authenticated',
  'client@example.com',
  crypt('client123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Client User", "role": "client"}'
)
ON CONFLICT (id) DO NOTHING;

-- Create viewer user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-5555-5555-555555555555',
  'authenticated',
  'authenticated',
  'viewer@example.com',
  crypt('viewer123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Viewer User", "role": "viewer"}'
)
ON CONFLICT (id) DO NOTHING;

-- Create corresponding user profiles (using the trigger)
-- The trigger should automatically create these, but let's ensure they exist
INSERT INTO user_profiles (user_id, name, email, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Admin User', 'admin@example.com', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Internal User', 'internal@example.com', 'internal'),
  ('33333333-3333-3333-3333-333333333333', 'Freelancer User', 'freelancer@example.com', 'freelancer'),
  ('44444444-4444-4444-4444-444444444444', 'Client User', 'client@example.com', 'client'),
  ('55555555-5555-5555-5555-555555555555', 'Viewer User', 'viewer@example.com', 'viewer')
ON CONFLICT (user_id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Display created users
SELECT
  u.email,
  up.role,
  up.name,
  u.created_at
FROM auth.users u
JOIN user_profiles up ON u.id = up.user_id
WHERE u.email LIKE '%@example.com'
ORDER BY up.role;

-- ============================================================================
-- Test users created successfully:
-- admin@example.com / admin123 (admin role)
-- internal@example.com / internal123 (internal role)
-- freelancer@example.com / freelancer123 (freelancer role)
-- client@example.com / client123 (client role)
-- viewer@example.com / viewer123 (viewer role)
-- ============================================================================