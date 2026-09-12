// LES PREST — Service worker (estrategia "network-first" para el shell
// de la app, para que cada visita revise primero si hay una versión
// nueva desplegada, en vez de quedarse pegado sirviendo una copia vieja
// para siempre). El número de versión del CACHE_NAME se debe subir cada
// vez que se publique un cambio importante de infraestructura.
const CACHE_NAME = "les-prest-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Nunca cachear llamadas a Supabase: siempre deben ir a la red.
  if (event.request.url.includes("supabase.co")) return;

  // Para navegación (cargar la página) y para cualquier archivo .js/.css,
  // siempre se intenta la red primero. Solo si no hay conexión, se usa
  // la copia guardada como respaldo. Esto evita quedarse pegado en una
  // versión vieja después de un nuevo despliegue.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

