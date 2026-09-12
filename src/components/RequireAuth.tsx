import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, profile, loading, isAdmin } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin && profile) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
