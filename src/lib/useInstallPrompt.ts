import { useEffect, useState } from "react";

// Guardado a nivel de módulo (no dentro de un componente) para que el
// aviso "se puede instalar", que el navegador dispara una sola vez y muy
// temprano, quede disponible para cualquier pantalla que lo necesite,
// sin importar cuál esté montada en ese momento.
let deferredPrompt: any = null;
let installed = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(mq || iosStandalone || installed);
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function useInstallPrompt() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") installed = true;
    deferredPrompt = null;
    forceUpdate((n) => n + 1);
    return choice.outcome === "accepted";
  }

  return {
    canInstall: !!deferredPrompt,
    isStandalone: isStandaloneMode(),
    isIOS: isIOS(),
    promptInstall,
  };
}
