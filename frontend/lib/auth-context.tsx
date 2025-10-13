'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  first_login_completed: boolean;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: AuthUser | null;
  organization: Organization | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (session: Session) => {
    try {
      const response = await fetch('/api/auth/check-setup', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.needsUserRecord) {
          // Create user record
          const createResponse = await fetch('/api/auth/create-user', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (createResponse.ok) {
            const createData = await createResponse.json();
            setUser(createData.user);
            setOrganization(createData.organization);
          }
        } else {
          setUser(data.user);
          setOrganization(data.organization);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const refreshAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSession(session);

    if (session) {
      await fetchUserData(session);
    } else {
      setUser(null);
      setOrganization(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOrganization(null);
    setSession(null);
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        await fetchUserData(session);
      }

      setLoading(false);
    };

    getInitialSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (session) {
        await fetchUserData(session);
      } else {
        setUser(null);
        setOrganization(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    organization,
    session,
    loading,
    signOut,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
