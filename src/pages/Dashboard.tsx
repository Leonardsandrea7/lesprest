import React from 'react';
import { 
  ShieldCheck, 
  Zap, 
  Clock, 
  CreditCard,
  Lock,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GetAppButton } from '../components/GetAppButton';

export const Dashboard: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-10 animate-fade-in">
      
      {/* 1. HERO PRINCIPAL DIRECTO: QUIÉNES SOMOS + BOTÓN DE DESCARGAR LA APK */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 border-2 border-emerald-500/50 p-6 sm:p-10 shadow-2xl text-center space-y-6">
        
        {/* Glow de fondo */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>App Oficial Android • Desembolso Inmediato</span>
        </div>

        <div className="space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            PrestApp Venezuela
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
            Somos la plataforma líder en microcréditos inmediatos para personas en Venezuela. 
            Te prestamos desde <strong>$50 USD</strong> en tu primer nivel con desembolso directo a tu <strong>Pago Móvil</strong> en minutos.
          </p>
        </div>

        {/* BOTÓN ÚNICO PARA OBTENER LA APP */}
        <div className="pt-2 max-w-md mx-auto">
          <GetAppButton variant="hero" />
        </div>
      </div>

      {/* 2. QUIÉNES SOMOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-blue-400" />
          <span>¿Quiénes Somos?</span>
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          En <strong>PrestApp C.A.</strong> somos una entidad fintech enfocada en inclusión financiera rápida y transparente en Venezuela. 
          Eliminamos el papeleo bancario tradicional y los requisitos engorrosos, permitiendo que cualquier persona con cédula de identidad y teléfono móvil acceda a préstamos a corto plazo con total seguridad y aprobación en minutos.
        </p>
      </div>

      {/* 3. QUÉ OFRECEMOS */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2.5 px-1">
          <Sparkles className="w-6 h-6 text-amber-400" />
          <span>¿Qué Ofrecemos?</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Crédito Inmediato Nivel 1</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Solicita desde tu teléfono y recibe hasta <strong>$50 USD</strong> en bolívares calculados a la tasa oficial del BCV al instante.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Desembolso por Pago Móvil</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              El dinero llega directamente a tu cuenta bancaria (Banesco, BDV, Mercantil, Provincial, Bancamiga o cualquier banco nacional).
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Validación 100% Segura</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verificación biométrica en vivo en la app oficial para resguardar tu identidad y otorgar aprobación automática.
            </p>
          </div>
        </div>
      </div>

      {/* 4. CÓMO FUNCIONA (PASO A PASO) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-400" />
          <span>Pasos Rápidos para tu Dinero</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Paso 1</span>
            <h4 className="text-sm font-bold text-white">Instala PrestApp</h4>
            <p className="text-xs text-slate-400">Usa el botón de arriba para instalarla en tu teléfono Android.</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <span className="text-xs font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Paso 2</span>
            <h4 className="text-sm font-bold text-white">Regístrate con tu Cédula</h4>
            <p className="text-xs text-slate-400">Crea tu cuenta con tu número de teléfono, banco y tu validación de cédula.</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <span className="text-xs font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">Paso 3</span>
            <h4 className="text-sm font-bold text-white">Recibe tu Dinero</h4>
            <p className="text-xs text-slate-400">Confirma la solicitud y el desembolso cae de inmediato a tu Pago Móvil.</p>
          </div>
        </div>
      </div>

    </div>
  );
};
