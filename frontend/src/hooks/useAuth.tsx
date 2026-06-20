import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'unit_head';
  is_super_admin: boolean;
  unit_id: string | null;
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  account_status: 'pending' | 'active' | 'suspended';
  is_first_login: boolean;
  telegram_chat_id: string | null;
  telegram_linked: boolean;
  created_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        console.error('Failed to load user profile from database:', error);
        setUser(null);
      } else {
        // Enforce block if suspended at client level
        if (profile.account_status === 'suspended') {
          console.warn('Suspended account detected.');
          await supabase.auth.signOut();
          setUser(null);
          alert('This account has been suspended. Please contact the administrator.');
        } else {
          setUser(profile as UserProfile);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    if (activeSession?.user) {
      await fetchProfile(activeSession.user.id);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsLoading(false);
  };

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      if (activeSession?.user) {
        fetchProfile(activeSession.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen to authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setUser(null);
        setIsLoading(false);
      }

      if (event === 'SIGNED_OUT' || currentSession === null) {
        queryClient.clear();
        navigate('/login', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
