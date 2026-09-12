import { useEffect, useState, type ReactNode } from "react";

// Se guarda fuera del componente, a nivel de módulo, para que el aviso
// de "se puede instalar" que el navegador dispara una sola vez, muy
// temprano, no se pierda aunque el componente se monte después.
let deferredPrompt: any = null;
let installed = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(mq || iosStandalone || installed);
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallGate({ children }: { children: ReactNode }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  if (isStandalone()) return <>{children}</>;

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") installed = true;
    deferredPrompt = null;
    forceUpdate((n) => n + 1);
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
