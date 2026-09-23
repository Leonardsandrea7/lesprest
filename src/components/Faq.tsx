import { useState } from "react";
import { Card } from "./ui";

const FAQS = [
  {
    q: "¿Cuánto tardan en aprobar mi préstamo?",
    a: "Revisamos cada solicitud manualmente. Normalmente toma unas horas en horario laboral. Te avisamos por WhatsApp apenas esté lista.",
  },
  {
    q: "¿Qué pasa si no pago a tiempo?",
    a: "Tienes 3 días de prórroga después de la fecha de vencimiento. Si pasado ese plazo no has pagado, tu cédula queda bloqueada y no podrás pedir nuevos préstamos.",
  },
  {
    q: "¿Cómo subo de nivel?",
    a: "Cada vez que completas tus préstamos pagando a tiempo, avanzas al siguiente nivel y puedes pedir un monto mayor.",
  },
  {
    q: "¿Dónde recibo el dinero?",
    a: "En los datos de Pago Móvil que registraste en tu perfil. Asegúrate de que estén correctos antes de solicitar.",
  },
  {
    q: "Ya pagué, ¿por qué sigue apareciendo pendiente?",
    a: "Verificamos cada pago manualmente contra el movimiento bancario. Una vez confirmado, el estado se actualiza automáticamente.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Card>
      <p className="font-display text-base font-semibold text-[var(--ink)]">Preguntas frecuentes</p>
      <div className="mt-3 divide-y divide-[var(--line)]">
        {FAQS.map((item, i) => (
          <div key={i} className="py-3">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-sm font-medium text-[var(--ink)]">{item.q}</span>
              <span className={`shrink-0 text-[var(--brand)] transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
            </button>
            {open === i && <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.a}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
