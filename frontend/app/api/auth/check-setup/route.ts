import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase-backend/database.types';

export async function GET(request: NextRequest) {
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

    // Check if user exists in our database and get their setup status
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
      return NextResponse.json({
        needsSetup: true,
        needsUserRecord: true,
        user: {
          id: user.id,
          email: user.email,
        },
      });
    }

    return NextResponse.json({
      needsSetup: !userData.first_login_completed,
      needsUserRecord: false,
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        first_login_completed: userData.first_login_completed,
      },
      organization: userData.organizations
        ? {
            id: userData.organizations.id,
            name: userData.organizations.name,
            slug: userData.organizations.slug,
          }
        : null,
    });
  } catch (error) {
    console.error('Setup check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
