"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cancion } from "@/types/cancion";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

// ── API Key ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "av_api_key";
const getApiKey = () => (typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) ?? "") : "");
const headers = () => ({ "Content-Type": "application/json", "x-api-key": getApiKey() });

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDur(seg: number | null) {
  if (!seg) return null;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function initiales(artista: string) {
  return artista
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// colores de fondo para el avatar según artista
const COLORS = [
  "from-violet-500 to-purple-600",
  "from-green-500 to-emerald-600",
  "from-orange-400 to-red-500",
  "from-blue-400 to-indigo-600",
  "from-pink-400 to-rose-600",
  "from-yellow-400 to-amber-500",
];
function artistColor(artista: string) {
  let h = 0;
  for (const c of artista) h = (h * 31 + c.charCodeAt(0)) & 0xfffff;
  return COLORS[h % COLORS.length];
}

// ── Pantalla de clave ──────────────────────────────────────────────────────────

function PantallaApiKey({ onSave }: { onSave: (k: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm space-y-4 border border-gray-800">
        <div className="text-center">
          <p className="text-4xl mb-2">🎵</p>
          <h1 className="font-bold text-white text-lg">Reproductor</h1>
          <p className="text-sm text-gray-400 mt-1">Introduce tu API key para continuar</p>
        </div>
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="API key..."
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          onKeyDown={(e) => e.key === "Enter" && val && onSave(val)}
        />
        <button
          onClick={() => val && onSave(val)}
          disabled={!val}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-medium disabled:opacity-40 hover:bg-green-500"
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

// ── Tarjeta de canción ─────────────────────────────────────────────────────────

function CancionCard({
  cancion,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
}: {
  cancion: Cancion;
  isPlaying: boolean;
  onPlay: (c: Cancion) => void;
  onStop: () => void;
  onDelete: (c: Cancion) => void;
}) {
  const color = artistColor(cancion.artista);
  const desde = formatDistanceToNow(parseISO(cancion.solicitada_en), { locale: es, addSuffix: true });

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
        isPlaying
          ? "bg-green-900/40 border border-green-700/50"
          : "bg-gray-900 border border-gray-800 hover:border-gray-700"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow`}
      >
        {isPlaying ? (
          <div className="flex gap-0.5 items-end h-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full animate-bounce"
                style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        ) : (
          <span className="text-white font-bold text-sm">{initiales(cancion.artista)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate text-sm ${isPlaying ? "text-green-300" : "text-white"}`}>
          {cancion.titulo}
        </p>
        <p className="text-gray-400 text-xs truncate">{cancion.artista}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {cancion.descargada ? (
            <span className="text-xs text-green-500 font-medium">✓ Lista</span>
          ) : cancion.accion === null && !cancion.descargada ? (
            <span className="text-xs text-yellow-500 font-medium">⏳ Descargando…</span>
          ) : (
            <span className="text-xs text-gray-500">Pendiente</span>
          )}
          {cancion.duracion_seg && (
            <span className="text-xs text-gray-600">{formatDur(cancion.duracion_seg)}</span>
          )}
          <span className="text-xs text-gray-700">{desde}</span>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {cancion.descargada && (
          isPlaying ? (
            <button
              onClick={onStop}
              className="w-9 h-9 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center"
            >
              <span className="text-white text-sm">⏹</span>
            </button>
          ) : (
            <button
              onClick={() => onPlay(cancion)}
              className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
            >
              <span className="text-white text-sm">▶</span>
            </button>
          )
        )}
        <button
          onClick={() => onDelete(cancion)}
          className="w-9 h-9 rounded-full hover:bg-gray-800 flex items-center justify-center text-gray-600 hover:text-red-400"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Barra Now Playing ──────────────────────────────────────────────────────────

function NowPlaying({ cancion, onStop }: { cancion: Cancion; onStop: () => void }) {
  const color = artistColor(cancion.artista);
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-3 flex items-center gap-3 max-w-lg mx-auto">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{cancion.titulo}</p>
        <p className="text-gray-400 text-xs truncate">{cancion.artista}</p>
      </div>
      <div className="flex gap-2">
        <div className="flex gap-0.5 items-end h-5 mx-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1 bg-green-400 rounded-full animate-bounce"
              style={{ height: `${6 + i * 3}px`, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <button
          onClick={onStop}
          className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white"
        >
          ⏹
        </button>
      </div>
    </div>
  );
}

// ── Formulario de descarga ─────────────────────────────────────────────────────

function FormDescarga({ onCreated }: { onCreated: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!busqueda.trim()) return;
    setLoading(true);
    setMsg("");
    const r = await fetch("/api/musica", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ busqueda: busqueda.trim() }),
    });
    if (r.status === 409) {
      setMsg("Ya está en la biblioteca.");
    } else if (r.ok) {
      setBusqueda("");
      setMsg("Solicitud enviada. El laptop la descargará pronto.");
      onCreated();
    } else {
      setMsg("Error al enviar.");
    }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Artista, canción o álbum…"
          className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={loading || !busqueda.trim()}
          className="bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-xl font-bold text-lg disabled:opacity-40 flex-shrink-0"
        >
          {loading ? "…" : "↓"}
        </button>
      </div>
      {msg && <p className="text-xs text-green-400 px-1">{msg}</p>}
    </form>
  );
}

// ── App principal ──────────────────────────────────────────────────────────────

export default function MusicaPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [jugando, setJugando] = useState<Cancion | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const k = getApiKey();
    setApiKey(k || null);
  }, []);

  const cargar = useCallback(async (key?: string) => {
    const k = key ?? getApiKey();
    if (!k) return;
    try {
      const r = await fetch("/api/musica", { headers: { "x-api-key": k } });
      if (r.status === 401) { setApiKey(null); return; }
      const data: Cancion[] = await r.json();
      setCanciones(data);
      // Si la canción que está "jugando" ya no tiene accion='play', actualizar estado
      setJugando((prev) => {
        if (!prev) return null;
        const actual = data.find((c) => c.id === prev.id);
        return actual?.accion === "play" ? actual : actual?.descargada ? prev : null;
      });
      setError("");
    } catch {
      setError("Sin conexión");
    }
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    cargar(apiKey);
    pollRef.current = setInterval(() => cargar(), 10000); // refresca cada 10s
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [apiKey, cargar]);

  function guardarApiKey(k: string) {
    localStorage.setItem(STORAGE_KEY, k);
    setApiKey(k);
    cargar(k);
  }

  async function play(c: Cancion) {
    // Detener cualquier otra que esté reproduciendo
    for (const otra of canciones.filter((x) => x.accion === "play" && x.id !== c.id)) {
      await fetch(`/api/musica/${otra.id}`, {
        method: "PATCH", headers: headers(), body: JSON.stringify({ accion: null }),
      });
    }
    await fetch(`/api/musica/${c.id}`, {
      method: "PATCH", headers: headers(), body: JSON.stringify({ accion: "play" }),
    });
    setJugando(c);
    cargar();
  }

  async function stop() {
    if (!jugando) return;
    await fetch(`/api/musica/${jugando.id}`, {
      method: "PATCH", headers: headers(), body: JSON.stringify({ accion: "stop" }),
    });
    setJugando(null);
    cargar();
  }

  async function eliminar(c: Cancion) {
    await fetch(`/api/musica/${c.id}`, { method: "DELETE", headers: headers() });
    if (jugando?.id === c.id) setJugando(null);
    cargar();
  }

  if (apiKey === null) return <PantallaApiKey onSave={guardarApiKey} />;

  const listas    = canciones.filter((c) => c.descargada);
  const pendientes = canciones.filter((c) => !c.descargada);

  return (
    <div className="min-h-screen bg-gray-950 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">← Tareas</Link>
            <span className="text-gray-700">|</span>
            <h1 className="text-white font-bold text-lg">🎵 Música</h1>
          </div>
          <span className="text-gray-500 text-sm">{listas.length} canciones</span>
        </div>
        <FormDescarga onCreated={cargar} />
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>

      <div className={`p-4 space-y-6 ${jugando ? "pb-24" : "pb-4"}`}>
        {/* Descargadas */}
        {listas.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Biblioteca
            </h2>
            <div className="space-y-2">
              {listas.map((c) => (
                <CancionCard
                  key={c.id}
                  cancion={c}
                  isPlaying={jugando?.id === c.id}
                  onPlay={play}
                  onStop={stop}
                  onDelete={eliminar}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pendientes */}
        {pendientes.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Cola de descarga
            </h2>
            <div className="space-y-2">
              {pendientes.map((c) => (
                <CancionCard
                  key={c.id}
                  cancion={c}
                  isPlaying={false}
                  onPlay={play}
                  onStop={stop}
                  onDelete={eliminar}
                />
              ))}
            </div>
          </section>
        )}

        {canciones.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <p className="text-5xl mb-3">🎵</p>
            <p className="font-medium text-gray-400">Biblioteca vacía</p>
            <p className="text-sm mt-1">Busca una canción arriba para descargarla</p>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => { localStorage.removeItem(STORAGE_KEY); setApiKey(null); }}
            className="text-xs text-gray-700 hover:text-gray-500 py-2"
          >
            Cambiar clave API
          </button>
        </div>
      </div>

      {/* Now playing bar */}
      {jugando && <NowPlaying cancion={jugando} onStop={stop} />}
    </div>
  );
}
