import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight, Smartphone, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    const { error } = await login(email, password);
    setLoading(false);
    if (error) {
      setErrorMsg('Credenciales inválidas o error de conexión.');
    } else {
      if (email.toLowerCase().includes('admin')) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  };

  const handleDemo = (type: 'cliente' | 'admin') => {
    if (type === 'admin') {
      login('admin@prestapp.com', 'admin123').then(() => navigate('/admin'));
    } else {
      login('carlos.mendoza@email.com', 'pass123').then(() => navigate('/dashboard'));
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Iniciar Sesión en PrestApp</h1>
          <p className="text-xs text-slate-400">Accede a tu microcrédito y récord de pagos</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Correo Electrónico</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30"
          >
            <span>{loading ? 'Accediendo...' : 'Entrar a PrestApp'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 space-y-3">
          <p className="text-[11px] text-slate-400 text-center font-medium">Accesos rápidos de demostración:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDemo('cliente')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl transition"
            >
              Demo Cliente
            </button>
            <button
              onClick={() => handleDemo('admin')}
              className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-400 border border-amber-500/30 rounded-xl transition"
            >
              Demo Admin (Supabase)
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-blue-400 font-bold hover:underline">
            Regístrate con KYC
          </Link>
        </p>
      </div>
    </div>
  );
};
