import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { InstallBanner } from './components/InstallBanner';
import { Dashboard } from './pages/Dashboard';
import { ClientPanel } from './pages/ClientPanel';
import { Perfil } from './pages/Perfil';
import { Soporte } from './pages/Soporte';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Admin } from './pages/Admin';

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
    <div className="text-center space-y-2">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-xs">Cargando cuenta PrestApp...</p>
    </div>
  </div>
);

// Requiere sesión iniciada. Si es admin, lo saca de las páginas de cliente:
// el admin no tiene por qué ver el Dashboard/Perfil/Soporte del cliente.
const ClientRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

// Solo accesible para role = admin. Cualquier otro usuario se va a su dashboard.
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// La landing pública ("/"): si un admin ya logueado la visita, lo mandamos
// directo a su consola en vez de mostrarle el marketing/APK del cliente.
const PublicLanding: React.FC = () => {
  const { isAdmin, loading } = useAuth();
  if (!loading && isAdmin) return <Navigate to="/admin" replace />;
  return <Dashboard />;
};

const Shell: React.FC = () => {
  const { isAdmin } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* El admin tiene su propio header dentro de <Admin/>; no mezclamos el Navbar del cliente. */}
      {!isAdmin && <Navbar />}
      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<PublicLanding />} />
          <Route path="/dashboard" element={<ClientRoute><ClientPanel /></ClientRoute>} />
          <Route path="/perfil" element={<ClientRoute><Perfil /></ClientRoute>} />
          <Route path="/soporte" element={<ClientRoute><Soporte /></ClientRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAdmin && (
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
          PrestApp Venezuela — Microcréditos progresivos en Bolívares y Dólares. Operaciones y solicitudes exclusivas desde la App Oficial Android.
        </footer>
      )}
      {!isAdmin && <InstallBanner />}
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
