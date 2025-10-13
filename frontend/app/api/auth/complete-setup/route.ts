import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase-backend/database.types';

// Helper function to generate organization slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
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

    // Parse request body
    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return NextResponse.json(
        {
          error: 'Name must be between 2 and 100 characters',
        },
        { status: 400 }
      );
    }

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

    // Get user's organization
    const { data: userData, error: dbError } = await supabaseClient
      .from('users')
      .select(
        `
        id,
        email,
        full_name,
        first_login_completed,
        organization_id,
        role,
        organizations (
          id,
          name,
          slug
        )
      `
      )
      .eq('id', user.id)
      .single();

    if (dbError || !userData) {
      return NextResponse.json(
        { error: 'User record not found' },
        { status: 404 }
      );
    }

    if (userData.first_login_completed) {
      return NextResponse.json(
        { error: 'Setup already completed' },
        { status: 400 }
      );
    }

    if (!userData.organizations) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    // Generate new organization name and slug
    const newOrgName = `${trimmedName}'s Personal Workspace`;
    const newOrgSlug = generateSlug(`${trimmedName}s-personal-workspace`);

    // Update organization first
    const { error: orgError } = await supabaseClient
      .from('organizations')
      .update({
        name: newOrgName,
        slug: newOrgSlug,
      })
      .eq('id', userData.organization_id);

    if (orgError) {
      console.error('Organization update error:', orgError);
      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      );
    }

    // Update user
    const { error: userUpdateError } = await supabaseClient
      .from('users')
      .update({
        full_name: trimmedName,
        first_login_completed: true,
      })
      .eq('id', user.id);

    if (userUpdateError) {
      console.error('User update error:', userUpdateError);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // Return updated data
    return NextResponse.json({
      user: {
        id: user.id,
        email: userData.email,
        full_name: trimmedName,
        role: userData.role,
        first_login_completed: true,
      },
      organization: {
        id: userData.organization_id,
        name: newOrgName,
        slug: newOrgSlug,
      },
    });
  } catch (error) {
    console.error('Setup completion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
