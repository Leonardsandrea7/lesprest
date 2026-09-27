import React, { useState } from 'react';
import { Send, CheckCircle, Bell, ArrowRight, Shield, ExternalLink } from 'lucide-react';

export const TelegramBot: React.FC = () => {
  const [testSent, setTestSent] = useState(false);

  const handleTestAlert = () => {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-gradient-to-br from-sky-600 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-white text-sky-600 flex items-center justify-center shadow-lg">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs uppercase font-extrabold text-sky-200 tracking-wider">Bot Oficial</span>
            <h1 className="text-2xl sm:text-3xl font-black">@PrestAppBot en Telegram</h1>
          </div>
        </div>

        <p className="text-sm text-sky-100 max-w-xl">
          El bot de PrestApp te notifica directamente a tu Telegram cada vez que pides un crédito, se aprueba tu Pago Móvil o se acredita tu dinero en cuenta.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://t.me/PrestAppBot"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-white text-sky-700 font-bold rounded-xl text-sm flex items-center space-x-2 hover:bg-sky-50 transition shadow-lg"
          >
            <span>Abrir @PrestAppBot en Telegram</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={handleTestAlert}
            className="px-4 py-2.5 bg-sky-500/30 border border-sky-300/30 text-white font-semibold rounded-xl text-sm hover:bg-sky-500/40 transition"
          >
            {testSent ? '✓ Alerta Simulada Enviada' : 'Probar Notificación de Alerta'}
          </button>
        </div>
      </div>

      {testSent && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>¡Notificación de prueba enviada exitosamente a tu canal de Telegram @PrestAppBot!</span>
        </div>
      )}

      {/* Feature List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-white">¿Qué notificaciones envía el bot?</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {[
            { title: 'Aviso de Desembolso', desc: 'Confirmación inmediata de transferencia Pago Móvil a tu banco.' },
            { title: 'Conciliación de Pago', desc: 'Validación de la referencia bancaria y subida de nivel.' },
            { title: 'Recordatorio Puntual', desc: 'Alerta 48h antes del vencimiento para proteger tu récord.' },
            { title: 'Alertas Administrativas', desc: 'Envío de recibos digitales al canal de analistas.' }
          ].map((item, idx) => (
            <div key={idx} className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-sky-400" />
                {item.title}
              </h4>
              <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
