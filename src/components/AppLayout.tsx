import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BottomNav } from "./BottomNav";
import { Logo } from "./Logo";

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] pb-24">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <Logo size="sm" />
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-[var(--muted)] hover:text-[var(--brick)]"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-6">
        <Outlet context={{ profile }} />
      </main>
      <BottomNav />
    </div>
  );
}
