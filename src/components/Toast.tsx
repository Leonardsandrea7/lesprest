export function Toast({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-start gap-3 rounded-2xl bg-[var(--brand-dark)] p-4 text-white shadow-xl">
        <div className="flex-1">
          <p className="font-display text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-white/80">{body}</p>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          ✕
        </button>
      </div>
    </div>
  );
}
