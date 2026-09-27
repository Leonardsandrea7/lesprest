import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Smartphone, Send, User, LogOut, CheckCircle, ShieldCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-tight text-white">PrestApp</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">VE</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Tu microcrédito seguro</p>
          </div>
        </Link>

        {user ? (
          <nav className="flex items-center space-x-3">
            <Link
              to="/dashboard"
              className="text-sm font-semibold text-slate-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              Dashboard
            </Link>

            <Link
              to="/telegram"
              className="hidden sm:flex items-center space-x-1.5 text-sm font-semibold text-sky-400 hover:text-sky-300 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>@PrestAppBot</span>
            </Link>

            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center space-x-1.5 text-sm font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Panel Admin</span>
              </Link>
            )}

            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <span className="text-xs text-slate-400 hidden md:inline">
                {profile?.full_name?.split(' ')[0]}
              </span>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                title="Cerrar Sesión"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </nav>
        ) : (
          <div className="flex items-center space-x-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg"
            >
              Iniciar Sesión
            </Link>
            <Link
              to="/register"
              className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl shadow-lg shadow-blue-600/30 transition"
            >
              Registrarme (KYC)
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
