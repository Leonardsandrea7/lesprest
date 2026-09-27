import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Ban,
  Zap,
  CheckCircle2,
  Send,
  Bell,
  Wallet,
  History,
  Landmark
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  LoanLevel,
  calcLoanForLevel,
  getBcvRate,
  getLoanLevels,
  getMyLoans,
  getMyNotifications,
  getMyPayments,
  getPayoutInfo,
  hasActiveLoan,
  markNotificationRead,
  reportPayment,
  requestLoan,
  PayoutInfo
} from '../lib/appData';

const statusStyles: Record<string, string> = {
  pendiente: 'bg-amber-500/20 text-amber-400',
  aprobado: 'bg-emerald-500/20 text-emerald-400',
  desembolsado: 'bg-blue-500/20 text-blue-400',
  pagado: 'bg-emerald-500/20 text-emerald-400',
  rechazado: 'bg-rose-500/20 text-rose-400',
  moroso: 'bg-rose-500/20 text-rose-400',
  vencido: 'bg-rose-500/20 text-rose-400'
};

export const ClientPanel: React.FC = () => {
  const { profile, logout } = useAuth();
  const [profileStuck, setProfileStuck] = useState(false);
  const [levels, setLevels] = useState<LoanLevel[]>([]);
  const [bcvRate, setBcvRate] = useState(0);
  const [payout, setPayout] = useState<PayoutInfo | null>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [reference, setReference] = useState('');

  const loadAll = async () => {
    if (!profile) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [lv, rate, pay, l, p, n] = await Promise.all([
        getLoanLevels(),
        getBcvRate(),
        getPayoutInfo(),
        getMyLoans(profile.id),
        getMyPayments(profile.id),
        getMyNotifications(profile.id)
      ]);
      setLevels(lv);
      setBcvRate(rate);
      setPayout(pay);
      setLoans(l);
      setPayments(p);
      setNotifications(n);
    } catch (err: any) {
      console.error(err);
      setLoadError(err?.message || 'No se pudo cargar tu información. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (profile) return;
    const timer = setTimeout(() => setProfileStuck(true), 6000);
    return () => clearTimeout(timer);
  }, [profile]);

  if (!profile && profileStuck) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-sm text-rose-400">
          No pudimos encontrar tu perfil. Esto puede pasar si tu cuenta quedó incompleta durante el registro.
        </p>
        <button onClick={() => logout()} className="px-4 py-2 bg-slate-800 hover:bg-rose-600 text-white font-bold rounded-xl text-xs">
          Cerrar sesión e intentar de nuevo
        </button>
      </div>
    );
  }

  if (!profile || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-400 text-sm">
        Cargando tu información...
      </div>
    );
  }

  if (loadError || levels.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-sm text-rose-400">{loadError || 'No pudimos cargar los datos de tu cuenta.'}</p>
        <button
          onClick={loadAll}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const currentLevel = levels.find((lv) => lv.level === (profile.current_level || 1)) || levels[0];
  const activeLoan = loans.find((l) => ['pendiente', 'aprobado', 'desembolsado'].includes(l.status));
  const preview = calcLoanForLevel(currentLevel, bcvRate);
  const canRequest = profile.kyc_status === 'verificado' && !hasActiveLoan(loans) && !profile.is_blacklisted;
  const isBlacklisted = profile.is_blacklisted;

  const handleRequestLoan = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await requestLoan(profile.id, currentLevel, bcvRate);
      setMsg({ type: 'ok', text: 'Solicitud enviada. Un administrador revisará y aprobará tu desembolso.' });
      await loadAll();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'No se pudo crear la solicitud.' });
    } finally {
      setBusy(false);
    }
  };

  const handleReportPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan || !reference.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await reportPayment(profile.id, activeLoan.id, reference, activeLoan.total_due_usd, activeLoan.bcv_rate);
      setMsg({ type: 'ok', text: 'Pago reportado. Será conciliado por un administrador en breve.' });
      setReference('');
      await loadAll();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'No se pudo reportar el pago.' });
    } finally {
      setBusy(false);
    }
  };

  const handleReadNotification = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Encabezado de estado */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">Hola,</p>
            <h1 className="text-2xl font-black text-white">{profile.full_name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Nivel {profile.current_level || 1} de 6
            </span>
            {profile.kyc_status === 'verificado' && (
              <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Verificado
              </span>
            )}
            {profile.kyc_status === 'en_revision' && (
              <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> KYC en revisión
              </span>
            )}
            {profile.kyc_status === 'rechazado' && (
              <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> KYC rechazado
              </span>
            )}
          </div>
        </div>

        {isBlacklisted && (
          <div className="p-4 bg-rose-500/10 border-2 border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-start gap-3">
            <Ban className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <p>Tu cuenta está bloqueada por impago. No puedes solicitar nuevos créditos. Contacta a soporte si crees que es un error.</p>
          </div>
        )}
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            msg.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{msg.text}</span>
        </div>
      )}

      {/* Préstamo activo / Solicitar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <span>{activeLoan ? 'Tu Préstamo Activo' : 'Solicitar Microcrédito'}</span>
        </h2>

        {activeLoan ? (
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">${activeLoan.amount_usd} USD</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyles[activeLoan.status] || 'bg-slate-700 text-slate-300'}`}>
                  {activeLoan.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Total a pagar: <strong className="text-emerald-400">${activeLoan.total_due_usd} USD</strong> (Bs. {Number(activeLoan.total_due_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })})
              </p>
              {activeLoan.due_date && (
                <p className="text-[11px] text-slate-500">Vence: {new Date(activeLoan.due_date).toLocaleDateString('es-VE')}</p>
              )}
            </div>

            {activeLoan.status === 'aprobado' || activeLoan.status === 'desembolsado' ? (
              <div className="space-y-3">
                {payout && (
                  <div className="bg-slate-950 border border-blue-500/30 rounded-2xl p-4 space-y-1.5">
                    <p className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4" /> Datos para tu Pago Móvil
                    </p>
                    <p className="text-xs text-slate-300">Banco: <strong className="text-white">{payout.bank_name}</strong></p>
                    <p className="text-xs text-slate-300">Teléfono: <strong className="text-white">{payout.phone}</strong></p>
                    <p className="text-xs text-slate-300">Cédula/RIF: <strong className="text-white">{payout.id_card}</strong></p>
                    <p className="text-xs text-slate-300">Titular: <strong className="text-white">{payout.holder_name}</strong></p>
                  </div>
                )}

                <form onSubmit={handleReportPayment} className="space-y-3 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-300">Ya pagué, quiero reportarlo</p>
                  <input
                    type="text"
                    required
                    placeholder="Número de referencia del Pago Móvil"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
                  >
                    <Send className="w-4 h-4" />
                    <span>{busy ? 'Enviando...' : 'Reportar Pago'}</span>
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Tu solicitud está pendiente de aprobación por un administrador.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {isBlacklisted ? null : profile.kyc_status !== 'verificado' ? (
              <p className="text-xs text-slate-400">
                Tu identidad todavía está en revisión. En cuanto un administrador verifique tu cédula y selfie podrás solicitar tu microcrédito de Nivel {profile.current_level || 1}.
              </p>
            ) : (
              <>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Monto disponible (Nivel {currentLevel.level})</p>
                    <p className="text-white font-black text-base">${preview.amountUsd} USD</p>
                  </div>
                  <div>
                    <p className="text-slate-500">En Bolívares</p>
                    <p className="text-white font-black text-base">Bs. {preview.amountVes.toLocaleString('es-VE')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total a devolver</p>
                    <p className="text-emerald-400 font-bold">${preview.totalDueUsd} USD</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Plazo / Cuotas</p>
                    <p className="text-emerald-400 font-bold">{preview.termDays} días • {preview.installments} cuota(s)</p>
                  </div>
                </div>
                <button
                  onClick={handleRequestLoan}
                  disabled={busy || !canRequest}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm transition"
                >
                  <Zap className="w-4 h-4" />
                  <span>{busy ? 'Enviando solicitud...' : 'Solicitar Préstamo'}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Notificaciones */}
      {notifications.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <span>Notificaciones</span>
          </h2>
          <div className="space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleReadNotification(n.id)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                  n.is_read ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-blue-500/10 border-blue-500/30 text-white'
                }`}
              >
                <p className="font-bold">{n.title}</p>
                <p className="mt-0.5 text-slate-400">{n.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-blue-400" />
          <span>Historial</span>
        </h2>

        {loans.length === 0 && payments.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Todavía no tienes préstamos ni pagos registrados.</p>
        ) : (
          <div className="space-y-2">
            {loans.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                <span className="text-slate-300">Préstamo Nivel {l.level_borrowed} — ${l.amount_usd} USD</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${statusStyles[l.status] || 'bg-slate-700 text-slate-300'}`}>{l.status}</span>
              </div>
            ))}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Pago #{p.reference} — ${p.amount_usd} USD
                </span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${statusStyles[p.status] || 'bg-slate-700 text-slate-300'}`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
