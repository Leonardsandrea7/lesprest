import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { supabase } from "../../lib/supabase";
import { Button, Field, Input, Alert } from "../../components/ui";

export function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    navigate("/app", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-6 py-10">
      <div className="w-full max-w-sm">
        <Link to="/"><Logo size="sm" /></Link>
        <h1 className="mt-6 font-display text-2xl font-semibold text-[var(--ink)]">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Solo necesitas tu correo y una contraseña.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Correo electrónico">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres">
            <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirmar contraseña">
            <Input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-semibold text-[var(--brand)]">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
