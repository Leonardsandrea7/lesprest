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
  Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendTelegramMessage } from '../lib/telegram';

export const Admin: React.FC = () => {
  const { profile } = useAuth();
  const [bcvRate, setBcvRate] = useState(54.25);
  const [rateInput, setRateInput] = useState('54.25');
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [newsList, setNewsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Telegram Config State
  const [botToken, setBotToken] = useState('');
  const [chatIdKyc, setChatIdKyc] = useState('');
  const [chatIdOps, setChatIdOps] = useState('');

  // News Publish State
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

  // 1. Confirm Payment & Send Push Notification
  const confirmPayment = async (id: string, userId?: string, amountUsd?: number, ref?: string) => {
    try {
      await supabase
        .from('payments')
        .update({ status: 'aprobado' })
        .eq('id', id);

      if (userId) {
        // Upgrade level
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

        // Insert Push Notification for User
        await supabase.from('notifications').insert([
          {
            user_id: userId,
            title: '🎉 ¡Pago Aprobado y Conciliado!',
            body: `Tu pago de $${amountUsd || 0} USD (Ref: #${ref || ''}) fue aprobado exitosamente. ¡Has ascendido al Nivel ${newLevel}!`,
            type: 'pago_aprobado'
          }
        ]);

        // Send telegram notification to operations channel
        if (botToken && chatIdOps) {
          const text = `✅ <b>PAGO APROBADO Y CONCILIADO</b>\n\n` +
            `👤 <b>Cliente:</b> ${userProf?.full_name || userId}\n` +
            `🔢 <b>Referencia:</b> #${ref}\n` +
            `💵 <b>Monto:</b> $${amountUsd || 0} USD\n` +
            `📈 <b>Nuevo Nivel:</b> Nivel ${newLevel}\n` +
            `🔔 <i>Notificación Push enviada al usuario.</i>`;
          await sendTelegramMessage(botToken, chatIdOps, text);
        }
      }

      setMsg(`Pago #${id} aprobado, nivel aumentado y notificación push enviada.`);
      loadData();
    } catch (err: any) {
      setMsg('Error aprobando pago: ' + err.message);
    }
  };

  // 2. Approve Loan & Send Push Notification
  const approveLoan = async (id: string, userId?: string, amountUsd?: number) => {
    try {
      await supabase
        .from('loans')
        .update({ status: 'aprobado' })
        .eq('id', id);

      if (userId) {
        // Insert Push Notification for User
        await supabase.from('notifications').insert([
          {
            user_id: userId,
            title: '💸 ¡Desembolso de Préstamo Aprobado!',
            body: `Tu solicitud de microcrédito por $${amountUsd || 0} USD fue aprobada y transferida a tu Pago Móvil.`,
            type: 'desembolso'
          }
        ]);

        // Notify Telegram operations channel
        if (botToken && chatIdOps) {
          const text = `💰 <b>DESEMBOLSO DE PRÉSTAMO APROBADO</b>\n\n` +
            `👤 <b>Usuario ID:</b> ${userId}\n` +
            `💵 <b>Monto:</b> $${amountUsd || 0} USD\n` +
            `📲 <b>Estado:</b> Transferido a Pago Móvil\n` +
            `🔔 <i>Notificación push despachada al dispositivo del usuario.</i>`;
          await sendTelegramMessage(botToken, chatIdOps, text);
        }
      }

      setMsg(`Préstamo #${id} aprobado y notificación push de desembolso emitida.`);
      loadData();
    } catch (err: any) {
      setMsg('Error aprobando préstamo: ' + err.message);
    }
  };

  // 3. Publish News & Broadcast Notification to Users
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

      // Broadcast notification to all active profiles
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

      setMsg('Noticia publicada y notificación masiva enviada a todos los usuarios.');
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
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">Supabase Live</span>
            </div>
            <h1 className="text-2xl font-black text-white">Consola de Operaciones & Notificaciones</h1>
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

      {/* SECCIÓN TELEGRAM CONFIGURATION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">Canales de Telegram (KYC y Operaciones)</h3>
          </div>
          <span className="text-[11px] text-slate-400">Notificaciones automáticas en tiempo real</span>
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
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Chat ID Canal KYC (Fotos)</label>
            <input
              type="text"
              placeholder="-100..."
              value={chatIdKyc}
              onChange={(e) => setChatIdKyc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Chat ID Canal Operaciones</label>
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

      {/* SECCIÓN NOTICIAS DE LA APP & BROADCAST DE NOTIFICACIONES */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Newspaper className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Publicar Noticia & Notificación Push Masiva</h3>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">
            Push Automático
          </span>
        </div>

        <form onSubmit={handlePublishNews} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Título de la Actualización</label>
              <input
                type="text"
                required
                placeholder="Ej: Nuevos límites de microcrédito aumentados a $150"
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
                <option value="Mantenimiento">Mantenimiento</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Contenido de la Noticia</label>
            <textarea
              required
              rows={3}
              placeholder="Escribe los detalles que verán los usuarios en la sección de Noticias y que recibirán en su notificación push..."
              value={newsContent}
              onChange={(e) => setNewsContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={publishingNews}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{publishingNews ? 'Transmitiendo...' : 'Publicar y Notificar a Usuarios'}</span>
          </button>
        </form>
      </div>

      {/* PAGOS MÓVILES REGISTRADOS CON NOTIFICACIÓN PUSH DE APROBACIÓN */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Pagos Móviles Registrados</span>
            <span className="text-xs font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
              {pendingPayments.length} registros
            </span>
          </h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Recargar datos de Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

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
                    <span>Aprobar y Enviar Push</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOLICITUDES DE PRÉSTAMO CON DESEMBOLSO Y PUSH */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
          <span>Solicitudes de Préstamo de la App</span>
          <span className="text-xs font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
            {pendingLoans.length} solicitudes
          </span>
        </h2>

        {pendingLoans.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No hay préstamos pendientes de procesar en Supabase.</p>
        ) : (
          <div className="space-y-3">
            {pendingLoans.map((l) => (
              <div key={l.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">${l.amount_usd || 0} USD</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.status === 'aprobado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {l.status || 'pendiente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Usuario: {l.user_id}
                  </p>
                </div>

                {l.status !== 'aprobado' && (
                  <button
                    onClick={() => approveLoan(l.id, l.user_id, l.amount_usd)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
                  >
                    <span>Aprobar Desembolso & Push</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
