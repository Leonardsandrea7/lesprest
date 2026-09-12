import { useEffect, useState, type ReactNode } from "react";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(mq || iosStandalone);
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Bloquea el uso de la app dentro del navegador y exige instalarla como
 * PWA. En Android/Chrome/Edge se puede instalar con un botón. En iOS
 * Safari, Apple no permite disparar la instalación por código: hay que
 * mostrar instrucciones manuales (Compartir -> Agregar a inicio).
 *
 * Se deja un enlace discreto para continuar en el navegador, porque en
 * algunos dispositivos la instalación automática puede fallar y bloquear
 * por completo el acceso dejaría a esas personas sin forma de entrar.
 */
export function InstallGate({ children }: { children: ReactNode }) {
  const [standalone, setStandalone] = useState(isStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setStandalone(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (standalone) return <>{children}</>;

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setStandalone(true);
    setDeferredPrompt(null);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-6 text-center">
      <span className="font-display text-xl font-semibold text-[var(--ink)]">LES PREST</span>
      <h1 className="mt-8 font-display text-2xl font-semibold text-[var(--ink)]">Instala la app para continuar</h1>
      <p className="mt-3 max-w-sm text-[15px] text-[var(--muted)]">
        LES PREST solo funciona como aplicación instalada. Instálala para acceder a tu cuenta.
      </p>

      {isIOS() ? (
        <div className="mt-8 max-w-xs rounded-2xl border border-[var(--line)] bg-white p-5 text-left text-sm text-[var(--ink)]">
          <p className="font-semibold">En iPhone:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Toca el botón "Compartir" (el cuadrado con la flecha) en Safari.</li>
            <li>Elige "Agregar a pantalla de inicio".</li>
            <li>Abre LES PREST desde el ícono que aparece en tu pantalla.</li>
          </ol>
        </div>
      ) : deferredPrompt ? (
        <button
          onClick={install}
          className="mt-8 rounded-xl bg-[var(--brand)] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-[var(--brand-dark)]"
        >
          Instalar aplicación
        </button>
      ) : (
        <div className="mt-8 max-w-xs rounded-2xl border border-[var(--line)] bg-white p-5 text-left text-sm text-[var(--ink)]">
          <p>Desde el menú de tu navegador, elige "Agregar a pantalla de inicio" o "Instalar aplicación".</p>
        </div>
      )}
    </div>
  );
}
