import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Button, Badge, EmptyState, Alert } from "../../components/ui";
import { formatDate } from "../../lib/format";

interface BlacklistRow {
  document_id: string;
  full_name: string | null;
  reason: string;
  blacklisted_at: string;
  removed_at: string | null;
}

export function AdminBlacklist() {
  const [rows, setRows] = useState<BlacklistRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function load() {
    const { data } = await supabase.from("document_blacklist").select("*").order("blacklisted_at", { ascending: false });
    setRows((data as BlacklistRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function runCheck() {
    setRunning(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("mark_defaulters", { p_prorroga_dias: 3 });
    setRunning(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const count = (data as unknown[])?.length ?? 0;
    setMessage(count > 0 ? `${count} préstamo(s) vencidos detectados y cédula(s) bloqueada(s).` : "No hay nuevos morosos por ahora.");
    load();
  }

  async function remove(documentId: string) {
    const notes = window.prompt("Motivo para quitarlo de la lista negra (ej: deuda regularizada):") ?? undefined;
    const { error } = await supabase.rpc("admin_remove_from_blacklist", { p_document_id: documentId, p_notes: notes });
    if (error) return alert(error.message);
    load();
  }

  const active = rows.filter((r) => !r.removed_at);
  const removed = rows.filter((r) => r.removed_at);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Lista negra (morosos)</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Cédulas bloqueadas automáticamente por no pagar dentro del plazo + 3 días de prórroga. Un préstamo vencido más allá de ese margen bloquea la cédula sin importar la cuenta.
      </p>

      <Button className="mt-4" onClick={runCheck} disabled={running}>
        {running ? "Revisando..." : "Revisar préstamos vencidos ahora"}
      </Button>
      {message && <div className="mt-3"><Alert kind="info">{message}</Alert></div>}

      <h2 className="mt-6 font-display text-lg font-semibold text-[var(--ink)]">Activas</h2>
      {active.length === 0 && <div className="mt-3"><EmptyState title="Sin morosos" body="No hay cédulas bloqueadas actualmente." /></div>}
      <div className="mt-3 space-y-3">
        {active.map((r) => (
          <Card key={r.document_id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[var(--ink)]">{r.full_name ?? "Sin nombre"} · {r.document_id}</p>
                <p className="text-xs text-[var(--muted)]">{formatDate(r.blacklisted_at)}</p>
              </div>
              <Badge className="bg-red-100 text-red-800">Bloqueado</Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--ink)]">{r.reason}</p>
            <Button variant="secondary" className="mt-3" onClick={() => remove(r.document_id)}>
              Quitar de la lista negra
            </Button>
          </Card>
        ))}
      </div>

      {removed.length > 0 && (
        <>
          <h2 className="mt-6 font-display text-lg font-semibold text-[var(--ink)]">Historial (removidos)</h2>
          <div className="mt-3 space-y-3">
            {removed.map((r) => (
              <Card key={r.document_id} className="opacity-60">
                <p className="font-semibold text-[var(--ink)]">{r.full_name ?? "Sin nombre"} · {r.document_id}</p>
                <p className="text-xs text-[var(--muted)]">Removido el {formatDate(r.removed_at)}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
