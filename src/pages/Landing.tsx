import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

const steps = [
  { n: 1, text: "Regístrate con tu correo." },
  { n: 2, text: "Verifica tu perfil (KYC)." },
  { n: 3, text: "Solicita tu préstamo." },
  { n: 4, text: "Recibe el dinero por Pago Móvil." },
  { n: 5, text: "Paga en 10 días." },
  { n: 6, text: "Desbloquea el siguiente nivel." },
];

const levels = [1, 5, 10, 20, 40, 80];

export function Landing() {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex gap-3">
          <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-black/5">
            Iniciar sesión
          </Link>
          <Link to="/registro" className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]">
            Crear cuenta
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-5xl gap-10 px-6 pb-16 pt-8 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] text-[var(--ink)] md:text-5xl">
            Tu préstamo seguro
          </h1>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[var(--muted)]">
            Empieza pequeño, cumple tus pagos y aumenta tu acceso. LES PREST crece contigo, un préstamo a la vez.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/registro" className="rounded-xl bg-[var(--brand)] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-[var(--brand-dark)]">
              Solicitar mi préstamo
            </Link>
            <Link to="/descargar" className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-6 py-3.5 text-[15px] font-semibold text-[var(--ink)] hover:border-[var(--brand)]">
              Instalar LES PREST
            </Link>
          </div>
        </div>

        {/* Escalera de niveles — visual de la progresión real del producto */}
        <div className="flex items-end justify-center gap-2.5">
          {levels.map((amount, i) => (
            <div key={amount} className="flex flex-col items-center gap-2">
              <span className="font-display text-sm font-semibold text-[var(--ink)] tabular">${amount}</span>
              <div
                className="w-11 rounded-t-lg bg-[var(--brand)]"
                style={{ height: `${44 + i * 26}px`, opacity: 0.55 + i * 0.09 }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-t border-[var(--line)] bg-[var(--paper-raised)] py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Cómo funciona</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="flex items-start gap-3 rounded-2xl border border-[var(--line)] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 font-display text-sm font-semibold text-[var(--brand)]">
                  {s.n}
                </span>
                <p className="pt-1 text-[15px] text-[var(--ink)]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] px-6 py-8 text-center text-sm text-[var(--muted)]">
        LES PREST — Este producto se encuentra en preparación para operar conforme a la regulación aplicable en Venezuela.
      </footer>
    </div>
  );
}
