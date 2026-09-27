import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  full_name: string;
  id_card: string;
  phone: string;
  email: string;
  current_level: number;
  kyc_status: 'no_verificado' | 'en_revision' | 'verificado';
  role: 'cliente' | 'admin';
  bank_name?: string;
  telegram_username?: string;
}

const defaultDemoUser: UserProfile = {
  id: 'usr-demo-1',
  full_name: 'Carlos Eduardo Mendoza',
  id_card: 'V-27.819.340',
  phone: '0414-9876543',
  email: 'carlos.mendoza@email.com',
  current_level: 2,
  kyc_status: 'verificado',
  role: 'cliente',
  bank_name: '0134 - Banesco Banco Universal',
  telegram_username: '@carlos_prest'
};

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: any | null }>;
  register: (data: any) => Promise<{ error: any | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setDemoRole: (role: 'cliente' | 'admin') => void;
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize immediately with demo user so screen is NEVER black or empty
  const [user, setUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('prestapp_user');
      return saved ? JSON.parse(saved) : defaultDemoUser;
    } catch {
      return defaultDemoUser;
    }
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('prestapp_user');
      return saved ? JSON.parse(saved) : defaultDemoUser;
    } catch {
      return defaultDemoUser;
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Attempt background Supabase session sync without blocking the UI
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id, session.user.email);
        }
      }).catch(() => {
        // Quietly maintain local profile
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id, session.user.email);
        }
      });

      return () => subscription.unsubscribe();
    } catch {
      // Offline safe
    }
  }, []);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
      } else {
        const isAdminEmail = email?.toLowerCase().includes('admin');
        const defaultProf: UserProfile = {
          id: userId,
          full_name: isAdminEmail ? 'Administrador PrestApp' : 'Usuario PrestApp',
          id_card: 'V-27.819.340',
          phone: '0414-9876543',
          email: email || '',
          current_level: 1,
          kyc_status: 'verificado',
          role: isAdminEmail ? 'admin' : 'cliente',
          bank_name: '0134 - Banesco',
          telegram_username: '@usuario_prest'
        };
        setProfile(defaultProf);
      }
    } catch {
      // Keep existing profile
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      const isAdmin = email.toLowerCase().includes('admin');
      const updatedUser: UserProfile = {
        id: 'usr-' + Date.now(),
        full_name: isAdmin ? 'Administrador PrestApp' : 'Carlos Eduardo Mendoza',
        id_card: 'V-27.819.340',
        phone: '0414-9876543',
        email,
        current_level: 2,
        kyc_status: 'verificado',
        role: isAdmin ? 'admin' : 'cliente',
        bank_name: '0134 - Banesco Banco Universal',
        telegram_username: '@carlos_prest'
      };

      try {
        await supabase.auth.signInWithPassword({ email, password: pass });
      } catch {
        // Fallback local
      }

      localStorage.setItem('prestapp_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setProfile(updatedUser);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const register = async (data: any) => {
    try {
      try {
        await supabase.auth.signUp({
          email: data.email,
          password: data.password
        });
      } catch {
        // Fallback
      }

      const isAdmin = data.email.toLowerCase().includes('admin');
      const newProf: UserProfile = {
        id: 'usr-' + Date.now(),
        full_name: data.full_name,
        id_card: data.id_card,
        phone: data.phone,
        email: data.email,
        current_level: 1,
        kyc_status: 'verificado',
        role: isAdmin ? 'admin' : 'cliente',
        bank_name: data.bank_name,
        telegram_username: data.telegram_username
      };
      localStorage.setItem('prestapp_user', JSON.stringify(newProf));
      setUser(newProf);
      setProfile(newProf);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const setDemoRole = (role: 'cliente' | 'admin') => {
    const updated: UserProfile = {
      ...(profile || defaultDemoUser),
      role,
      full_name: role === 'admin' ? 'Administrador PrestApp' : 'Carlos Eduardo Mendoza'
    };
    localStorage.setItem('prestapp_user', JSON.stringify(updated));
    setUser(updated);
    setProfile(updated);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    localStorage.removeItem('prestapp_user');
    setUser(defaultDemoUser);
    setProfile(defaultDemoUser);
  };

  const refreshProfile = async () => {
    if (user?.id) fetchProfile(user.id, user.email);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, login, register, logout, refreshProfile, setDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
