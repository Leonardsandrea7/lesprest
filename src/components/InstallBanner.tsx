import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm bg-slate-900 border border-blue-500/40 rounded-2xl shadow-2xl shadow-blue-900/40 p-4 flex items-center gap-3 animate-fade-in">
      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-white">Instala PrestApp</p>
        <p className="text-[11px] text-slate-400">Acceso directo desde tu pantalla de inicio, sin navegador.</p>
      </div>
      <button
        onClick={handleInstall}
        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-[11px] shrink-0"
      >
        Instalar
      </button>
      <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
