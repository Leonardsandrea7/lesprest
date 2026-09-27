import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, CheckCircle, XCircle, DollarSign, Send, ArrowUpRight } from 'lucide-react';

export const Admin: React.FC = () => {
  const { profile } = useAuth();
  const [bcvRate, setBcvRate] = useState(54.25);
  const [rateInput, setRateInput] = useState('54.25');

  const [pendingPayments, setPendingPayments] = useState([
    { id: 'LP-98214', client: 'Carlos E. Mendoza', ref: '49018274', bank: 'Banesco', amountVES: 2875.25, amountUSD: 53.0 },
    { id: 'LP-99102', client: 'Mariana Rodriguez', ref: '78291034', bank: 'Mercantil', amountVES: 1710.84, amountUSD: 31.8 }
  ]);

  const [pendingLoans, setPendingLoans] = useState([
    { id: 'LP-10293', client: 'Alejandro Morales', amountUSD: 40.0, term: 10, bank: '0102 - BDV', phone: '0412-8877665' }
  ]);

  const confirmPayment = (id: string) => {
    setPendingPayments(pendingPayments.filter(p => p.id !== id));
    alert(`Pago de préstamo ${id} conciliado y verificado. Nivel del cliente incrementado.`);
  };

  const approveLoan = (id: string) => {
    setPendingLoans(pendingLoans.filter(l => l.id !== id));
    alert(`Préstamo ${id} aprobado para desembolso inmediato.`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Consola Supabase Admin</span>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">Operaciones</span>
            </div>
            <h1 className="text-2xl font-black text-white">Panel de Control PrestApp</h1>
          </div>
        </div>

        {/* BCV Adjuster */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 pl-2">Tasa BCV:</span>
          <input
            type="number"
            step="0.01"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none"
          />
          <button
            onClick={() => setBcvRate(parseFloat(rateInput) || 54.25)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
          >
            Fijar
          </button>
        </div>
      </div>

      {/* Pending Repayments to Reconcile */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>Pagos Móviles por Conciliar</span>
          <span className="text-xs font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
            {pendingPayments.length} pendientes
          </span>
        </h2>

        {pendingPayments.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No hay transferencias pendientes de conciliación.</p>
        ) : (
          <div className="space-y-3">
            {pendingPayments.map((p) => (
              <div key={p.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{p.client}</span>
                    <span className="text-xs text-slate-400">({p.id})</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Ref: <strong className="text-amber-400 font-mono">#{p.ref}</strong> • Banco: {p.bank}
                  </p>
                  <p className="text-sm font-black text-emerald-400 mt-1">
                    Bs. {p.amountVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (${p.amountUSD.toFixed(2)} USD)
                  </p>
                </div>

                <button
                  onClick={() => confirmPayment(p.id)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Validar Pago y Liberar Nivel</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Loan Requests */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>Solicitudes de Microcrédito</span>
          <span className="text-xs font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
            {pendingLoans.length} nuevas
          </span>
        </h2>

        {pendingLoans.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Todas las solicitudes están atendidas.</p>
        ) : (
          <div className="space-y-3">
            {pendingLoans.map((l) => (
              <div key={l.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{l.client}</span>
                    <span className="text-xs text-slate-400">({l.id})</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Destino: {l.bank} ({l.phone})
                  </p>
                  <p className="text-sm font-black text-white mt-1">
                    ${l.amountUSD.toFixed(2)} USD • Plazo: {l.term} días
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => approveLoan(l.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Aprobar y Desembolsar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
