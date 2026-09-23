import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Badge, Button, Input, EmptyState } from "../../components/ui";
import type { Kyc, Profile } from "../../lib/database.types";

export function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [kycByUser, setKycByUser] = useState<Record<string, Kyc>>({});
  const [search, setSearch] = useState("");

  async function load() {
    const [{ data: profilesData }, { data: kycData }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("kyc").select("*").order("created_at", { ascending: false }),
    ]);

    setUsers((profilesData as Profile[]) ?? []);

    // Para cada usuario, nos quedamos con su KYC más reciente (la lista ya
    // viene ordenada de más nuevo a más viejo, así que el primero que
    // encontremos por usuario es el correcto).
    const map: Record<string, Kyc> = {};
    ((kycData as Kyc[]) ?? []).forEach((k) => {
      if (!map[k.user_id]) map[k.user_id] = k;
    });
    setKycByUser(map);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBlock(user: Profile) {
    await supabase.from("profiles").update({ is_blocked: !user.is_blocked }).eq("id", user.id);
    load();
  }

  const searchLower = search.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (!searchLower) return true;
    const name = (kycByUser[u.id]?.full_name ?? u.full_name ?? "").toLowerCase();
    const doc = kycByUser[u.id]?.document_id?.toLowerCase() ?? "";
    return name.includes(searchLower) || doc.includes(searchLower) || u.id.toLowerCase().includes(searchLower);
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Usuarios</h1>
      <Input
        className="mt-4"
        placeholder="Buscar por nombre, cédula o ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 && <div className="mt-4"><EmptyState title="Sin resultados" body="No se encontraron usuarios." /></div>}

      <div className="mt-4 space-y-3">
        {filtered.map((u) => {
          const kycRecord = kycByUser[u.id];
          return (
            <Card key={u.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--ink)]">{kycRecord?.full_name ?? u.full_name ?? "Sin nombre (KYC pendiente)"}</p>
                  {kycRecord?.document_id && <p className="text-xs text-[var(--muted)]">Cédula: {kycRecord.document_id}</p>}
                  <p className="text-xs text-[var(--muted)]">{u.id}</p>
                </div>
                {u.is_blocked && <Badge className="bg-red-100 text-red-800">Bloqueado</Badge>}
              </div>
              <Button
                variant={u.is_blocked ? "primary" : "danger"}
                className="mt-3"
                onClick={() => toggleBlock(u)}
              >
                {u.is_blocked ? "Desbloquear" : "Bloquear"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
