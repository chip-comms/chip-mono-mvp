import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase-backend/database.types';

// Helper function to generate organization slug from email
function generateEmailSlug(email: string): string {
  return (
    email
      .toLowerCase()
      .replace('@', '-at-')
      .replace(/\./g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + 's-workspace'
  );
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create a supabase client with the user's token
    const supabaseClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userEmail = user.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Check if user already exists in our database
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id, organization_id')
      .eq('id', user.id)
      .single();

    if (existingUser) {
      return NextResponse.json({
        message: 'User already exists',
        user: existingUser,
      });
    }

    // Generate organization details based on email
    const orgName = `${userEmail}'s Workspace`;
    const orgSlug = generateEmailSlug(userEmail);

    // Create organization first
    const { data: organization, error: orgError } = await supabaseClient
      .from('organizations')
      .insert({
        name: orgName,
        slug: orgSlug,
        storage_quota_mb: 10000, // Default quota
        settings: null,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Organization creation error:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    // Create user record with organization relationship
    const { data: userData, error: userCreateError } = await supabaseClient
      .from('users')
      .insert({
        id: user.id,
        email: userEmail,
        full_name: null, // Will be set during setup
        avatar_url: user.user_metadata?.avatar_url || null,
        organization_id: organization.id,
        role: 'owner',
        first_login_completed: false,
      })
      .select(
        `
        id,
        email,
        full_name,
        first_login_completed,
        organization_id,
        role
      `
      )
      .single();

    if (userCreateError) {
      console.error('User creation error:', userCreateError);

      // Clean up organization if user creation failed
      await supabaseClient
        .from('organizations')
        .delete()
        .eq('id', organization.id);

      return NextResponse.json(
        { error: 'Failed to create user record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: userData,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      message: 'User and organization created successfully',
    });
  } catch (error) {
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
