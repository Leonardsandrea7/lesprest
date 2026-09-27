import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Camera, Upload, CheckCircle, Smartphone, Send, ArrowRight } from 'lucide-react';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '0414-',
    id_card: 'V-',
    bank_name: '0134 - Banesco Banco Universal',
    telegram_username: '@',
    password: ''
  });

  const [cedulaAttached, setCedulaAttached] = useState(false);
  const [selfieAttached, setSelfieAttached] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await register(formData);
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Shield className="w-6 h-6 text-slate-950 font-black" />
          </div>
          <h1 className="text-2xl font-black text-white">Registro & KYC PrestApp</h1>
          <p className="text-xs text-slate-400">Verifica tu identidad con cédula y selfie biométrica para habilitar tu crédito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                placeholder="Carlos Mendoza"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                placeholder="carlos@correo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Cédula (V- / E-)</label>
              <input
                type="text"
                required
                placeholder="V-27819340"
                value={formData.id_card}
                onChange={(e) => setFormData({ ...formData, id_card: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Teléfono Móvil (Pago Móvil)</label>
              <input
                type="text"
                required
                placeholder="0414-9876543"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Banco Principal</label>
            <select
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="0134 - Banesco Banco Universal">0134 - Banesco Banco Universal</option>
              <option value="0102 - Banco de Venezuela (BDV)">0102 - Banco de Venezuela (BDV)</option>
              <option value="0105 - Banco Mercantil">0105 - Banco Mercantil</option>
              <option value="0108 - Banco Provincial (BBVA)">0108 - Banco Provincial (BBVA)</option>
              <option value="0172 - Bancamiga Banco Universal">0172 - Bancamiga Banco Universal</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Usuario de Telegram (@)</label>
            <input
              type="text"
              placeholder="@mi_usuario_telegram"
              value={formData.telegram_username}
              onChange={(e) => setFormData({ ...formData, telegram_username: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">Conectará tu cuenta al bot oficial @PrestAppBot</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Contraseña</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* KYC PHOTO & SELFIE BIOMETRICS */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">Verificación Biométrica Requerida</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setCedulaAttached(!cedulaAttached)}
                className={`p-4 rounded-2xl border cursor-pointer transition flex items-center space-x-3 ${
                  cedulaAttached ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Upload className="w-5 h-5 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white">{cedulaAttached ? '✓ Cédula Cargada' : 'Subir Foto Cédula'}</p>
                  <p className="text-[10px] text-slate-400">Frontal legible</p>
                </div>
              </div>

              <div
                onClick={() => setSelfieAttached(!selfieAttached)}
                className={`p-4 rounded-2xl border cursor-pointer transition flex items-center space-x-3 ${
                  selfieAttached ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Camera className="w-5 h-5 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white">{selfieAttached ? '✓ Selfie Biométrica OK' : 'Capturar Selfie Facial'}</p>
                  <p className="text-[10px] text-slate-400">Prueba de vida</p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 mt-4"
          >
            {loading ? 'Creando tu cuenta...' : 'Completar Registro y Activar PrestApp'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-400 font-bold hover:underline">
            Inicia Sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
