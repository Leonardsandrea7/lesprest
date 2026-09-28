import React, { useState } from 'react';
import { User, Save, ShieldCheck, IdCard, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateMyProfile } from '../lib/appData';

export const Perfil: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!profile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await updateMyProfile(profile.id, { full_name: fullName, phone, bank_name: bankName });
      await refreshProfile();
      setMsg('Datos actualizados correctamente.');
    } catch (err: any) {
      setMsg('Error guardando: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-600/30">
            <User className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Mi Perfil</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <p className="flex items-center gap-1.5 text-slate-400"><IdCard className="w-3.5 h-3.5" /> Cédula: <span className="text-white font-bold">{profile.id_card}</span></p>
          <p className="flex items-center gap-1.5 text-slate-400"><Mail className="w-3.5 h-3.5" /> Correo: <span className="text-white font-bold">{profile.email}</span></p>
          <p className="flex items-center gap-1.5 text-slate-400"><ShieldCheck className="w-3.5 h-3.5" /> Estado KYC: <span className="text-white font-bold">{profile.kyc_status}</span></p>
          <p className="text-slate-500 col-span-2">La cédula y el correo no se pueden cambiar aquí; si necesitas corregirlos, contacta a soporte.</p>
        </div>

        {msg && <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300">{msg}</div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Nombre Completo</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Teléfono (Pago Móvil)</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Banco Principal</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="0134 - Banesco Banco Universal">0134 - Banesco Banco Universal</option>
              <option value="0102 - Banco de Venezuela (BDV)">0102 - Banco de Venezuela (BDV)</option>
              <option value="0105 - Banco Mercantil">0105 - Banco Mercantil</option>
              <option value="0108 - Banco Provincial (BBVA)">0108 - Banco Provincial (BBVA)</option>
              <option value="0172 - Bancamiga Banco Universal">0172 - Bancamiga Banco Universal</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
