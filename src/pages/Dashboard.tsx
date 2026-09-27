import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  CheckCircle, 
  DollarSign, 
  Calendar, 
  Copy, 
  Download, 
  AlertCircle, 
  Bell, 
  Send,
  Layers,
  ArrowRight,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendTelegramMessage } from '../lib/telegram';
import { Link } from 'react-router-dom';

interface LoanRecord {
  id: string;
  amount_usd: number;
  amount_ves: number;
  total_due_usd: number;
  total_due_ves: number;
  status: string;
  term_days: number;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [bcvRate, setBcvRate] = useState(54.25);

  // Parámetros de crédito fijados por el admin para el Nivel 1
  const [l1MaxAmount, setL1MaxAmount] = useState(50);
  const [l1RatePercent, setL1RatePercent] = useState(6.0);
  const [l1Installments, setL1Installments] = useState(1);
  const [l1IntervalDays, setL1IntervalDays] = useState(10);

  const [activeLoans, setActiveLoans] = useState<LoanRecord[]>([]);
  const [paymentRef, setPaymentRef] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const [requestingLoan, setRequestingLoan] = useState(false);
  const [reportingPayment, setReportingPayment] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Cálculos reales de la línea disponible
  const interestAmountUSD = l1MaxAmount * (l1RatePercent / 100);
  const totalDueUSD = l1MaxAmount + interestAmountUSD;
  const totalDueVES = totalDueUSD * bcvRate;
  const installmentAmountUSD = totalDueUSD / l1Installments;
  const installmentAmountVES = totalDueVES / l1Installments;

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // 1. Configuraciones de préstamo de Supabase
      const { data: settings } = await supabase.from('app_settings').select('*');
      if (settings) {
        settings.forEach((s: any) => {
          if (s.key === 'bcv_rate') {
            const v = parseFloat(s.value);
            if (!isNaN(v) && v > 0) setBcvRate(v);
          }
          if (s.key === 'level1_max_amount') {
            const v = parseFloat(s.value);
            if (!isNaN(v) && v > 0) setL1MaxAmount(v);
          }
          if (s.key === 'level1_rate_percent') {
            const v = parseFloat(s.value);
            if (!isNaN(v)) setL1RatePercent(v);
          }
          if (s.key === 'level1_installments') {
            const v = parseInt(s.value, 10);
            if (!isNaN(v) && v > 0) setL1Installments(v);
          }
          if (s.key === 'level1_interval_days') {
            const v = parseInt(s.value, 10);
            if (!isNaN(v) && v > 0) setL1IntervalDays(v);
          }
        });
      }

      // 2. Préstamos activos del usuario
      if (user?.id) {
        const { data: loans } = await supabase
          .from('loans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (loans) setActiveLoans(loans);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Solicitar Préstamo Real Directo en la Web
  const handleRequestLoan = async () => {
    if (!user?.id) return;
    setRequestingLoan(true);
    setErrorMsg('');
    setActionMsg('');

    try {
      const termDays = l1Installments * l1IntervalDays;

      const { data: newLoan, error } = await supabase
        .from('loans')
        .insert([
          {
            user_id: user.id,
            amount_usd: l1MaxAmount,
            amount_ves: l1MaxAmount * bcvRate,
            interest_usd: interestAmountUSD,
            total_due_usd: totalDueUSD,
            total_due_ves: totalDueVES,
            bcv_rate: bcvRate,
            term_days: termDays,
            status: 'pendiente'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Notificar al canal de operaciones de Telegram
      try {
        const { data: settings } = await supabase.from('app_settings').select('*');
        const botToken = settings?.find((s: any) => s.key === 'telegram_bot_token')?.value;
        const opChatId = settings?.find((s: any) => s.key === 'telegram_chat_id_operations')?.value;

        if (botToken && opChatId) {
          const msg = `💰 <b>NUEVA SOLICITUD DE PRÉSTAMO</b>\n\n` +
            `👤 <b>Cliente:</b> ${profile?.full_name || 'Usuario'}\n` +
            `🆔 <b>Cédula:</b> ${profile?.id_card || 'V-N/A'}\n` +
            `📱 <b>Teléfono:</b> ${profile?.phone || 'N/A'}\n` +
            `💵 <b>Monto Solicitado:</b> $${l1MaxAmount.toFixed(2)} USD\n` +
            `🇻🇪 <b>En Bolívares:</b> Bs. ${(l1MaxAmount * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}\n` +
            `🗓 <b>Condiciones:</b> ${l1Installments} cuota(s) cada ${l1IntervalDays} días (${l1RatePercent}% interés)\n` +
            `🏦 <b>Pago Móvil Destino:</b> ${profile?.bank_name || 'Banesco'}\n` +
            `📅 <b>Fecha:</b> ${new Date().toLocaleString('es-VE')}`;

          await sendTelegramMessage(botToken, opChatId, msg);
        }
      } catch (err) {
        console.warn(err);
      }

      setActionMsg(`¡Solicitud por $${l1MaxAmount} USD enviada con éxito! El administrador la revisará para desembolsar a tu cuenta.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error solicitando préstamo.');
    } finally {
      setRequestingLoan(false);
    }
  };

  // Reportar Pago Real
  const handleReportPayment = async () => {
    if (paymentRef.trim().length < 4) {
      setErrorMsg('Ingresa un número de referencia bancaria válido (mínimo 4 dígitos).');
      return;
    }
    setReportingPayment(true);
    setErrorMsg('');
    setActionMsg('');

    try {
      if (user?.id) {
        const { error } = await supabase.from('payments').insert([
          {
            user_id: user.id,
            reference: paymentRef.trim(),
            amount_usd: installmentAmountUSD,
            amount_ves: installmentAmountVES,
            bcv_rate: bcvRate,
            status: 'pendiente'
          }
        ]);
        if (error) throw error;

        // Notificar a operaciones
        const { data: settings } = await supabase.from('app_settings').select('*');
        const botToken = settings?.find((s: any) => s.key === 'telegram_bot_token')?.value;
        const opChatId = settings?.find((s: any) => s.key === 'telegram_chat_id_operations')?.value;

        if (botToken && opChatId) {
          const msg = `💸 <b>PAGO REPORTADO POR USUARIO</b>\n\n` +
            `👤 <b>Cliente:</b> ${profile?.full_name || 'Usuario'}\n` +
            `🆔 <b>Cédula:</b> ${profile?.id_card || 'V-N/A'}\n` +
            `🔢 <b>Referencia:</b> #${paymentRef.trim()}\n` +
            `💵 <b>Monto en USD:</b> $${installmentAmountUSD.toFixed(2)} USD\n` +
            `🇻🇪 <b>Monto en Bs:</b> Bs. ${installmentAmountVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}\n` +
            `📅 <b>Fecha:</b> ${new Date().toLocaleString('es-VE')}`;

          await sendTelegramMessage(botToken, opChatId, msg);
        }
      }

      setActionMsg('¡Referencia enviada con éxito! El administrador validará el pago en la cuenta bancaria.');
      setPaymentRef('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error registrando el pago.');
    } finally {
      setReportingPayment(false);
    }
  };

  const hasPendingLoan = activeLoans.some((l) => l.status === 'pendiente' || l.status === 'aprobado');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Header del Cliente */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-extrabold text-blue-200">Línea de Microcrédito</span>
              <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-md">
                Nivel {profile?.current_level || 1}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-1">
              {profile?.full_name ? `¡Hola, ${profile.full_name}!` : `Mi Cuenta PrestApp`}
            </h1>
            <p className="text-xs text-blue-100 mt-1 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{profile?.id_card ? `Cédula: ${profile.id_card}` : 'Usuario Verificado'}</span>
            </p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-right">
            <span className="text-[11px] text-blue-200 block font-medium">Tasa Oficial BCV</span>
            <span className="text-base font-black text-emerald-400">Bs. {bcvRate.toFixed(2)} / USD</span>
          </div>
        </div>

        {/* Cifras Reales Disponibles para Prestar */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/15 relative z-10">
          <div>
            <span className="text-xs text-blue-200 font-medium">Monto Disponible Nivel 1</span>
            <p className="text-3xl font-black text-white">${l1MaxAmount}.00 <span className="text-xs font-semibold text-blue-200">USD</span></p>
          </div>
          <div>
            <span className="text-xs text-blue-200 font-medium">Equivalente a Desembolsar</span>
            <p className="text-3xl font-black text-emerald-300">Bs. {(l1MaxAmount * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-xs text-blue-200 font-medium">Plan de Pago Configurado</span>
            <p className="text-sm font-bold text-white mt-1">
              {l1Installments} cuota(s) cada {l1IntervalDays} días ({l1RatePercent}% interés)
            </p>
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{actionMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. MÓDULO REAL: PEDIR EL DINERO DISPONIBLE DEL PRIMER NIVEL */}
      <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-white">Solicitar Dinero de Nivel 1</h3>
            <p className="text-xs text-slate-400">Desembolso directo a tu cuenta de Pago Móvil registrada</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Aprobación Rápida
          </span>
        </div>

        {/* Desglose exacto del crédito */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div>
            <span className="text-[11px] text-slate-500 block">Dinero a Recibir</span>
            <p className="text-lg font-black text-white">${l1MaxAmount} USD</p>
            <p className="text-xs text-emerald-400 font-semibold">Bs. {(l1MaxAmount * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Interés ({l1RatePercent}%)</span>
            <p className="text-lg font-black text-blue-400">+${interestAmountUSD.toFixed(2)} USD</p>
            <p className="text-xs text-slate-400">Tasa fija</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Número de Cuotas</span>
            <p className="text-lg font-black text-white">{l1Installments} Cuota(s)</p>
            <p className="text-xs text-slate-400">Cada {l1IntervalDays} días</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Monto por Cuota</span>
            <p className="text-lg font-black text-emerald-400">${installmentAmountUSD.toFixed(2)} USD</p>
            <p className="text-xs text-slate-400">Bs. {installmentAmountVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="text-slate-300">
            <strong>Cuenta Destino:</strong> {profile?.bank_name || 'Banesco Banco Universal'} • Tel: {profile?.phone || 'Registrado'} • Cédula: {profile?.id_card || 'V-Registrada'}
          </p>
          <p className="text-slate-500 text-[11px]">
            Al presionar el botón confirmas la solicitud del microcrédito según las condiciones oficiales de PrestApp.
          </p>
        </div>

        <button
          onClick={handleRequestLoan}
          disabled={requestingLoan || hasPendingLoan}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-base transition shadow-xl shadow-emerald-500/25 flex items-center justify-center space-x-2"
        >
          <DollarSign className="w-5 h-5 stroke-[2.5]" />
          <span>
            {hasPendingLoan
              ? 'Ya tienes una solicitud en proceso'
              : requestingLoan
              ? 'Enviando Solicitud...'
              : `Confirmar y Pedir Préstamo ($${l1MaxAmount} USD)`}
          </span>
        </button>
      </div>

      {/* 2. REPORTAR PAGO / CONCILIACIÓN PAGO MÓVIL */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="pb-4 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white">Reportar Pago de Cuota</h3>
          <p className="text-xs text-slate-400">
            Si ya transferiste tu cuota, ingresa el número de comprobante de Pago Móvil para conciliar en cuenta
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Número de referencia (Ej: 08912345)"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 flex-1"
          />
          <button
            onClick={handleReportPayment}
            disabled={reportingPayment || paymentRef.trim().length < 4}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-blue-600/20"
          >
            {reportingPayment ? 'Enviando...' : 'Reportar Pago'}
          </button>
        </div>
      </div>

      {/* Coordenadas Oficiales para Pagos */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Datos Oficiales para Pagar por Pago Móvil</h3>
            <p className="text-xs text-slate-400">Cuenta de recepción oficial de PrestApp C.A.</p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            Verificada
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[
            { label: 'Banco', value: '0134 - Banesco' },
            { label: 'Teléfono', value: '0412-7737801' },
            { label: 'RIF / Cédula', value: 'J-501928340' },
            { label: 'Titular', value: 'PRESTAPP C.A.' }
          ].map((item, idx) => (
            <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">{item.label}</span>
                <p className="text-xs font-extrabold text-white truncate">{item.value}</p>
              </div>
              <button
                onClick={() => handleCopy(item.value, item.label)}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition"
                title="Copiar"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {copied && (
          <p className="text-xs font-semibold text-emerald-400 text-center animate-fade-in">
            ¡{copied} copiado al portapapeles!
          </p>
        )}
      </div>
    </div>
  );
};
