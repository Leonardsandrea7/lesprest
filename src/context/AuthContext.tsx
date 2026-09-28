import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  full_name: string;
  id_card: string;
  phone: string;
  email: string;
  current_level: number;
  kyc_status: 'no_verificado' | 'en_revision' | 'verificado' | 'rechazado';
  is_blacklisted?: boolean;
  cedula_url?: string;
  selfie_url?: string;
  role: 'cliente' | 'admin';
  bank_name?: string;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: any | null; profile?: UserProfile | null }>;
  register: (data: any) => Promise<{ error: any | null; userId?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as UserProfile);
        return data as UserProfile;
      }
    } catch {
      // Supabase query error fallback
    }
    return null;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch {
        // Offline or connection error
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });

      if (error) {
        return { error };
      }

      if (data?.user) {
        setUser(data.user);
        const fetched = await fetchProfile(data.user.id);
        return { error: null, profile: fetched };
      }

      return { error: new Error('Usuario no encontrado') };
    } catch (err: any) {
      return { error: err };
    }
  };

  const register = async (data: any) => {
    try {
      let userId: string | undefined;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password
      });

      if (authError) {
        // Si el correo ya quedó registrado por un intento anterior que falló a
        // mitad de camino (usuario creado pero sin perfil), intentamos iniciar
        // sesión con esos mismos datos en vez de fallar de nuevo sin explicar nada.
        const msg = (authError.message || '').toLowerCase();
        const looksAlreadyRegistered = msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already');

        if (looksAlreadyRegistered) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password
          });

          if (signInError || !signInData.user) {
            return {
              error: new Error(
                'Ese correo ya está registrado, pero con una contraseña distinta a la que escribiste ahora. Si es tuyo, inicia sesión normal; si no recuerdas la contraseña, usa otro correo.'
              )
            };
          }

          userId = signInData.user.id;
          setUser(signInData.user);
        } else {
          return { error: authError };
        }
      } else {
        userId = authData.user?.id;
      }

      if (!userId) {
        return { error: new Error('No se pudo crear el usuario. Intenta de nuevo.') };
      }

      // Si ya existe un perfil (de un intento anterior que sí llegó a crearlo),
      // no lo dupliques ni lo pises: solo continúa.
      const existingProfile = await fetchProfile(userId);
      if (existingProfile) {
        return { error: null, userId };
      }

      const newProfile: Partial<UserProfile> & { cedula_url?: string; selfie_url?: string } = {
        id: userId,
        full_name: data.full_name,
        id_card: data.id_card,
        phone: data.phone,
        email: data.email,
        current_level: 1,
        kyc_status: 'en_revision',
        role: 'cliente',
        bank_name: data.bank_name,
        cedula_url: data.cedula_url,
        selfie_url: data.selfie_url
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([newProfile]);

      if (profileError) {
        // Antes este error se ignoraba y la app seguía como si nada — por eso
        // el registro "funcionaba" pero el perfil nunca existía. Ahora se
        // devuelve el motivo real (cédula duplicada, permisos, etc.) para
        // que el usuario y nosotros sepamos exactamente qué pasó.
        return { error: profileError, userId };
      }

      await fetchProfile(userId);
      return { error: null, userId };
    } catch (err: any) {
      return { error: err };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
