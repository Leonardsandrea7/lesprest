import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { RequireAuth, RequireAdmin } from "./components/RequireAuth";
import { AppLayout } from "./components/AppLayout";
import { InstallGate } from "./components/InstallGate";

import { Landing } from "./pages/Landing";
import { Download } from "./pages/Download";
import { Register } from "./pages/auth/Register";
import { Login } from "./pages/auth/Login";

import { Dashboard } from "./pages/app/Dashboard";
import { LoanFlow } from "./pages/app/LoanFlow";
import { PaymentsHistory } from "./pages/app/PaymentsHistory";
import { Progress } from "./pages/app/Progress";
import { Profile } from "./pages/app/Profile";

import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminKyc } from "./pages/admin/AdminKyc";
import { AdminLoans } from "./pages/admin/AdminLoans";
import { AdminBlacklist } from "./pages/admin/AdminBlacklist";
import { AdminPayments } from "./pages/admin/AdminPayments";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminLevels } from "./pages/admin/AdminLevels";
import { AdminPaymentMethods } from "./pages/admin/AdminPaymentMethods";
import { AdminWhatsappMessages } from "./pages/admin/AdminWhatsappMessages";
import { AdminSettings } from "./pages/admin/AdminSettings";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/descargar" element={<Download />} />
          <Route path="/registro" element={<InstallGate><Register /></InstallGate>} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/app"
            element={
              <InstallGate>
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              </InstallGate>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="prestamo" element={<LoanFlow />} />
            <Route path="pagos" element={<PaymentsHistory />} />
            <Route path="progreso" element={<Progress />} />
            <Route path="perfil" element={<Profile />} />
          </Route>

          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="kyc" element={<AdminKyc />} />
            <Route path="prestamos" element={<AdminLoans />} />
            <Route path="lista-negra" element={<AdminBlacklist />} />
            <Route path="pagos" element={<AdminPayments />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="niveles" element={<AdminLevels />} />
            <Route path="metodos-pago" element={<AdminPaymentMethods />} />
            <Route path="mensajes" element={<AdminWhatsappMessages />} />
            <Route path="configuracion" element={<AdminSettings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
