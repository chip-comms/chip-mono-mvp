import { createClient } from './supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Sign up a new user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Object with user data or error
 */
export async function signUp(email: string, password: string) {
  const supabase = createClient();

  // Sign up with Supabase Auth
  // The user record is created automatically by a database trigger
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return { data: null, error: authError };
  }

  return { data: authData, error: null };
}

/**
 * Sign in a user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Object with user data or error
 */
export async function signIn(email: string, password: string) {
  const supabase = createClient();

  // Sign in with email and password
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Sign out the current user
 * @returns Object with error if any
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get the current user (client-side)
 * @returns Current user or null
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
