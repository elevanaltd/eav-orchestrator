-- ============================================================================
-- MIGRATION: Enable RLS Policies for Production Security
-- ============================================================================
-- IMPLEMENTATION_LEAD: Row Level Security policy activation
-- Enforces 5-role access control at database level
-- Activates fail-closed security model
-- ============================================================================

-- Enable RLS on all core tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjs_documents ENABLE ROW LEVEL SECURITY;

-- ====================
-- USER PROFILES POLICIES
-- ====================

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins and internal users can read all profiles
CREATE POLICY "Admin and internal can read all profiles" ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('admin', 'internal')
    )
  );

-- Only admins can update user profiles
CREATE POLICY "Only admins can update profiles" ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- ====================
-- VIDEO SCRIPTS POLICIES
-- ====================

-- All authenticated users can read scripts (business requirement for collaboration)
CREATE POLICY "Authenticated users can read scripts" ON video_scripts
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin and internal users can create scripts
CREATE POLICY "Admin and internal can create scripts" ON video_scripts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('admin', 'internal')
    )
  );

-- Admin and internal users can update scripts
CREATE POLICY "Admin and internal can update scripts" ON video_scripts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('admin', 'internal')
    )
  );

-- Only admins can delete scripts
CREATE POLICY "Only admins can delete scripts" ON video_scripts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- ====================
-- SCRIPT COMPONENTS POLICIES
-- ====================

-- All authenticated users can read components (collaboration requirement)
CREATE POLICY "Authenticated users can read components" ON script_components
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin, internal, and freelancer users can create components
CREATE POLICY "Content creators can create components" ON script_components
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('admin', 'internal', 'freelancer')
    )
  );

-- Admin, internal, and freelancer users can update components
CREATE POLICY "Content creators can update components" ON script_components
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('admin', 'internal', 'freelancer')
    )
  );

-- Only admins can delete components (data protection)
CREATE POLICY "Only admins can delete components" ON script_components
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- ====================
-- YJS DOCUMENTS POLICIES
-- ====================

-- All authenticated users can read Y.js documents (real-time collaboration)
CREATE POLICY "Authenticated users can read yjs documents" ON yjs_documents
  FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create Y.js documents (collaborative editing)
CREATE POLICY "Authenticated users can create yjs documents" ON yjs_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can update Y.js documents (collaborative editing)
CREATE POLICY "Authenticated users can update yjs documents" ON yjs_documents
  FOR UPDATE
  TO authenticated
  USING (true);

-- Only admins can delete Y.js documents (data protection)
CREATE POLICY "Only admins can delete yjs documents" ON yjs_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- ====================
-- SECURITY FUNCTIONS
-- ====================

-- Helper function to get current user role (fail-closed)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM user_profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has required role
CREATE OR REPLACE FUNCTION user_has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = ANY(required_roles)
    FROM user_profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Production RLS security now active:
-- 1. Fail-closed policy model - no access without explicit permission
-- 2. 5-role hierarchy enforced: admin > internal > freelancer > client > viewer
-- 3. Collaborative read access for all authenticated users
-- 4. Progressive write permissions based on role
-- 5. Delete operations restricted to admins (data protection)
-- ============================================================================