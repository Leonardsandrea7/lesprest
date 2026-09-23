import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useExchangeRate(): number | null {
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "usd_to_ves_rate")
      .maybeSingle()
      .then(({ data }) => {
        const value = (data as { value: number } | null)?.value;
        setRate(typeof value === "number" ? value : null);
      });
  }, []);

  return rate;
}
