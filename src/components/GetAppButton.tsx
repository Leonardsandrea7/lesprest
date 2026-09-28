import React, { useEffect, useState } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';

type Status = 'checking' | 'can_install_pwa' | 'apk_available' | 'manual_instructions';

/**
 * Un solo botón, en un solo lugar de la app (se reutiliza en el Navbar y en
 * el Dashboard). Nunca ofrece un enlace roto:
 * 1) Si el navegador soporta instalar la PWA (Android/Chrome), ese es el
 *    botón principal — funciona hoy mismo, sin depender de ningún .apk.
 * 2) Si no, revisa si de verdad existe un archivo real en /prestapp.apk
 *    (con una petición HEAD) antes de mostrar el link de descarga.
 * 3) Si ninguna de las dos aplica, muestra instrucciones manuales en vez
 *    de un botón que no hace nada.
 */
export const GetAppButton: React.FC<{ variant?: 'hero' | 'compact' }> = ({ variant = 'hero' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setStatus('can_install_pwa');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Si el navegador no dispara el evento (ya instalada, iOS, o no
    // cumple los requisitos todavía), revisamos si hay un APK real.
    const timer = setTimeout(async () => {
      setStatus((current) => {
        if (current === 'can_install_pwa') return current;
        return current;
      });
      try {
        const res = await fetch('/prestapp.apk', { method: 'HEAD' });
        const contentType = res.headers.get('content-type') || '';
        const isRealApk = res.ok && !contentType.includes('text/html');
        setStatus((current) => (current === 'can_install_pwa' ? current : isRealApk ? 'apk_available' : 'manual_instructions'));
      } catch {
        setStatus((current) => (current === 'can_install_pwa' ? current : 'manual_instructions'));
      }
    }, 800);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const bigClasses =
    'w-full inline-flex items-center justify-center space-x-3 px-8 py-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black rounded-2xl shadow-2xl shadow-emerald-500/40 transition duration-200 text-lg cursor-pointer transform hover:-translate-y-0.5';
  const compactClasses =
    'flex items-center space-x-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md shadow-emerald-500/20';

  const classes = variant === 'hero' ? bigClasses : compactClasses;
  const iconSize = variant === 'hero' ? 'w-6 h-6 stroke-[3]' : 'w-3.5 h-3.5 stroke-[2.5]';

  if (status === 'can_install_pwa') {
    return (
      <div className={variant === 'hero' ? 'space-y-3' : ''}>
        <button onClick={handleInstall} className={classes}>
          <Smartphone className={iconSize} />
          <span>{variant === 'hero' ? 'Instalar PrestApp Ahora' : 'Instalar App'}</span>
        </button>
        {variant === 'hero' && (
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Se instala directo en tu teléfono, sin descargar ningún archivo aparte</span>
          </p>
        )}
      </div>
    );
  }

  if (status === 'apk_available') {
    return (
      <div className={variant === 'hero' ? 'space-y-3' : ''}>
        <a href="/prestapp.apk" download="PrestApp-Oficial.apk" className={classes}>
          <Download className={iconSize} />
          <span>{variant === 'hero' ? 'Descargar App Oficial Android (APK)' : 'Descargar APK'}</span>
        </a>
      </div>
    );
  }

  if (status === 'manual_instructions' && variant === 'hero') {
    return (
      <div className="bg-slate-950 border border-blue-500/30 rounded-2xl p-4 text-xs text-slate-300 space-y-1.5 text-left max-w-md mx-auto">
        <p className="font-bold text-blue-300 flex items-center gap-1.5">
          <Smartphone className="w-4 h-4" /> Instala PrestApp en tu Android
        </p>
        <p>Abre este sitio con <strong className="text-white">Google Chrome</strong>, toca el menú <strong className="text-white">⋮</strong> (arriba a la derecha) y elige <strong className="text-white">"Instalar app"</strong> o "Agregar a pantalla de inicio".</p>
      </div>
    );
  }

  // Mientras se revisa (status === 'checking') o en variante compacta sin
  // nada disponible todavía: no mostramos nada en vez de un botón roto.
  return null;
};
