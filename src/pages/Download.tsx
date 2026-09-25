import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui";

export function Download() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-6 text-center">
      <Link to="/"><Logo size="sm" /></Link>
      <h1 className="mt-8 font-display text-3xl font-semibold text-[var(--ink)]">LES PREST siempre contigo</h1>
      <p className="mt-3 max-w-sm text-[15px] text-[var(--muted)]">
        Administra tus préstamos desde tu teléfono de forma rápida y sencilla.
      </p>
      {installed ? (
        <p className="mt-8 font-semibold text-[var(--brand)]">✓ Aplicación instalada</p>
      ) : deferredPrompt ? (
        <Button className="mt-8" onClick={install}>Instalar aplicación</Button>
      ) : (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Desde el menú de tu navegador, elige "Agregar a pantalla de inicio" para instalar LES PREST.
        </p>
      )}
    </div>
  );
}
