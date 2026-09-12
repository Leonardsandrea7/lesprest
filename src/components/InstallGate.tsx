import type { ReactNode } from "react";
import { useInstallPrompt } from "../lib/useInstallPrompt";

export function InstallGate({ children }: { children: ReactNode }) {
  const { canInstall, isStandalone, isIOS, promptInstall } = useInstallPrompt();

  if (isStandalone) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-6 text-center">
      <span className="font-display text-xl font-semibold text-[var(--ink)]">LES PREST</span>
      <h1 className="mt-8 font-display text-2xl font-semibold text-[var(--ink)]">Instala la app para continuar</h1>
      <p className="mt-3 max-w-sm text-[15px] text-[var(--muted)]">
        LES PREST solo funciona como aplicación instalada. Instálala para acceder a tu cuenta.
      </p>

      {isIOS ? (
        <div className="mt-8 max-w-xs rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 text-left text-sm text-[var(--ink)]">
          <p className="font-semibold">En iPhone:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Toca el botón "Compartir" (el cuadrado con la flecha) en Safari.</li>
            <li>Elige "Agregar a pantalla de inicio".</li>
            <li>Abre LES PREST desde el ícono que aparece en tu pantalla.</li>
          </ol>
        </div>
      ) : canInstall ? (
        <button
          onClick={promptInstall}
          className="mt-8 rounded-xl bg-[var(--brand)] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-[var(--brand-dark)]"
        >
          Instalar aplicación
        </button>
      ) : (
        <div className="mt-8 max-w-xs rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 text-left text-sm text-[var(--ink)]">
          <p>Desde el menú de tu navegador, elige "Agregar a pantalla de inicio" o "Instalar aplicación".</p>
        </div>
      )}
    </div>
  );
}
