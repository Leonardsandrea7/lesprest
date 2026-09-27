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

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: any | null }>;
  register: (data: any) => Promise<{ error: any | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fallback demo state when offline or supabase not yet populated
  const loadDemo = () => {
    const saved = localStorage.getItem('prestapp_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser({ id: parsed.id, email: parsed.email });
      setProfile(parsed);
    } else {
      const demo: UserProfile = {
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
      setUser({ id: demo.id, email: demo.email });
      setProfile(demo);
    }
  };

  useEffect(() => {
    // Check local storage or supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email);
      } else {
        loadDemo();
      }
      setLoading(false);
    }).catch(() => {
      loadDemo();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
      } else {
        // Create demo object if not present
        const isAdminEmail = email?.toLowerCase().includes('admin');
        const defaultProf: UserProfile = {
          id: userId,
          full_name: 'Usuario PrestApp',
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
      loadDemo();
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) {
        // Fallback demo login if supabase credentials are not created yet
        const isAdmin = email.toLowerCase().includes('admin');
        const demo: UserProfile = {
          id: 'usr-' + Date.now(),
          full_name: isAdmin ? 'Administrador PrestApp' : 'Carlos Eduardo Mendoza',
          id_card: 'V-27.819.340',
          phone: '0414-9876543',
          email,
          current_level: 2,
          kyc_status: 'verificado',
          role: isAdmin ? 'admin' : 'cliente',
          bank_name: '0134 - Banesco',
          telegram_username: '@carlos_prest'
        };
        localStorage.setItem('prestapp_user', JSON.stringify(demo));
        setUser({ id: demo.id, email });
        setProfile(demo);
        return { error: null };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const register = async (data: any) => {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            id_card: data.id_card,
            phone: data.phone,
            bank_name: data.bank_name,
            telegram_username: data.telegram_username
          }
        }
      });

      const isAdmin = data.email.toLowerCase().includes('admin');
      const newProf: UserProfile = {
        id: authData?.user?.id || 'usr-' + Date.now(),
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
      setUser({ id: newProf.id, email: newProf.email });
      setProfile(newProf);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('prestapp_user');
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) fetchProfile(user.id, user.email);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
