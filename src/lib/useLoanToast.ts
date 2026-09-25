import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "./lib/supabase";
import { playSuccessSound } from "../lib/sound";

/**
 * Hook liviano, separado de useUserLoanData a propósito: solo escucha
 * cambios de estado del préstamo para mostrar un aviso emergente + sonido.
 * No repite toda la carga pesada de datos (eso lo hace cada pantalla por
 * su cuenta con useUserLoanData). Tener dos hooks pesados corriendo al
 * mismo tiempo, con el mismo nombre de canal, causaba una pantalla en
 * blanco para los usuarios.
 */
export function useLoanToast() {
  const { profile } = useAuth();
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`loan-toast-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loans", filter: `user_id=eq.${profile.id}` },
        (payload:any) => {
          const oldStatus = (payload.old as { status?: string } | null)?.status;
          const newStatus = (payload.new as { status?: string } | null)?.status;
          if (oldStatus === newStatus) return;

          if (newStatus === "activo") {
            playSuccessSound();
            setToast({ title: "¡Préstamo aprobado! 🎉", body: "Tu dinero ya está en camino a tu Pago Móvil." });
          }
          if (newStatus === "pagado") {
            playSuccessSound();
            setToast({ title: "¡Préstamo pagado! 🎉", body: "Gracias por cumplir. Sigue así para subir de nivel." });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  return { toast, dismissToast: () => setToast(null) };
}
