import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { supabase } from "../../lib/supabase";
import { Button, Field, Input, Alert } from "../../components/ui";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (profile?.role === "admin" || profile?.role === "superadmin") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/app", { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-6 py-10">
      <div className="w-full max-w-sm">
        <Link to="/"><Logo size="sm" /></Link>
        <h1 className="mt-6 font-display text-2xl font-semibold text-[var(--ink)]">Inicia sesión</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Correo electrónico">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          ¿No tienes cuenta?{" "}
          <Link to="/registro" className="font-semibold text-[var(--brand)]">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
