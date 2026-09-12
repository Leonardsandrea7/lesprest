import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Badge, Button, Input, EmptyState } from "../../components/ui";
import type { Kyc, Profile } from "../../lib/database.types";

interface UserRow extends Profile {
  kyc?: Kyc[];
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");

  async function load() {
    const { data } = await supabase.from("profiles").select("*, kyc(*)").order("created_at", { ascending: false });
    setUsers((data as UserRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBlock(user: UserRow) {
    await supabase.from("profiles").update({ is_blocked: !user.is_blocked }).eq("id", user.id);
    load();
  }

  const filtered = users.filter((u) => {
    const kycName = u.kyc?.[0]?.full_name ?? "";
    return (u.full_name ?? kycName).toLowerCase().includes(search.toLowerCase()) || u.id.includes(search);
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Usuarios</h1>
      <Input className="mt-4" placeholder="Buscar por nombre o ID..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 && <div className="mt-4"><EmptyState title="Sin resultados" body="No se encontraron usuarios." /></div>}

      <div className="mt-4 space-y-3">
        {filtered.map((u) => {
          const kycRecord = u.kyc?.[0];
          return (
            <Card key={u.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--ink)]">{kycRecord?.full_name ?? u.full_name ?? "Sin nombre (KYC pendiente)"}</p>
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
