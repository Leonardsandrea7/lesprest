import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  CheckCircle, 
  RefreshCw, 
  Send, 
  Bell, 
  Newspaper, 
  DollarSign, 
  Settings,
  Sparkles,
  Users,
  Sliders,
  Calendar,
  Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendTelegramMessage } from '../lib/telegram';

export const Admin: React.FC = () => {
  const { profile } = useAuth();
  const [bcvRate, setBcvRate] = useState(54.25);
  const [rateInput, setRateInput] = useState('54.25');

  // Configuración Nivel 1 (Cuánto se presta, porcentaje, cuotas, cada cuánto)
  const [l1MaxAmount, setL1MaxAmount] = useState('50');
  const [l1RatePercent, setL1RatePercent] = useState('6');
  const [l1Installments, setL1Installments] = useState('1');
  const [l1IntervalDays, setL1IntervalDays] = useState('10');

  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [newsList, setNewsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Telegram Config
  const [botToken, setBotToken] = useState('');
  const [chatIdKyc, setChatIdKyc] = useState('');
  const [chatIdOps, setChatIdOps] = useState('');

  // News Publish
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsTag, setNewsTag] = useState('Mejora');
  const [publishingNews, setPublishingNews] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsData) setPendingPayments(paymentsData);

      // 2. Loans
      const { data: loansData } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (loansData) setPendingLoans(loansData);

      // 3. News
      const { data: newsData } = await supabase
        .from('app_news')
        .select('*')
        .order('created_at', { ascending: false });

      if (newsData) setNewsList(newsData);

      // 4. Settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*');

      if (settingsData) {
        settingsData.forEach((s: any) => {
          if (s.key === 'bcv_rate') {
            setBcvRate(parseFloat(s.value));
            setRateInput(s.value);
          }
          if (s.key === 'level1_max_amount') setL1MaxAmount(s.value);
          if (s.key === 'level1_rate_percent') setL1RatePercent(s.value);
          if (s.key === 'level1_installments') setL1Installments(s.value);
          if (s.key === 'level1_interval_days') setL1IntervalDays(s.value);

          if (s.key === 'telegram_bot_token') setBotToken(s.value);
          if (s.key === 'telegram_chat_id_kyc') setChatIdKyc(s.value);
          if (s.key === 'telegram_chat_id_operations') setChatIdOps(s.value);
        });
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

  const saveSettings = async () => {
    try {
      await supabase.from('app_settings').upsert([
        { key: 'telegram_bot_token', value: botToken },
        { key: 'telegram_chat_id_kyc', value: chatIdKyc },
        { key: 'telegram_chat_id_operations', value: chatIdOps }
      ]);
      setMsg('Configuración de canales de Telegram guardada correctamente.');
    } catch {
      setMsg('Error guardando configuración.');
    }
  };

  const handleSaveLoanRules = async () => {
    try {
      await supabase.from('app_settings').upsert([
        { key: 'level1_max_amount', value: l1MaxAmount },
        { key: 'level1_rate_percent', value: l1RatePercent },
        { key: 'level1_installments', value: l1Installments },
        { key: 'level1_interval_days', value: l1IntervalDays }
      ]);
      setMsg(`¡Condiciones de crédito guardadas! Los nuevos usuarios prestarán hasta $${l1MaxAmount} USD al ${l1RatePercent}% en ${l1Installments} cuota(s) cada ${l1IntervalDays} días.`);
    } catch (err: any) {
      setMsg('Error guardando condiciones: ' + err.message);
    }
  };

  const handleUpdateRate = async () => {
    const val = parseFloat(rateInput);
    if (!val || isNaN(val)) return;
    try {
      await supabase
        .from('app_settings')
        .upsert([{ key: 'bcv_rate', value: val.toString() }]);
      setBcvRate(val);
      setMsg(`Tasa BCV actualizada a Bs. ${val.toFixed(2)}.`);
    } catch {
      setBcvRate(val);
      setMsg(`Tasa actualizada a Bs. ${val.toFixed(2)}.`);
    }
  };

  const confirmPayment = async (id: string, userId?: string, amountUsd?: number, ref?: string) => {
    try {
      await supabase
        .from('payments')
        .update({ status: 'aprobado' })
        .eq('id', id);

      if (userId) {
        const { data: userProf } = await supabase
          .from('profiles')
          .select('current_level, full_name, phone')
          .eq('id', userId)
          .single();

        const newLevel = (userProf?.current_level || 1) + 1;
        await supabase
          .from('profiles')
          .update({ current_level: newLevel })
          .eq('id', userId);

        await supabase.from('notifications').insert([
          {
            user_id: userId,
            title: '🎉 ¡Pago Aprobado y Conciliado!',
            body: `Tu pago de $${amountUsd || 0} USD (Ref: #${ref || ''}) fue aprobado exitosamente. ¡Has ascendido al Nivel ${newLevel}!`,
            type: 'pago_aprobado'
          }
        ]);

        if (botToken && chatIdOps) {
          const text = `✅ <b>PAGO APROBADO Y CONCILIADO</b>\n\n` +
            `👤 <b>Cliente:</b> ${userProf?.full_name || userId}\n` +
            `🔢 <b>Referencia:</b> #${ref}\n` +
            `💵 <b>Monto:</b> $${amountUsd || 0} USD\n` +
            `📈 <b>Nuevo Nivel:</b> Nivel ${newLevel}\n` +
            `🔔 <i>Notificación enviada al usuario.</i>`;
          await sendTelegramMessage(botToken, chatIdOps, text);
        }
      }

      setMsg(`Pago #${id} aprobado, nivel aumentado y notificación enviada.`);
      loadData();
    } catch (err: any) {
      setMsg('Error aprobando pago: ' + err.message);
    }
  };

  const approveLoan = async (id: string, userId?: string, amountUsd?: number) => {
    try {
      await supabase
        .from('loans')
        .update({ status: 'aprobado' })
        .eq('id', id);

      if (userId) {
        await supabase.from('notifications').insert([
          {
            user_id: userId,
            title: '💸 ¡Desembolso de Préstamo Aprobado!',
            body: `Tu solicitud de microcrédito por $${amountUsd || 0} USD fue aprobada y transferida a tu Pago Móvil.`,
            type: 'desembolso'
          }
        ]);

        if (botToken && chatIdOps) {
          const text = `💰 <b>DESEMBOLSO DE PRÉSTAMO APROBADO</b>\n\n` +
            `👤 <b>Usuario ID:</b> ${userId}\n` +
            `💵 <b>Monto:</b> $${amountUsd || 0} USD\n` +
            `📲 <b>Estado:</b> Transferido a Pago Móvil`;
          await sendTelegramMessage(botToken, chatIdOps, text);
        }
      }

      setMsg(`Préstamo #${id} aprobado.`);
      loadData();
    } catch (err: any) {
      setMsg('Error aprobando préstamo: ' + err.message);
    }
  };

  const handlePublishNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsContent.trim()) return;

    setPublishingNews(true);
    try {
      const { data: insertedNews, error } = await supabase
        .from('app_news')
        .insert([
          {
            title: newsTitle.trim(),
            content: newsContent.trim(),
            tag: newsTag,
            is_important: true
          }
        ])
        .select()
        .single();

      if (error) throw error;

      const { data: users } = await supabase.from('profiles').select('id');
      if (users && users.length > 0) {
        const notifPayloads = users.map((u: any) => ({
          user_id: u.id,
          title: `📢 ${newsTitle.trim()}`,
          body: newsContent.trim().substring(0, 120) + (newsContent.length > 120 ? '...' : ''),
          type: 'noticia'
        }));
        await supabase.from('notifications').insert(notifPayloads);
      }

      setMsg('Noticia publicada y notificación enviada a todos los usuarios.');
      setNewsTitle('');
      setNewsContent('');
      loadData();
    } catch (err: any) {
      setMsg('Error publicando noticia: ' + err.message);
    } finally {
      setPublishingNews(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Panel Administrador</span>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">Supabase Real</span>
            </div>
            <h1 className="text-2xl font-black text-white">Consola de Operaciones & Parámetros</h1>
            <p className="text-xs text-slate-400">Sesión: {profile?.email || 'Administrador'}</p>
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
            onClick={handleUpdateRate}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
          >
            Fijar
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-blue-400" />
          <span>{msg}</span>
        </div>
      )}

      {/* 1. MÓDULO CRÍTICO: CONFIGURACIÓN DE PRÉSTAMOS (CUÁNTO SE PRESTA, %, CUOTAS Y CADA CUÁNTO) */}
      <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Condiciones del Préstamo Primer Nivel</h3>
              <p className="text-xs text-slate-400">Define cuánto dinero presta la web, el porcentaje de interés, cuántas cuotas y cada cuántos días</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Nivel 1 Activo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block uppercase">1. Monto a Prestar ($ USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">$</span>
              <input
                type="number"
                value={l1MaxAmount}
                onChange={(e) => setL1MaxAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-500">Monto disponible para usuarios nivel 1</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block uppercase">2. Porcentaje Interés (%)</label>
            <div className="relative">
              <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">%</span>
              <input
                type="number"
                step="0.5"
                value={l1RatePercent}
                onChange={(e) => setL1RatePercent(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-500">Tasa de interés aplicada al préstamo</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block uppercase">3. Número de Cuotas</label>
            <input
              type="number"
              min="1"
              max="12"
              value={l1Installments}
              onChange={(e) => setL1Installments(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-500">En cuántos pagos cancelará el cliente</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block uppercase">4. Cada Cuánto (Días)</label>
            <input
              type="number"
              min="1"
              max="90"
              value={l1IntervalDays}
              onChange={(e) => setL1IntervalDays(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-500">Frecuencia de pago (ej: 7 o 10 días)</p>
          </div>
        </div>

        <button
          onClick={handleSaveLoanRules}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
        >
          Guardar Condiciones de Préstamo para Usuarios
        </button>
      </div>

      {/* 2. SOLICITUDES DE PRÉSTAMO REALES (PENDIENTES POR DESEMBOLSAR) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Solicitudes de Préstamo Recibidas</span>
            <span className="text-xs font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
              {pendingLoans.length} solicitudes
            </span>
          </h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {pendingLoans.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No hay solicitudes de crédito pendientes en Supabase.</p>
        ) : (
          <div className="space-y-3">
            {pendingLoans.map((l) => (
              <div key={l.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">${l.amount_usd || 0} USD</span>
                    <span className="text-xs text-emerald-400 font-semibold">
                      (Bs. {Number(l.amount_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.status === 'aprobado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {l.status || 'pendiente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Plazo: {l.term_days || 10} días • Fecha: {new Date(l.created_at || Date.now()).toLocaleDateString()}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    ID Usuario: {l.user_id}
                  </p>
                </div>

                {l.status !== 'aprobado' && (
                  <button
                    onClick={() => approveLoan(l.id, l.user_id, l.amount_usd)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
                  >
                    <span>Aprobar y Desembolsar</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. PAGOS MÓVILES REGISTRADOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
          <span>Pagos Móviles Reportados</span>
          <span className="text-xs font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
            {pendingPayments.length} registros
          </span>
        </h2>

        {pendingPayments.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No hay pagos reportados en la tabla de Supabase.</p>
        ) : (
          <div className="space-y-3">
            {pendingPayments.map((p) => (
              <div key={p.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Ref: #{p.reference}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'aprobado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {p.status || 'pendiente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Monto: <strong className="text-emerald-400">Bs. {Number(p.amount_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong> (${p.amount_usd || 0} USD)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Usuario: {p.user_id} • Fecha: {new Date(p.created_at || Date.now()).toLocaleString()}
                  </p>
                </div>

                {p.status !== 'aprobado' && (
                  <button
                    onClick={() => confirmPayment(p.id, p.user_id, p.amount_usd, p.reference)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Aprobar Pago</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. CANALES TELEGRAM */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">Canales de Telegram</h3>
          </div>
          <span className="text-[11px] text-slate-400">KYC y Notificaciones Operativas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Bot Token de Telegram</label>
            <input
              type="text"
              placeholder="7123456789:AAH..."
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Chat ID KYC (Fotos y Registros)</label>
            <input
              type="text"
              placeholder="-100..."
              value={chatIdKyc}
              onChange={(e) => setChatIdKyc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Chat ID Operaciones (Pagos y Préstamos)</label>
            <input
              type="text"
              placeholder="-100..."
              value={chatIdOps}
              onChange={(e) => setChatIdOps(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <button
          onClick={saveSettings}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
        >
          Guardar Configuración de Telegram
        </button>
      </div>

      {/* 5. PUBLICAR NOTICIA */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white pb-3 border-b border-slate-800">Publicar Noticia</h3>
        <form onSubmit={handlePublishNews} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Título</label>
              <input
                type="text"
                required
                placeholder="Título del anuncio"
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Etiqueta</label>
              <select
                value={newsTag}
                onChange={(e) => setNewsTag(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Mejora">Mejora</option>
                <option value="Actualización">Actualización</option>
                <option value="Importante">Importante</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Contenido</label>
            <textarea
              required
              rows={2}
              placeholder="Mensaje de la noticia..."
              value={newsContent}
              onChange={(e) => setNewsContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={publishingNews}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition flex items-center space-x-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{publishingNews ? 'Publicando...' : 'Publicar Noticia'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
