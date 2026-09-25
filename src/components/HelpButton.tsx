import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { whatsappLink } from "../lib/format";

export function HelpButton() {
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "support_whatsapp_number")
      .maybeSingle()
      .then(({ data }) => {
        const value = (data as { value: string } | null)?.value;
        if (value) setNumber(value);
      });
  }, []);

  if (!number) return null;

  return (
    <a
      href={whatsappLink(number, "Hola, necesito ayuda con LES PREST")}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105"
      aria-label="¿Necesitas ayuda?"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 8.7c.2-.5.5-.5.8-.5h.6c.2 0 .4 0 .6.4.2.5.6 1.4.7 1.5.1.1.1.3 0 .5-.1.2-.2.3-.4.5-.2.2-.4.3-.2.6.2.4.9 1.4 1.9 2.2 1.3 1.1 2.3 1.4 2.7 1.5.4.1.6.1.8-.1.2-.2.7-.8.9-1 .2-.2.4-.2.6-.1.2.1 1.5.7 1.7.8.2.1.4.2.4.4 0 .2 0 1-.4 1.5-.4.5-1.4.9-2.4.9-1 0-2.5-.4-4.3-1.9-2.2-1.9-3.4-4-3.6-4.3-.2-.3-1.1-1.5-1.1-2.8 0-1.3.7-1.9.9-2.1Z"
          fill="currentColor"
        />
      </svg>
    </a>
  );
}
