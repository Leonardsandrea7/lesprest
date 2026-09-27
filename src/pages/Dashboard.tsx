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
  Newspaper, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendTelegramMessage } from '../lib/telegram';
import { AppDownloadBanner } from '../components/AppDownloadBanner';

interface AppNews {
  id: string;
  title: string;
  content: string;
  tag: string;
  is_important: boolean;
  created_at: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [bcvRate, setBcvRate] = useState(54.25);
  const [amountUSD, setAmountUSD] = useState(50);
  const [paymentRef, setPaymentRef] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // News and Notifications State
  const [newsList, setNewsList] = useState<AppNews[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const ratePercent = 6.0;
  const interestUSD = amountUSD * (ratePercent / 100);
  const totalUSD = amountUSD + interestUSD;
  const totalVES = totalUSD * bcvRate;

  useEffect(() => {
    loadDashboardData();

    // Setup Supabase real-time notifications for the current user
    if (user?.id) {
      const channel = supabase
        .channel(`user-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newNotif = payload.new as NotificationItem;
            setNotifications((prev) => [newNotif, ...prev]);
            // If browser supports web notification API
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(newNotif.title, { body: newNotif.body });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      // 1. Load BCV Rate
      const { data: bcvData } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'bcv_rate')
        .single();

      if (bcvData?.value) {
        const parsed = parseFloat(bcvData.value);
        if (!isNaN(parsed) && parsed > 0) setBcvRate(parsed);
      }

      // 2. Load App News
      const { data: newsData } = await supabase
        .from('app_news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);

      if (newsData) {
        setNewsList(newsData);
      }

      // 3. Load User Notifications
      if (user?.id) {
        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (notifData) {
          setNotifications(notifData);
        }
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleReportPayment = async () => {
    if (paymentRef.trim().length < 4) {
      setErrorMsg('Ingresa un número de referencia bancaria válido (mínimo 4 dígitos).');
      return;
    }
    setReporting(true);
    setErrorMsg('');

    try {
      let paymentRecordId = '';
      if (user?.id) {
        const { data: inserted, error: insertError } = await supabase
          .from('payments')
          .insert([
            {
              user_id: user.id,
              reference: paymentRef.trim(),
              amount_usd: totalUSD,
              amount_ves: totalVES,
              bcv_rate: bcvRate,
              status: 'pendiente'
            }
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        paymentRecordId = inserted?.id || '';
      }

      // Notify operations via Telegram
      try {
        const { data: settings } = await supabase.from('app_settings').select('*');
        const botToken = settings?.find((s: any) => s.key === 'telegram_bot_token')?.value;
        const opChatId = settings?.find((s: any) => s.key === 'telegram_chat_id_operations')?.value;

        if (botToken && opChatId) {
          const msg = `💸 <b>NUEVO PAGO REPORTADO</b>\n\n` +
            `👤 <b>Cliente:</b> ${profile?.full_name || 'Usuario PrestApp'}\n` +
            `🆔 <b>Cédula:</b> ${profile?.id_card || 'V-N/A'}\n` +
            `📱 <b>Teléfono:</b> ${profile?.phone || 'N/A'}\n` +
            `🔢 <b>Referencia:</b> <code>#${paymentRef.trim()}</code>\n` +
            `💵 <b>Monto en USD:</b> $${totalUSD.toFixed(2)} USD\n` +
            `🇻🇪 <b>Monto en Bs:</b> Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}\n` +
            `📊 <b>Tasa BCV:</b> Bs. ${bcvRate.toFixed(2)}\n` +
            `📅 <b>Fecha:</b> ${new Date().toLocaleString('es-VE')}`;

          await sendTelegramMessage(botToken, opChatId, msg);
        }
      } catch (err) {
        console.warn('Telegram ops notification error:', err);
      }

      setReportSuccess(true);
      setPaymentRef('');
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo registrar la referencia. Verifica tu conexión.');
    } finally {
      setReporting(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* 1. BANNER DESTACADO DE DESCARGA DE LA APP OFICIAL */}
      <AppDownloadBanner />

      {/* Notifications Drawer / Alert Banner if any new notification */}
      {notifications.length > 0 && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-2">
                <span>Centro de Notificaciones Push</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} nuevas
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-400">
                {notifications[0]?.title}: {notifications[0]?.body}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="text-xs text-blue-400 font-bold hover:underline"
          >
            {showNotifications ? 'Ocultar' : 'Ver todas'}
          </button>
        </div>
      )}

      {showNotifications && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Historial de Notificaciones</h4>
          {notifications.map((n) => (
            <div key={n.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-400">{n.title}</span>
                <span className="text-[10px] text-slate-500">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="text-slate-300 mt-1">{n.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* User Status Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-extrabold text-blue-200">Microcréditos Progresivos</span>
              <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-md">
                Nivel {profile?.current_level || 1}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-1">
              {profile?.full_name ? `¡Hola, ${profile.full_name}!` : `Bienvenido`}
            </h1>
            <p className="text-xs text-blue-100 mt-1 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{profile?.id_card ? `Cédula: ${profile.id_card}` : 'Cuenta Registrada en PrestApp'}</span>
            </p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-right">
            <span className="text-[11px] text-blue-200 block font-medium">Tasa Oficial BCV</span>
            <span className="text-base font-black text-emerald-400">Bs. {bcvRate.toFixed(2)} / USD</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/15 relative z-10">
          <div>
            <span className="text-xs text-blue-200 font-medium">Línea de Crédito Activa</span>
            <p className="text-2xl font-black">${amountUSD}.00 <span className="text-xs font-semibold text-blue-200">USD</span></p>
          </div>
          <div>
            <span className="text-xs text-blue-200 font-medium">Equivalente en Bolívares</span>
            <p className="text-2xl font-black text-emerald-300">Bs. {(amountUSD * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-xs text-blue-200 font-medium">Método de Desembolso</span>
            <p className="text-2xl font-black text-white">Pago Móvil Inmediato</p>
          </div>
        </div>
      </div>

      {/* 2. SECCIÓN DE NOTICIAS Y MEJORAS DE LA APP */}
      {newsList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Newspaper className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Noticias & Mejoras de la App</h3>
                <p className="text-xs text-slate-400">Actualizaciones oficiales publicadas por el equipo de PrestApp</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Novedades</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {newsList.map((news) => (
              <div
                key={news.id}
                className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {news.tag || 'Actualización'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(news.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{news.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{news.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulador y Desglose de Préstamo */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Simulador de Montos y Cuotas</h3>
            <p className="text-xs text-slate-400">Calcula tu microcrédito según la tasa oficial vigente</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Término fijo: 10 a 14 días
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-300">Selecciona el monto deseado:</span>
            <span className="text-blue-400 text-sm font-black">${amountUSD} USD</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[20, 35, 50, 70, 90, 120].map((val) => (
              <button
                key={val}
                onClick={() => setAmountUSD(val)}
                className={`py-2.5 rounded-xl font-bold text-xs transition border ${
                  amountUSD === val
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                ${val} USD
              </button>
            ))}
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Monto Solicitado</span>
              <p className="text-lg font-bold text-white">${amountUSD}.00 USD</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Interés Único (6%)</span>
              <p className="text-lg font-bold text-blue-400">+${interestUSD.toFixed(2)} USD</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Total a Pagar en Bs (BCV)</span>
              <p className="text-lg font-black text-emerald-400">Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reportar Pago / Referencia Bancaria */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="pb-4 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white">Reportar Referencia de Pago Móvil</h3>
          <p className="text-xs text-slate-400">
            Ingresa el número de referencia para que el sistema notifique al canal de operaciones y concilie tu cuota
          </p>
        </div>

        {reportSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-bold text-white">¡Referencia recibida y enviada a operaciones!</p>
              <p>El administrador validará la operación en cuenta bancaria y recibirás tu notificación push de pago aprobado.</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

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
            disabled={reporting || paymentRef.trim().length < 4}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-blue-600/20"
          >
            {reporting ? 'Enviando...' : 'Reportar Pago'}
          </button>
        </div>
      </div>

      {/* Coordenadas Oficiales Pago Móvil */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Coordenadas Oficiales para Pagos</h3>
            <p className="text-xs text-slate-400">Realiza tu transferencia únicamente a los datos oficiales de PrestApp</p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            Cuenta Verificada
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
