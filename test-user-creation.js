/**
 * Test user creation using Supabase client library
 * This bypasses the Dashboard to test if the issue is Dashboard-specific
 */

import { createClient } from '@supabase/supabase-js';

// Use your environment variables
const supabaseUrl = 'https://vbcfaegexbygqgsstoig.supabase.co';
const supabaseServiceKey = 'sb_secret_LklXddnok7Hrrk4E41bX1A_TTdXi-Lp'; // Service key for admin operations

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testUserCreation() {
  console.log('Testing user creation via Supabase client...\n');

  // Test 1: Create user with Admin API
  console.log('Test 1: Creating user via Admin API...');
  const { data: user1, error: error1 } = await supabase.auth.admin.createUser({
    email: 'test-admin-' + Date.now() + '@example.com',
    password: 'TestPassword123!',
    email_confirm: true, // Auto-confirm email
    user_metadata: { name: 'Test Admin User' }
  });

  if (error1) {
    console.error('❌ Admin API Error:', error1);
  } else {
    console.log('✅ Admin API Success:', user1?.email);
  }

  // Test 2: Sign up a user (normal flow)
  console.log('\nTest 2: Creating user via signup...');
  const { data: user2, error: error2 } = await supabase.auth.signUp({
    email: 'test-signup-' + Date.now() + '@example.com',
    password: 'TestPassword123!',
    options: {
      data: { name: 'Test Signup User' }
    }
  });

  if (error2) {
    console.error('❌ Signup Error:', error2);
  } else {
    console.log('✅ Signup Success:', user2?.user?.email);
  }

  // Test 3: Invite a user
  console.log('\nTest 3: Inviting a user...');
  const { data: user3, error: error3 } = await supabase.auth.admin.inviteUserByEmail(
    'test-invite-' + Date.now() + '@example.com',
    { data: { name: 'Test Invited User' } }
  );

  if (error3) {
    console.error('❌ Invite Error:', error3);
  } else {
    console.log('✅ Invite Success:', user3?.email);
  }

  // List users to confirm
  console.log('\nListing all users...');
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ List Error:', listError);
  } else {
    console.log(`✅ Total users: ${users?.users?.length}`);
    users?.users?.slice(-3).forEach(u => {
      console.log(`  - ${u.email} (created: ${u.created_at})`);
    });
  }
}

// Run the test
testUserCreation().catch(console.error);