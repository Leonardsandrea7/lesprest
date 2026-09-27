import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  Wallet,
  ShieldQuestion,
  Ban,
  Settings,
  LifeBuoy,
  CheckCircle,
  XCircle,
  Trash2,
  LogOut,
  Send,
  Sliders,
  Landmark,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { notify } from '../lib/notify';

type Tab = 'usuarios' | 'prestamos' | 'kyc' | 'blacklist' | 'soporte' | 'config';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'usuarios', label: 'Usuarios', icon: <Users className="w-4 h-4" /> },
  { id: 'prestamos', label: 'Préstamos y Pagos', icon: <Wallet className="w-4 h-4" /> },
  { id: 'kyc', label: 'KYC', icon: <ShieldQuestion className="w-4 h-4" /> },
  { id: 'blacklist', label: 'Lista Negra', icon: <Ban className="w-4 h-4" /> },
  { id: 'soporte', label: 'Soporte', icon: <LifeBuoy className="w-4 h-4" /> },
  { id: 'config', label: 'Configuración', icon: <Settings className="w-4 h-4" /> }
];

const KYC_BADGE: Record<string, string> = {
  verificado: 'bg-emerald-500/20 text-emerald-400',
  rechazado: 'bg-rose-500/20 text-rose-400',
  en_revision: 'bg-amber-500/20 text-amber-400',
  no_verificado: 'bg-slate-700 text-slate-300'
};

export const Admin: React.FC = () => {
  const { profile, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('usuarios');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [clients, setClients] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [selectedSupportUser, setSelectedSupportUser] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Config: tasa BCV, pago móvil, bots
  const [rateInput, setRateInput] = useState('54.25');
  const [payout, setPayout] = useState({ payout_bank_name: '', payout_phone: '', payout_id_card: '', payout_holder_name: '' });
  const [secrets, setSecrets] = useState({
    telegram_ops_bot_token: '',
    telegram_ops_chat_id: '',
    telegram_kyc_bot_token: '',
    telegram_kyc_chat_id: '',
    telegram_support_bot_token: '',
    telegram_support_chat_id: ''
  });

  // Lista negra: formulario
  const [blockIdCard, setBlockIdCard] = useState('');
  const [blockEmail, setBlockEmail] = useState('');
  const [blockPhone, setBlockPhone] = useState('');
  const [blockReason, setBlockReason] = useState('Impago de crédito / Morosidad');

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        { data: clientsData },
        { data: loansData },
        { data: paymentsData },
        { data: blacklistData },
        { data: levelsData },
        { data: settingsData },
        { data: secretsData },
        { data: supportData }
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('black_list').select('*').order('created_at', { ascending: false }),
        supabase.from('loan_levels').select('*').order('level', { ascending: true }),
        supabase.from('app_settings').select('*'),
        supabase.from('app_secrets').select('*'),
        supabase.from('support_messages').select('*').order('created_at', { ascending: true })
      ]);

      if (clientsData) setClients(clientsData);
      if (loansData) setLoans(loansData);
      if (paymentsData) setPayments(paymentsData);
      if (blacklistData) setBlacklist(blacklistData);
      if (levelsData) setLevels(levelsData);
      if (supportData) setSupportMessages(supportData);

      if (settingsData) {
        const map: Record<string, string> = {};
        settingsData.forEach((s: any) => (map[s.key] = s.value));
        if (map.bcv_rate) setRateInput(map.bcv_rate);
        setPayout({
          payout_bank_name: map.payout_bank_name || '',
          payout_phone: map.payout_phone || '',
          payout_id_card: map.payout_id_card || '',
          payout_holder_name: map.payout_holder_name || ''
        });
      }

      if (secretsData) {
        const smap: any = {};
        secretsData.forEach((s: any) => (smap[s.key] = s.value));
        setSecrets((prev) => ({ ...prev, ...smap }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ---------------------------------------------------------------------
  // USUARIOS
  // ---------------------------------------------------------------------
  const saveClient = async (id: string, fields: any) => {
    try {
      await supabase.from('profiles').update(fields).eq('id', id);
      setMsg('Usuario actualizado.');
      loadData();
    } catch (err: any) {
      setMsg('Error actualizando usuario: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------
  // PRÉSTAMOS Y PAGOS
  // ---------------------------------------------------------------------
  const confirmPayment = async (id: string, userId: string, amountUsd: number, ref: string, paidOnTime: boolean) => {
    try {
      await supabase.from('payments').update({ status: 'aprobado' }).eq('id', id);

      const { data: userProf } = await supabase
        .from('profiles')
        .select('current_level, consecutive_paid_in_level, full_name')
        .eq('id', userId)
        .single();

      const { data: levelRow } = await supabase
        .from('loan_levels')
        .select('payments_to_advance')
        .eq('level', userProf?.current_level || 1)
        .maybeSingle();

      const currentLvl = userProf?.current_level || 1;
      const needed = levelRow?.payments_to_advance || 2;
      const currentConsecutive = userProf?.consecutive_paid_in_level || 0;

      let nextLvl = currentLvl;
      let nextConsecutive = paidOnTime ? currentConsecutive + 1 : 0;
      let messageText = '';

      if (paidOnTime && nextConsecutive >= needed) {
        nextLvl = Math.min(currentLvl + 1, 6);
        nextConsecutive = 0;
        messageText = nextLvl > currentLvl
          ? `¡Has completado ${needed} pagos a tiempo! Has ascendido al Nivel ${nextLvl}.`
          : `¡Excelente historial! Ya estás en el Nivel máximo (6).`;
      } else if (!paidOnTime) {
        messageText = `Pago recibido fuera de plazo. Tu progreso se reinicia y te tocará pagar nuevamente ${needed} veces en el Nivel ${currentLvl}.`;
      } else {
        messageText = `Pago ${nextConsecutive} de ${needed} registrado a tiempo. Completa ${needed - nextConsecutive} más para subir al Nivel ${Math.min(currentLvl + 1, 6)}.`;
      }

      await supabase.from('loans').update({ status: 'pagado' }).eq('id', payments.find((p) => p.id === id)?.loan_id);
      await supabase.from('profiles').update({ current_level: nextLvl, consecutive_paid_in_level: nextConsecutive }).eq('id', userId);
      await supabase.from('notifications').insert([{ user_id: userId, title: paidOnTime ? '🎉 ¡Pago Aprobado a Tiempo!' : '⚠️ Pago Aprobado Fuera de Tiempo', body: messageText, type: 'pago_aprobado' }]);

      await notify({
        channel: 'ops',
        text: `✅ <b>PAGO APROBADO</b> (${paidOnTime ? 'A TIEMPO' : 'TARDE'})\n\n👤 <b>Cliente:</b> ${userProf?.full_name || userId}\n🔢 <b>Referencia:</b> #${ref}\n💵 <b>Monto:</b> $${amountUsd || 0} USD\n📊 <b>Nivel:</b> ${nextLvl}`
      });

      setMsg(`Pago #${ref} conciliado.`);
      loadData();
    } catch (err: any) {
      setMsg('Error aprobando pago: ' + err.message);
    }
  };

  const approveLoan = async (id: string, userId: string, amountUsd: number) => {
    try {
      await supabase.from('loans').update({ status: 'aprobado' }).eq('id', id);
      await supabase.from('notifications').insert([{ user_id: userId, title: '💸 ¡Desembolso Aprobado!', body: `Tu solicitud de préstamo por $${amountUsd || 0} USD fue aprobada.`, type: 'desembolso' }]);
      await notify({ channel: 'ops', text: `💰 <b>DESEMBOLSO APROBADO</b>\n\n👤 Usuario: ${userId}\n💵 Monto: $${amountUsd || 0} USD` });
      setMsg(`Préstamo #${id} aprobado.`);
      loadData();
    } catch (err: any) {
      setMsg('Error aprobando préstamo: ' + err.message);
    }
  };

  const rejectLoan = async (id: string) => {
    try {
      await supabase.from('loans').update({ status: 'rechazado' }).eq('id', id);
      setMsg('Préstamo rechazado.');
      loadData();
    } catch (err: any) {
      setMsg('Error: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------
  // KYC
  // ---------------------------------------------------------------------
  const handleVerifyKyc = async (clientId: string, clientName: string) => {
    try {
      await supabase.from('profiles').update({ kyc_status: 'verificado' }).eq('id', clientId);
      await supabase.from('notifications').insert([{ user_id: clientId, title: '✅ Identidad Verificada', body: 'Tu cédula y selfie fueron verificadas. Ya puedes solicitar tu microcrédito.', type: 'kyc' }]);
      setMsg(`KYC de ${clientName} verificado.`);
      loadData();
    } catch (err: any) {
      setMsg('Error verificando KYC: ' + err.message);
    }
  };

  const handleRejectKyc = async (clientId: string, clientName: string) => {
    try {
      await supabase.from('profiles').update({ kyc_status: 'rechazado' }).eq('id', clientId);
      await supabase.from('notifications').insert([{ user_id: clientId, title: '❌ Verificación Rechazada', body: 'No pudimos validar tu cédula o selfie. Contacta a soporte.', type: 'kyc' }]);
      setMsg(`KYC de ${clientName} rechazado.`);
      loadData();
    } catch (err: any) {
      setMsg('Error rechazando KYC: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------
  // LISTA NEGRA
  // ---------------------------------------------------------------------
  const handleAddToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockIdCard.trim()) return;
    try {
      const cleanCard = blockIdCard.trim().toUpperCase();
      const cleanEmail = blockEmail.trim().toLowerCase();
      await supabase.from('black_list').insert([{ id_card: cleanCard, email: cleanEmail || null, phone: blockPhone.trim() || null, reason: blockReason.trim() }]);
      await supabase.from('profiles').update({ is_blacklisted: true, kyc_status: 'rechazado' }).eq('id_card', cleanCard);
      setMsg(`Cédula ${cleanCard} agregada a la Lista Negra.`);
      setBlockIdCard('');
      setBlockEmail('');
      setBlockPhone('');
      loadData();
    } catch (err: any) {
      setMsg('Error agregando a lista negra: ' + err.message);
    }
  };

  const handleRemoveFromBlacklist = async (id: string, card: string) => {
    try {
      await supabase.from('black_list').delete().eq('id', id);
      await supabase.from('profiles').update({ is_blacklisted: false }).eq('id_card', card);
      setMsg(`Cédula ${card} removida de la Lista Negra.`);
      loadData();
    } catch (err: any) {
      setMsg('Error desbloqueando: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------
  // CONFIGURACIÓN
  // ---------------------------------------------------------------------
  const handleUpdateRate = async () => {
    const val = parseFloat(rateInput);
    if (!val || isNaN(val)) return;
    await supabase.from('app_settings').upsert([{ key: 'bcv_rate', value: val.toString() }]);
    setMsg(`Tasa BCV actualizada a Bs. ${val.toFixed(2)}.`);
  };

  const handleSavePayout = async () => {
    await supabase.from('app_settings').upsert(Object.entries(payout).map(([key, value]) => ({ key, value })));
    setMsg('Datos de Pago Móvil actualizados.');
  };

  const handleSaveSecrets = async () => {
    await supabase.from('app_secrets').upsert(Object.entries(secrets).map(([key, value]) => ({ key, value })));
    setMsg('Bots de Telegram guardados.');
  };

  const handleLevelChange = (level: number, field: string, value: string) => {
    setLevels((prev) => prev.map((lv) => (lv.level === level ? { ...lv, [field]: value } : lv)));
  };

  const handleSaveLevels = async () => {
    try {
      await supabase.from('loan_levels').upsert(
        levels.map((lv) => ({
          level: lv.level,
          max_amount_usd: parseFloat(lv.max_amount_usd),
          rate_percent: parseFloat(lv.rate_percent),
          installments: parseInt(lv.installments, 10),
          interval_days: parseInt(lv.interval_days, 10),
          payments_to_advance: parseInt(lv.payments_to_advance, 10)
        }))
      );
      setMsg('Niveles 1-6 guardados.');
    } catch (err: any) {
      setMsg('Error guardando niveles: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------
  // SOPORTE
  // ---------------------------------------------------------------------
  const threadUserIds = Array.from(new Set(supportMessages.map((m) => m.user_id)));
  const clientById = (id: string) => clients.find((c) => c.id === id);
  const threadFor = (userId: string) => supportMessages.filter((m) => m.user_id === userId);

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupportUser || !replyText.trim()) return;
    try {
      await supabase.from('support_messages').insert([{ user_id: selectedSupportUser, sender: 'admin', body: replyText.trim() }]);
      const client = clientById(selectedSupportUser);
      await notify({ channel: 'support', text: `↩️ Respuesta enviada desde el panel a ${client?.full_name || selectedSupportUser}:\n${replyText.trim()}` });
      setReplyText('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Header propio del admin, independiente del Navbar del cliente */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Panel Administrador</span>
            <h1 className="text-xl font-black text-white">Consola de Control PrestApp</h1>
            <p className="text-xs text-slate-400">Sesión: {profile.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
              tab === t.id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {msg && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-blue-400" />
          <span>{msg}</span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-10">Cargando datos...</p>
      ) : (
        <>
          {/* ============ USUARIOS ============ */}
          {tab === 'usuarios' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
              <h2 className="text-lg font-bold text-white pb-2 border-b border-slate-800">Usuarios ({clients.length})</h2>
              {clients.map((c) => (
                <ClientEditRow key={c.id} client={c} onSave={(fields) => saveClient(c.id, fields)} />
              ))}
            </div>
          )}

          {/* ============ PRÉSTAMOS Y PAGOS ============ */}
          {tab === 'prestamos' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
                <h2 className="text-lg font-bold text-white pb-2 border-b border-slate-800">Solicitudes de Préstamo ({loans.length})</h2>
                {loans.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Sin solicitudes.</p>}
                {loans.map((l) => (
                  <div key={l.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">${l.amount_usd} USD — Nivel {l.level_borrowed} <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{l.status}</span></p>
                      <p className="text-[11px] text-slate-500">Usuario: {clientById(l.user_id)?.full_name || l.user_id}</p>
                    </div>
                    {l.status === 'pendiente' && (
                      <div className="flex gap-2">
                        <button onClick={() => approveLoan(l.id, l.user_id, l.amount_usd)} className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs">Aprobar</button>
                        <button onClick={() => rejectLoan(l.id)} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs">Rechazar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
                <h2 className="text-lg font-bold text-white pb-2 border-b border-slate-800">Pagos Reportados ({payments.length})</h2>
                {payments.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Sin pagos reportados.</p>}
                {payments.map((p) => (
                  <div key={p.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Ref #{p.reference} — ${p.amount_usd} USD <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{p.status}</span></p>
                      <p className="text-[11px] text-slate-500">Usuario: {clientById(p.user_id)?.full_name || p.user_id}</p>
                    </div>
                    {p.status !== 'aprobado' && (
                      <div className="flex gap-2">
                        <button onClick={() => confirmPayment(p.id, p.user_id, p.amount_usd, p.reference, true)} className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs">Pagó a Tiempo</button>
                        <button onClick={() => confirmPayment(p.id, p.user_id, p.amount_usd, p.reference, false)} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs">Pagó Tarde</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============ KYC ============ */}
          {tab === 'kyc' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
              <h2 className="text-lg font-bold text-white pb-2 border-b border-slate-800">
                Verificación de KYC — {clients.filter((c) => c.kyc_status === 'en_revision').length} pendientes
              </h2>
              {clients.map((c) => (
                <div key={c.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {c.cedula_url ? <a href={c.cedula_url} target="_blank" rel="noreferrer"><img src={c.cedula_url} className="w-12 h-12 object-cover rounded-lg border border-slate-700" /></a> : <div className="w-12 h-12 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-[9px] text-slate-600">Sin foto</div>}
                      {c.selfie_url ? <a href={c.selfie_url} target="_blank" rel="noreferrer"><img src={c.selfie_url} className="w-12 h-12 object-cover rounded-lg border border-slate-700" /></a> : <div className="w-12 h-12 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-[9px] text-slate-600">Sin foto</div>}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{c.full_name}</p>
                      <p className="text-[11px] text-slate-500">{c.id_card} • {c.email}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${KYC_BADGE[c.kyc_status] || KYC_BADGE.no_verificado}`}>{c.kyc_status}</span>
                    </div>
                  </div>
                  {c.kyc_status !== 'verificado' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleVerifyKyc(c.id, c.full_name)} className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /><span>Verificar</span></button>
                      <button onClick={() => handleRejectKyc(c.id, c.full_name)} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /><span>Rechazar</span></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ============ LISTA NEGRA ============ */}
          {tab === 'blacklist' && (
            <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-6 space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-white pb-2 border-b border-slate-800">Lista Negra Oficial ({blacklist.length})</h2>
              <form onSubmit={handleAddToBlacklist} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <input type="text" required placeholder="Cédula V-12345678" value={blockIdCard} onChange={(e) => setBlockIdCard(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
                <input type="email" placeholder="Correo" value={blockEmail} onChange={(e) => setBlockEmail(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
                <input type="text" placeholder="Teléfono" value={blockPhone} onChange={(e) => setBlockPhone(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
                <button type="submit" className="py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs">Bloquear</button>
              </form>
              {blacklist.map((item) => (
                <div key={item.id} className="bg-slate-950 p-3 rounded-xl border border-rose-900/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-rose-400">{item.id_card}</span>
                    {item.email && <span className="text-slate-400 ml-2">({item.email})</span>}
                    <span className="text-slate-500 ml-2 text-[11px]">• {item.reason}</span>
                  </div>
                  <button onClick={() => handleRemoveFromBlacklist(item.id, item.id_card)} className="p-1 text-slate-500 hover:text-white"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* ============ SOPORTE ============ */}
          {tab === 'soporte' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-2 shadow-xl sm:col-span-1">
                <h2 className="text-sm font-bold text-white pb-2 border-b border-slate-800">Conversaciones</h2>
                {threadUserIds.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">Sin mensajes de soporte.</p>}
                {threadUserIds.map((uid) => {
                  const c = clientById(uid);
                  const thread = threadFor(uid);
                  const last = thread[thread.length - 1];
                  return (
                    <button key={uid} onClick={() => setSelectedSupportUser(uid)} className={`w-full text-left p-3 rounded-xl border text-xs ${selectedSupportUser === uid ? 'bg-blue-500/10 border-blue-500/40' : 'bg-slate-950 border-slate-800'}`}>
                      <p className="font-bold text-white">{c?.full_name || uid}</p>
                      <p className="text-slate-500 truncate">{last?.body}</p>
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl sm:col-span-2 flex flex-col gap-3">
                {!selectedSupportUser ? (
                  <p className="text-xs text-slate-500 text-center py-10">Selecciona una conversación. Recuerda que también puedes responder directo desde Telegram.</p>
                ) : (
                  <>
                    <div className="h-80 overflow-y-auto flex flex-col gap-2 bg-slate-950 rounded-2xl border border-slate-800 p-3">
                      {threadFor(selectedSupportUser).map((m) => (
                        <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs ${m.sender === 'admin' ? 'self-end bg-amber-500 text-slate-950' : 'self-start bg-slate-800 text-slate-100'}`}>
                          {m.body}
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAdminReply} className="flex gap-2">
                      <input type="text" placeholder="Responder desde el panel..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                      <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl"><Send className="w-4 h-4" /></button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ============ CONFIGURACIÓN ============ */}
          {tab === 'config' && (
            <div className="space-y-6">
              {/* Tasa BCV */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2"><Sliders className="w-4 h-4 text-emerald-400" /> Tasa BCV</h3>
                <div className="flex gap-2">
                  <input type="number" step="0.01" value={rateInput} onChange={(e) => setRateInput(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white" />
                  <button onClick={handleUpdateRate} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs">Guardar</button>
                </div>
              </div>

              {/* Niveles 1-6 */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl overflow-x-auto">
                <h3 className="text-base font-bold text-white flex items-center gap-2"><Sliders className="w-4 h-4 text-blue-400" /> Niveles de Préstamo (1 al 6)</h3>
                <table className="w-full text-xs min-w-[560px]">
                  <thead>
                    <tr className="text-slate-500 text-left">
                      <th className="pb-2">Nivel</th>
                      <th className="pb-2">Monto USD</th>
                      <th className="pb-2">Interés %</th>
                      <th className="pb-2">Cuotas</th>
                      <th className="pb-2">Días</th>
                      <th className="pb-2">Pagos p/subir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map((lv) => (
                      <tr key={lv.level} className="border-t border-slate-800">
                        <td className="py-2 font-black text-white">{lv.level}</td>
                        <td><input type="number" value={lv.max_amount_usd} onChange={(e) => handleLevelChange(lv.level, 'max_amount_usd', e.target.value)} className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white" /></td>
                        <td><input type="number" step="0.5" value={lv.rate_percent} onChange={(e) => handleLevelChange(lv.level, 'rate_percent', e.target.value)} className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white" /></td>
                        <td><input type="number" value={lv.installments} onChange={(e) => handleLevelChange(lv.level, 'installments', e.target.value)} className="w-14 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white" /></td>
                        <td><input type="number" value={lv.interval_days} onChange={(e) => handleLevelChange(lv.level, 'interval_days', e.target.value)} className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white" /></td>
                        <td><input type="number" value={lv.payments_to_advance} onChange={(e) => handleLevelChange(lv.level, 'payments_to_advance', e.target.value)} className="w-14 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={handleSaveLevels} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold">Guardar Niveles</button>
              </div>

              {/* Pago Móvil */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-400" /> Datos de Pago Móvil (a dónde te pagan)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Banco" value={payout.payout_bank_name} onChange={(e) => setPayout({ ...payout, payout_bank_name: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                  <input placeholder="Teléfono" value={payout.payout_phone} onChange={(e) => setPayout({ ...payout, payout_phone: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                  <input placeholder="Cédula/RIF" value={payout.payout_id_card} onChange={(e) => setPayout({ ...payout, payout_id_card: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                  <input placeholder="Titular" value={payout.payout_holder_name} onChange={(e) => setPayout({ ...payout, payout_holder_name: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                </div>
                <button onClick={handleSavePayout} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs">Guardar</button>
              </div>

              {/* Bots de Telegram */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2"><Bot className="w-4 h-4 text-blue-400" /> Bots de Telegram (3 canales independientes)</h3>

                <div className="space-y-2 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs font-bold text-emerald-400">1. Bot de Operaciones (préstamos y pagos)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input placeholder="Bot Token" value={secrets.telegram_ops_bot_token} onChange={(e) => setSecrets({ ...secrets, telegram_ops_bot_token: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                    <input placeholder="Chat ID" value={secrets.telegram_ops_chat_id} onChange={(e) => setSecrets({ ...secrets, telegram_ops_chat_id: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                  </div>
                </div>

                <div className="space-y-2 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-400">2. Bot de Registro / KYC</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input placeholder="Bot Token" value={secrets.telegram_kyc_bot_token} onChange={(e) => setSecrets({ ...secrets, telegram_kyc_bot_token: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                    <input placeholder="Chat ID" value={secrets.telegram_kyc_chat_id} onChange={(e) => setSecrets({ ...secrets, telegram_kyc_chat_id: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                  </div>
                </div>

                <div className="space-y-2 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs font-bold text-blue-400">3. Bot de Soporte (bidireccional con la app)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input placeholder="Bot Token" value={secrets.telegram_support_bot_token} onChange={(e) => setSecrets({ ...secrets, telegram_support_bot_token: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                    <input placeholder="Chat ID" value={secrets.telegram_support_chat_id} onChange={(e) => setSecrets({ ...secrets, telegram_support_chat_id: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                  </div>
                  <p className="text-[10px] text-slate-500">Para que tus respuestas en Telegram lleguen a la app, este bot necesita su Webhook configurado (ver LEEME_ACTUALIZACION.md).</p>
                </div>

                <button onClick={handleSaveSecrets} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold">Guardar Bots</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Fila editable de usuario (nivel, KYC, rol, bloqueo, datos de contacto)
// ---------------------------------------------------------------------------
const ClientEditRow: React.FC<{ client: any; onSave: (fields: any) => void }> = ({ client, onSave }) => {
  const [full_name, setFullName] = useState(client.full_name);
  const [phone, setPhone] = useState(client.phone);
  const [bank_name, setBankName] = useState(client.bank_name || '');
  const [current_level, setCurrentLevel] = useState(client.current_level || 1);
  const [kyc_status, setKycStatus] = useState(client.kyc_status);
  const [role, setRole] = useState(client.role);
  const [is_blacklisted, setBlacklisted] = useState(!!client.is_blacklisted);

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">{client.full_name} <span className="text-slate-500 font-normal text-xs">({client.id_card})</span></p>
        {is_blacklisted && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">Bloqueado</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <input value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre" className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white" />
        <input value={bank_name} onChange={(e) => setBankName(e.target.value)} placeholder="Banco" className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white" />
        <select value={current_level} onChange={(e) => setCurrentLevel(Number(e.target.value))} className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white">
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Nivel {n}</option>)}
        </select>
        <select value={kyc_status} onChange={(e) => setKycStatus(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white">
          <option value="no_verificado">no_verificado</option>
          <option value="en_revision">en_revision</option>
          <option value="verificado">verificado</option>
          <option value="rechazado">rechazado</option>
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white">
          <option value="cliente">cliente</option>
          <option value="admin">admin</option>
        </select>
        <label className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white">
          <input type="checkbox" checked={is_blacklisted} onChange={(e) => setBlacklisted(e.target.checked)} />
          <span>Bloqueado</span>
        </label>
        <button
          onClick={() => onSave({ full_name, phone, bank_name, current_level, kyc_status, role, is_blacklisted })}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg"
        >
          Guardar
        </button>
      </div>
    </div>
  );
};
