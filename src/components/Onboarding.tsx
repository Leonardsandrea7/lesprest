import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const SEEN_KEY = "lp_onboarding_seen";

const STEPS = [
  {
    icon: <VerifyIcon />,
    title: "Verifica tu identidad",
    body: "Completa tus datos y toma 2 fotos rápidas: tu cédula y una selfie. Es el primer paso para poder pedir tu préstamo.",
  },
  {
    icon: <RequestIcon />,
    title: "Pide tu préstamo",
    body: "Elige tu monto y, desde el Nivel 3, hasta en cuántas cuotas quieres pagar. Verás siempre cuánto recibes y cuánto debes devolver.",
  },
  {
    icon: <MoneyIcon />,
    title: "Recibe el dinero",
    body: "Una vez aprobado, te transferimos directo a tu Pago Móvil. Te avisamos apenas esté en camino.",
  },
  {
    icon: <LevelUpIcon />,
    title: "Paga a tiempo y sube de nivel",
    body: "Cada vez que completas tus pagos a tiempo, tu próximo préstamo puede ser más grande.",
  },
];

export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) setVisible(true);
  }, []);

  function close() {
    localStorage.setItem(SEEN_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--paper)] px-6 py-10">
      <div className="flex justify-center">
        <Logo size="md" withText={false} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--brand)]/10 text-[var(--brand)]">
          {current.icon}
        </div>
        <h2 className="mt-6 font-display text-xl font-semibold text-[var(--ink)]">{current.title}</h2>
        <p className="mt-2 max-w-xs text-[15px] text-[var(--muted)]">{current.body}</p>
      </div>

      <div className="mb-6 flex justify-center gap-1.5">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-[var(--brand)]" : "w-1.5 bg-[var(--line)]"}`}
          />
        ))}
      </div>

      <div className="flex gap-3">
        {!isLast && (
          <button onClick={close} className="flex-1 rounded-xl py-3 text-[15px] font-semibold text-[var(--muted)]">
            Saltar
          </button>
        )}
        <button
          onClick={() => (isLast ? close() : setStep((s) => s + 1))}
          className="flex-[2] rounded-xl bg-[var(--brand)] py-3 text-[15px] font-semibold text-white hover:bg-[var(--brand-dark)]"
        >
          {isLast ? "Comenzar" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}

function VerifyIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 15.5c0-1.4 1.3-2.3 3-2.3s3 .9 3 2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13.5 10h5M13.5 13h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function RequestIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5v9M9 9.7c0-1 1-1.7 3-1.7s3 .7 3 1.9c0 2.4-6 1.7-6 4.1 0 1.2 1.2 1.9 3 1.9s3-.6 3-1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function MoneyIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 9v0M18.5 15v0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function LevelUpIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V14M9.5 20V10M15 20V6M20 20V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 14l5.5-4L15 6l5-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
