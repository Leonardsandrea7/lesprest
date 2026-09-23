import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Badge, Button, EmptyState } from "../../components/ui";
import { formatDate, kycStatusLabels, fillTemplate, whatsappLink } from "../../lib/format";
import type { Kyc, WhatsappMessage } from "../../lib/database.types";

const statusColors: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  en_revision: "bg-amber-100 text-amber-800",
  aprobado: "bg-blue-100 text-blue-800",
  rechazado: "bg-red-100 text-red-800",
  requiere_informacion: "bg-sky-100 text-sky-800",
};

export function AdminKyc() {
  const [records, setRecords] = useState<Kyc[]>([]);
  const [messages, setMessages] = useState<Record<string, WhatsappMessage>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, { id?: string; selfie?: string }>>({});

  async function load() {
    const [{ data: kycData }, { data: msgData }] = await Promise.all([
      supabase.from("kyc").select("*").order("created_at", { ascending: false }),
      supabase.from("whatsapp_messages").select("*"),
    ]);
    setRecords((kycData as Kyc[]) ?? []);
    const map: Record<string, WhatsappMessage> = {};
    ((msgData as WhatsappMessage[]) ?? []).forEach((m) => (map[m.key] = m));
    setMessages(map);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleExpand(k: Kyc) {
    const next = expanded === k.id ? null : k.id;
    setExpanded(next);
    if (next && !photoUrls[k.id] && ((k as any).id_photo_path || (k as any).selfie_photo_path)) {
      const idPath = (k as any).id_photo_path as string | null;
      const selfiePath = (k as any).selfie_photo_path as string | null;
      const [idRes, selfieRes] = await Promise.all([
        idPath ? supabase.storage.from("kyc-documents").createSignedUrl(idPath, 600) : Promise.resolve({ data: null }),
        selfiePath ? supabase.storage.from("kyc-documents").createSignedUrl(selfiePath, 600) : Promise.resolve({ data: null }),
      ]);
      setPhotoUrls((s) => ({
        ...s,
        [k.id]: { id: idRes.data?.signedUrl, selfie: selfieRes.data?.signedUrl },
      }));
    }
  }

  async function decide(kyc: Kyc, decision: "aprobar" | "rechazar" | "solicitar_info") {
    const notes = decision !== "aprobar" ? window.prompt("Nota para el usuario (opcional):") ?? undefined : undefined;
    const { error } = await supabase.rpc("admin_review_kyc", { p_kyc_id: kyc.id, p_decision: decision, p_notes: notes });
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  function copyMessage(key: string, kyc: Kyc) {
    const tpl = messages[key];
    if (!tpl) return;
    const text = fillTemplate(tpl.template, { nombre: kyc.full_name });
    navigator.clipboard.writeText(text);
    alert("Mensaje copiado. Pégalo en WhatsApp.");
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Verificaciones KYC</h1>

      {records.length === 0 && <div className="mt-4"><EmptyState title="Sin solicitudes" body="Las nuevas verificaciones aparecerán aquí." /></div>}

      <div className="mt-4 space-y-3">
        {records.map((k) => {
          const isOpen = expanded === k.id;
          return (
            <Card key={k.id}>
              <button className="flex w-full items-center justify-between text-left" onClick={() => toggleExpand(k)}>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{k.full_name}</p>
                  <p className="text-xs text-[var(--muted)]">{k.document_id} · {formatDate(k.created_at)}</p>
                </div>
                <Badge className={statusColors[k.status]}>{kycStatusLabels[k.status]}</Badge>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4 text-sm">
                  <dl className="grid grid-cols-2 gap-3">
                    <Info label="Nacimiento" value={formatDate(k.birth_date)} />
                    <Info label="Estado" value={k.state} />
                    <Info label="Ciudad" value={k.city} />
                    <Info label="WhatsApp" value={k.whatsapp_number} />
                    <Info label="Dirección" value={k.address} />
                    {k.extra_info && <Info label="Info adicional" value={k.extra_info} />}
                  </dl>

                  {(photoUrls[k.id]?.id || photoUrls[k.id]?.selfie) && (
                    <div className="grid grid-cols-2 gap-3">
                      {photoUrls[k.id]?.id && (
                        <div>
                          <p className="mb-1 text-xs text-[var(--muted)]">Foto de cédula</p>
                          <a href={photoUrls[k.id].id} target="_blank" rel="noreferrer">
                            <img src={photoUrls[k.id].id} alt="Cédula" className="w-full rounded-lg border border-[var(--line)] object-cover" />
                          </a>
                        </div>
                      )}
                      {photoUrls[k.id]?.selfie && (
                        <div>
                          <p className="mb-1 text-xs text-[var(--muted)]">Selfie</p>
                          <a href={photoUrls[k.id].selfie} target="_blank" rel="noreferrer">
                            <img src={photoUrls[k.id].selfie} alt="Selfie" className="w-full rounded-lg border border-[var(--line)] object-cover" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <a href={whatsappLink(k.whatsapp_number, "")} target="_blank" rel="noreferrer">
                      <Button variant="secondary">Abrir WhatsApp</Button>
                    </a>
                    <Button variant="ghost" onClick={() => copyMessage("kyc_aprobado", k)}>Copiar: aprobado</Button>
                    <Button variant="ghost" onClick={() => copyMessage("kyc_rechazado", k)}>Copiar: rechazado</Button>
                    <Button variant="ghost" onClick={() => copyMessage("kyc_info_adicional", k)}>Copiar: más info</Button>
                  </div>

                  {["pendiente", "en_revision", "requiere_informacion"].includes(k.status) && (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => decide(k, "aprobar")}>✓ Aprobar</Button>
                      <Button variant="danger" onClick={() => decide(k, "rechazar")}>✕ Rechazar</Button>
                      <Button variant="secondary" onClick={() => decide(k, "solicitar_info")}>⚠ Solicitar información</Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="text-[var(--ink)]">{value}</dd>
    </div>
  );
}
