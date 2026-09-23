import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../../components/Logo";

const groups: { title: string; links: { to: string; label: string; end?: boolean }[] }[] = [
  {
    title: "Principal",
    links: [{ to: "/admin", label: "Resumen", end: true }],
  },
  {
    title: "Solicitudes",
    links: [
      { to: "/admin/kyc", label: "KYC" },
      { to: "/admin/prestamos", label: "Préstamos" },
      { to: "/admin/pagos", label: "Pagos" },
    ],
  },
  {
    title: "Usuarios",
    links: [
      { to: "/admin/usuarios", label: "Usuarios" },
      { to: "/admin/lista-negra", label: "Lista negra" },
    ],
  },
  {
    title: "Configuración",
    links: [
      { to: "/admin/niveles", label: "Niveles" },
      { to: "/admin/metodos-pago", label: "Métodos de pago" },
      { to: "/admin/mensajes", label: "Mensajes WhatsApp" },
      { to: "/admin/configuracion", label: "General" },
    ],
  },
];

const allLinks = groups.flatMap((g) => g.links);

export function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-[var(--paper)]">
      <aside className="hidden w-60 shrink-0 border-r border-[var(--line)] bg-[var(--paper-raised)] p-5 md:block">
        <Logo size="sm" />
        <p className="mt-1 text-xs text-[var(--muted)]">Panel administrativo</p>
        <nav className="mt-6 space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{group.title}</p>
              <div className="space-y-1">
                {group.links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.end}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 text-sm font-medium ${
                        isActive ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "text-[var(--ink)] hover:bg-black/5"
                      }`
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <button onClick={handleSignOut} className="mt-8 text-sm font-medium text-[var(--muted)] hover:text-[var(--brick)]">
          Cerrar sesión
        </button>
      </aside>

      {/* Nav móvil simple */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper-raised)] px-4 py-3 md:hidden">
        <Logo size="sm" />
        <button onClick={handleSignOut} className="text-sm font-medium text-[var(--muted)]">Salir</button>
      </div>

      <main className="flex-1 overflow-x-hidden px-5 py-6 pt-16 md:pt-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 overflow-x-auto md:hidden">
            <div className="flex gap-2">
              {allLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
                      isActive ? "border-[var(--brand)] text-[var(--brand)]" : "border-[var(--line)] text-[var(--muted)]"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
