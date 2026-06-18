import { supabaseAdmin } from './supabase';
import dotenv from 'dotenv';

dotenv.config();

export async function seedSuperAdmin() {
  try {
    const seedEmail = process.env.SEED_ADMIN_EMAIL;
    const seedPassword = process.env.SEED_ADMIN_PASSWORD;

    if (!seedEmail || !seedPassword) {
      console.log('Seed admin credentials not configured. Skipping seeding.');
      return;
    }

    // Check if any admin profile already exists
    const { data: existingAdmins, error: selectError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (selectError) {
      console.error('Error checking for existing admin profiles during seeding:', selectError);
      return;
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log('Admin user(s) already exist. Seeding skipped.');
      return;
    }

    console.log(`Seeding initial super admin account for: ${seedEmail}...`);

    // Create the Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: seedEmail,
      password: seedPassword,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });

    if (authError) {
      // Check if user already exists in Auth but just missing in Profiles
      if (authError.message.includes('already exists')) {
        console.log('Auth user already exists. Attempting to create missing profile...');
        // Let's search auth users to get the ID
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          console.error('Failed to list users to resolve existing user ID:', listError);
          return;
        }
        const foundUser = usersData.users.find(u => u.email === seedEmail);
        if (foundUser) {
          await createProfileRow(foundUser.id, seedEmail);
        } else {
          console.error('Seeding failed: user exists in auth but could not be retrieved.');
        }
      } else {
        console.error('Failed to create auth user for seed admin:', authError.message);
      }
      return;
    }

    if (authData?.user) {
      await createProfileRow(authData.user.id, seedEmail);
    }
  } catch (err) {
    console.error('Unexpected error running database seeding:', err);
  }
}

async function createProfileRow(userId: string, email: string) {
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userId,
    email: email,
    role: 'admin',
    is_super_admin: true,
    account_status: 'active',
    is_first_login: false,
    full_name: 'Super Admin'
  });

  if (profileError) {
    console.error('Failed to create profile row for seed admin:', profileError.message);
  } else {
    console.log('Seeding completed successfully! Initial Super Admin profile created.');
  }
}
