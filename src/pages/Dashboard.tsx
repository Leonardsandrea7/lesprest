import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Smartphone, Send, CheckCircle, ArrowRight, DollarSign, Calendar, Copy, Clock, Zap, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [bcvRate] = useState(54.25);
  const [amountUSD, setAmountUSD] = useState(50);
  const [termDays, setTermDays] = useState(12);
  const [paymentRef, setPaymentRef] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [loanStatus, setLoanStatus] = useState<'activo' | 'reportado' | 'ninguno'>('activo');

  const ratePercent = 6.0;
  const interestUSD = amountUSD * (ratePercent / 100);
  const totalUSD = amountUSD + interestUSD;
  const totalVES = totalUSD * bcvRate;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Mobile-Only Security Notice Banner */}
      <div className="bg-gradient-to-r from-blue-950/80 to-slate-900 border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-blue-900/10">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              PrestApp Móvil Exclusiva
              <span className="text-[10px] uppercase font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Recomendado</span>
            </h4>
            <p className="text-xs text-slate-300">
              Para mayor seguridad con verificación biométrica en vivo y notificaciones 24/7, utiliza la App Android oficial.
            </p>
          </div>
        </div>
        <Link
          to="/telegram"
          className="self-start sm:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ver Bot @PrestAppBot</span>
        </Link>
      </div>

      {/* Hero Financial Summary */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-extrabold text-blue-200">Microcréditos Progresivos</span>
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-md">Nivel {profile?.current_level || 2}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-1">¡Hola, {profile?.full_name?.split(' ')[0] || 'Carlos'}!</h1>
            <p className="text-xs text-blue-100 mt-1 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Identidad KYC Verificada (Cédula + Selfie)
            </p>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-right">
            <span className="text-[11px] text-blue-200 block font-medium">Tasa Oficial BCV</span>
            <span className="text-sm font-black text-emerald-400">Bs. {bcvRate.toFixed(2)} / USD</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/15 relative z-10">
          <div>
            <span className="text-xs text-blue-200 font-medium">Límite Aprobado</span>
            <p className="text-2xl font-black">$80.00 <span className="text-xs font-semibold text-blue-200">USD</span></p>
          </div>
          <div>
            <span className="text-xs text-blue-200 font-medium">Equivalente en Bolívares</span>
            <p className="text-2xl font-black text-emerald-300">Bs. {(80 * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-xs text-blue-200 font-medium">Desembolso</span>
            <p className="text-2xl font-black text-white">Pago Móvil Inmediato</p>
          </div>
        </div>
      </div>

      {/* Active Loan or Repayment Card */}
      {loanStatus === 'activo' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-700/60">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-400">Préstamo Activo #LP-98214</span>
              <h2 className="text-xl font-bold text-white">Cuota Pendiente de Liquidación</h2>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Vence el 04 Oct 2026 (12 días)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-xs text-slate-400">Monto total a transferir por Pago Móvil:</span>
              <div className="text-3xl font-black text-emerald-400">
                Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Equivalente a ${totalUSD.toFixed(2)} USD ($50.00 capital + $3.00 interés fijo al 6%).
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">Reportar Referencia Bancaria de Pago:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: 49018274 (6 a 8 dígitos)"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 flex-1"
                />
                <button
                  onClick={() => {
                    if (paymentRef.length >= 4) {
                      setLoanStatus('reportado');
                    }
                  }}
                  disabled={paymentRef.length < 4}
                  className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm transition"
                >
                  Reportar
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Una vez ingresada, el bot de Telegram alertará al analista para confirmar la recepción en la cuenta bancaria.
              </p>
            </div>
          </div>
        </div>
      )}

      {loanStatus === 'reportado' && (
        <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-3xl p-6 text-emerald-200 flex items-center space-x-4">
          <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-base font-bold text-white">¡Pago Móvil Reportado para Conciliación!</h3>
            <p className="text-xs text-emerald-300 mt-0.5">
              Referencia #{paymentRef}. El analista está verificando la transacción en la cuenta bancaria oficial. Tu nivel aumentará al ser aprobado.
            </p>
          </div>
        </div>
      )}

      {/* Official Payment Coordinates (Pago Móvil LES PREST / PrestApp) */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Coordenadas Oficiales de Pago Móvil</h3>
            <p className="text-xs text-slate-400">Realiza tu transferencia únicamente a los datos oficiales de PrestApp</p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            Cuentas Verificadas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[
            { label: 'Banco', value: '0134 - Banesco' },
            { label: 'Teléfono', value: '0412-7737801' },
            { label: 'RIF / Cédula', value: 'J-501928340' },
            { label: 'Titular', value: 'PRESTAPP C.A.' }
          ].map((item, idx) => (
            <div key={idx} className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60 flex items-center justify-between">
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
