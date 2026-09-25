import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/database.types";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile((data as Profile) ?? null);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);

      if (data.session) {
        try {
          await loadProfile(data.session.user.id);
        } finally {
          if (active) setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (!newSession) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // El cambio de sesión puede ocurrir antes de que el perfil termine de
      // cargarse. Mantener la aplicación en estado de carga evita que la
      // ruta /app se renderice con profile=null durante ese instante.
      setLoading(true);
      void loadProfile(newSession.user.id).finally(() => {
        if (active) setLoading(false);
      });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Actualiza el perfil automáticamente en cuanto cambie en la base de
  // datos (por ejemplo, cuando un admin aprueba un pago y sube de nivel),
  // sin que el usuario tenga que recargar la página.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`profile-changes-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${session.user.id}` },
        (payload) => setProfile(payload.new as Profile)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
