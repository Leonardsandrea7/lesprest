import { NavLink } from "react-router-dom";

const items = [
  { to: "/app", label: "Inicio", icon: HomeIcon, end: true },
  { to: "/app/prestamo", label: "Préstamo", icon: CoinIcon },
  { to: "/app/pagos", label: "Pagos", icon: ReceiptIcon },
  { to: "/app/progreso", label: "Progreso", icon: LadderIcon },
  { to: "/app/perfil", label: "Perfil", icon: UserIcon },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--paper-raised)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? "text-[var(--brand)]" : "text-[var(--muted)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon active={isActive} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type IconProps = { active: boolean };
const stroke = (active: boolean) => (active ? "var(--brand)" : "var(--muted)");

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5 12 4l8 7.5M6 10v9h12v-9" stroke={stroke(active)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CoinIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke={stroke(active)} strokeWidth="1.8" />
      <path d="M12 8.5v7M9.5 10c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2-5 1.4-5 3.4 0 1 1 1.6 2.5 1.6s2.5-.5 2.5-1.5" stroke={stroke(active)} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function ReceiptIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z" stroke={stroke(active)} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" stroke={stroke(active)} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function LadderIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 21V3M19 21V3M5 6h5M5 11h9M5 16h13" stroke={stroke(active)} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function UserIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.4" stroke={stroke(active)} strokeWidth="1.7" />
      <path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4" stroke={stroke(active)} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
