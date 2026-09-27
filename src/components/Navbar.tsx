import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Download, User, LifeBuoy, UserCircle, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-tight text-white">PrestApp</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">OFICIAL</span>
            </div>
          </div>
        </Link>

        <div className="flex items-center space-x-2">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="hidden sm:flex items-center space-x-1.5 text-xs font-black text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-2 rounded-xl hover:bg-blue-500/20 transition"
              >
                <User className="w-4 h-4" />
                <span>Mi Cuenta</span>
              </Link>
              <Link
                to="/soporte"
                className="hidden sm:flex items-center space-x-1.5 text-xs font-black text-slate-300 bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl hover:bg-slate-700 transition"
              >
                <LifeBuoy className="w-4 h-4" />
                <span>Soporte</span>
              </Link>
              <Link
                to="/perfil"
                className="flex items-center justify-center w-9 h-9 text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition"
                title="Mi Perfil"
              >
                <UserCircle className="w-4 h-4" />
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-9 h-9 text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-rose-600 hover:text-white transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <a
              href="/prestapp.apk"
              download="PrestApp-Oficial.apk"
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md shadow-emerald-500/20"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Descargar APK</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
