import React from 'react';
import { Download, Smartphone, Zap, ShieldCheck, ArrowRight } from 'lucide-react';

interface AppDownloadBannerProps {
  onDownloadClick?: () => void;
}

export const AppDownloadBanner: React.FC<AppDownloadBannerProps> = ({ onDownloadClick }) => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 border-2 border-emerald-500/40 p-6 sm:p-8 shadow-2xl">
      {/* Background glow effects */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="space-y-3 text-center lg:text-left max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>App Oficial Android • Desembolsos al Instante</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Descarga la App Oficial de PrestApp
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Por protocolos de seguridad y validación biométrica en vivo, las <strong>solicitudes y desembolsos directos a tu Pago Móvil</strong> se gestionan únicamente a través de la aplicación oficial.
          </p>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Zap className="w-3.5 h-3.5" />
              Notificaciones push automáticas
            </span>
            <span className="flex items-center gap-1.5 text-blue-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Biometría facial garantizada
            </span>
          </div>
        </div>

        {/* Primary Download Button */}
        <div className="shrink-0 w-full sm:w-auto text-center space-y-2">
          <a
            href="/prestapp.apk"
            download="PrestApp-Oficial.apk"
            onClick={onDownloadClick}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/30 transition duration-200 text-base"
          >
            <Download className="w-5 h-5 stroke-[2.8]" />
            <span>Descargar App Oficial Android</span>
          </a>
          <p className="text-[11px] text-slate-400">
            Archivo APK seguro • Android 8.0 o superior • Actualizado
          </p>
        </div>
      </div>
    </div>
  );
};
