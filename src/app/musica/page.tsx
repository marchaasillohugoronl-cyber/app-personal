"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cancion } from "@/types/cancion";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { BottomNav } from "@/components/BottomNav";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Resultado {
  id: string;
  titulo: string;
  artista: string;
  duracion: string;
  duracion_seg: number;
  thumbnail: string;
  url: string;
}

interface MiniPlayerInfo {
  videoId: string | null;
  localUrl: string | null;
  titulo: string;
  artista: string;
}

type Tab = "buscar" | "biblioteca" | "descargando";

// ── Auth ───────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "av_api_key";
const getApiKey = () =>
  typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) ?? "") : "";
const apiHeaders = () => ({
  "Content-Type": "application/json",
  "x-api-key": getApiKey(),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDur(seg: number | null) {
  if (!seg) return null;
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

function initials(s: string) {
  return s.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function extraerVideoId(url: string): string | null {
  const m = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/);
  return m?.[1] ?? null;
}

const GRADIENTS = [
  "from-violet-600 to-purple-800", "from-green-500 to-emerald-700",
  "from-orange-500 to-red-700",    "from-blue-500 to-indigo-700",
  "from-pink-500 to-rose-700",     "from-yellow-500 to-amber-700",
  "from-teal-500 to-cyan-700",
];
function gradient(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xfffff;
  return GRADIENTS[h % GRADIENTS.length];
}

// ── Iconos SVG ─────────────────────────────────────────────────────────────────

function YTIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-red-500 flex-shrink-0`}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current ml-0.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M17 1.01 7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
    </svg>
  );
}

function LaptopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
    </svg>
  );
}

function SaveDeviceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-1-6h-3V8h-2v5H8l4 4 4-4z"/>
    </svg>
  );
}

// ── Descarga de MP3 al dispositivo ─────────────────────────────────────────────

interface DescargaEstado {
  url: string;
  progreso: number;   // 0-100, 100 = completo
  error: boolean;
}

async function descargarMp3(
  urlLocal: string,
  titulo: string,
  onProgress: (p: number) => void
): Promise<void> {
  const resp = await fetch(urlLocal);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const total = parseInt(resp.headers.get("content-length") ?? "0");
  const reader = resp.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress(total > 0 ? Math.round((loaded / total) * 100) : 50);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob(chunks as any[], { type: "audio/mpeg" });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = titulo.replace(/[/\\:*?"<>|]/g, "_") + ".mp3";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
  onProgress(100);
}

// ── Equalizer ─────────────────────────────────────────────────────────────────

function Equalizer() {
  return (
    <div className="flex gap-0.5 items-end h-5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-1 bg-white rounded-full animate-bounce"
          style={{ height: `${4 + i * 3}px`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

// ── AlbumArt ──────────────────────────────────────────────────────────────────

function AlbumArt({
  artista,
  isPlaying,
  size = "md",
}: {
  artista: string;
  isPlaying: boolean;
  size?: "sm" | "md";
}) {
  const grad = gradient(artista);
  const sz = size === "sm" ? "w-11 h-11 rounded-xl" : "w-14 h-14 rounded-2xl";
  return (
    <div className={`${sz} bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-lg`}>
      {isPlaying ? <Equalizer /> : (
        <span className={`text-white font-bold ${size === "sm" ? "text-xs" : "text-sm"}`}>
          {initials(artista)}
        </span>
      )}
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────────

function PantallaLogin({ onSave }: { onSave: (k: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-700 mx-auto flex items-center justify-center shadow-2xl shadow-green-900/40">
            <span className="text-4xl">🎙️</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-2xl">Asistente de Voz</h1>
            <p className="text-gray-500 text-sm mt-1">Música y tareas desde cualquier lugar</p>
          </div>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="API key..."
            className="w-full bg-gray-900 border border-gray-700/70 text-white rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-600 text-sm"
            onKeyDown={(e) => e.key === "Enter" && val && onSave(val)}
          />
          <button
            onClick={() => val && onSave(val)}
            disabled={!val}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-semibold disabled:opacity-40 transition-colors"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirmación de eliminación ────────────────────────────────────────────────

function ConfirmarEliminar({
  cancion,
  onConfirm,
  onCancel,
}: {
  cancion: Cancion;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-4">
      <div className="bg-gray-900 border border-gray-700/60 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
        <div>
          <p className="text-white font-semibold text-base">¿Eliminar canción?</p>
          <p className="text-gray-400 text-sm mt-1 truncate">{cancion.titulo}</p>
          <p className="text-gray-500 text-xs truncate">{cancion.artista}</p>
          {cancion.descargada && (
            <div className="mt-3 flex items-start gap-2 bg-yellow-950/40 border border-yellow-800/40 rounded-xl px-3 py-2">
              <span className="text-yellow-400 text-xs flex-shrink-0 mt-0.5">⚠</span>
              <p className="text-yellow-400/80 text-xs">
                El archivo también se borrará del laptop la próxima vez que el asistente esté activo.
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini Player (reproducción en el teléfono) ─────────────────────────────────

function MiniPlayer({
  info,
  onClose,
  onGuardarMp3,
  guardandoMp3 = false,
  progresoMp3 = 0,
}: {
  info: MiniPlayerInfo;
  onClose: () => void;
  onGuardarMp3?: () => void;
  guardandoMp3?: boolean;
  progresoMp3?: number;
}) {
  const [modo, setModo] = useState<"local" | "youtube">(
    info.localUrl ? "local" : "youtube"
  );

  return (
    <div className="fixed bottom-16 left-0 right-0 z-25 max-w-lg mx-auto px-3 pb-2">
      <div className="bg-gray-900 border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60">
          <div className="flex items-center gap-2 min-w-0">
            <PhoneIcon />
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{info.titulo}</p>
              <p className="text-gray-500 text-xs truncate">{info.artista}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {/* Toggle local ↔ YouTube */}
            {info.localUrl && info.videoId && (
              <button
                onClick={() => setModo(modo === "local" ? "youtube" : "local")}
                className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg px-2 py-1 transition-colors"
              >
                {modo === "local" ? "▶ YT" : "💾 Local"}
              </button>
            )}
            {/* Guardar MP3 en este dispositivo */}
            {onGuardarMp3 && info.localUrl && (
              <button
                onClick={onGuardarMp3}
                disabled={guardandoMp3}
                title="Guardar MP3 en este dispositivo"
                className="relative h-7 min-w-[2rem] rounded-lg bg-gray-800 hover:bg-indigo-800 border border-gray-700 hover:border-indigo-600 flex items-center justify-center text-gray-400 hover:text-indigo-300 disabled:opacity-60 px-1.5 overflow-hidden transition-all"
              >
                <span
                  className="absolute left-0 top-0 bottom-0 bg-indigo-700/40 transition-all"
                  style={{ width: guardandoMp3 ? `${progresoMp3}%` : "0%" }}
                />
                <span className="relative">
                  {guardandoMp3
                    ? <span className="text-[9px] font-bold text-indigo-300">{progresoMp3 < 100 ? `${progresoMp3}%` : "✓"}</span>
                    : <SaveDeviceIcon />
                  }
                </span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white text-lg leading-none transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Reproductor local: <audio> HTML5 — sin anuncios, funciona en WiFi */}
        {modo === "local" && info.localUrl && (
          <div className="px-4 py-4 space-y-2">
            <audio
              key={info.localUrl}
              src={info.localUrl}
              controls
              autoPlay
              className="w-full h-10"
              onError={() => info.videoId && setModo("youtube")}
            />
            <p className="text-xs text-gray-600 text-center flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Streaming local · Funciona sin internet (misma red WiFi)
            </p>
          </div>
        )}

        {/* YouTube embed como alternativa */}
        {modo === "youtube" && info.videoId && (
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              src={`https://www.youtube.com/embed/${info.videoId}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        )}

        {/* Sin fuente disponible */}
        {!info.localUrl && !info.videoId && (
          <div className="px-4 py-6 text-center text-gray-600 text-sm">
            No hay fuente de audio disponible
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tarjeta de resultado de búsqueda ──────────────────────────────────────────

function ResultadoCard({
  r,
  msg,
  cargando,
  onPlayLaptop,
  onDescargar,
  onPlayPhone,
}: {
  r: Resultado;
  msg?: { text: string; ok: boolean };
  cargando?: boolean;
  onPlayLaptop: () => void;
  onDescargar: () => void;
  onPlayPhone: () => void;
}) {
  const [thumbOk, setThumbOk] = useState(true);
  const vidId = extraerVideoId(r.url);

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-900/70 border border-gray-800/50 hover:border-gray-700/60 transition-colors">
      {/* Thumbnail */}
      <div className="w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800">
        {thumbOk && r.thumbnail ? (
          <img
            src={r.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setThumbOk(false)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient(r.artista)} flex items-center justify-center`}>
            <span className="text-white text-xs font-bold">{initials(r.artista)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate leading-tight">{r.titulo}</p>
        <p className="text-gray-500 text-xs truncate mt-0.5">
          {r.artista}
          {r.duracion && <span className="text-gray-700"> · {r.duracion}</span>}
        </p>
        {msg && (
          <p className={`text-xs mt-1 font-medium ${msg.ok ? "text-green-400" : "text-yellow-400"}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-1.5 flex-shrink-0">
        {/* Reproducir en teléfono */}
        {vidId && (
          <button
            onClick={onPlayPhone}
            title="Reproducir en este dispositivo"
            className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700/50 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
          >
            <PhoneIcon />
          </button>
        )}
        {/* Reproducir en laptop */}
        <button
          onClick={onPlayLaptop}
          disabled={cargando}
          title="Reproducir en el laptop"
          className="w-9 h-9 rounded-xl bg-green-700 hover:bg-green-600 disabled:opacity-50 flex items-center justify-center text-white transition-colors"
        >
          {cargando ? <span className="text-xs animate-spin">↻</span> : <LaptopIcon />}
        </button>
        {/* Descargar */}
        <button
          onClick={onDescargar}
          disabled={cargando}
          title="Descargar al laptop"
          className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700/50 flex items-center justify-center text-gray-300 transition-colors"
        >
          <DownloadIcon />
        </button>
      </div>
    </div>
  );
}

// ── Tarjeta de canción de la biblioteca ───────────────────────────────────────

function CancionCard({
  cancion,
  isPlaying,
  onPlayLaptop,
  onStop,
  onPlayPhone,
  onDelete,
  onGuardarMp3,
  guardandoMp3 = false,
  progresoMp3 = 0,
}: {
  cancion: Cancion;
  isPlaying: boolean;
  onPlayLaptop: () => void;
  onStop: () => void;
  onPlayPhone: () => void;
  onDelete: () => void;
  onGuardarMp3?: () => void;
  guardandoMp3?: boolean;
  progresoMp3?: number;
}) {
  const desde = formatDistanceToNow(parseISO(cancion.solicitada_en), { locale: es, addSuffix: true });
  const vidId = cancion.url_youtube ? extraerVideoId(cancion.url_youtube) : null;

  return (
    <div className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 ${
      isPlaying
        ? "bg-green-950/50 border-green-700/40 shadow-lg shadow-green-950/30"
        : "bg-gray-900/70 border-gray-800/50 hover:bg-gray-800/60 hover:border-gray-700/60"
    }`}>
      <AlbumArt artista={cancion.artista} isPlaying={isPlaying} />

      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate leading-tight ${isPlaying ? "text-green-300" : "text-white"}`}>
          {cancion.titulo}
        </p>
        <p className="text-gray-500 text-xs truncate mt-0.5">{cancion.artista}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {cancion.descargada ? (
            <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Lista
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Descargando
            </span>
          )}
          {cancion.duracion_seg && (
            <span className="text-xs text-gray-600">{formatDur(cancion.duracion_seg)}</span>
          )}
          <span className="text-xs text-gray-700 ml-auto">{desde}</span>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Play en teléfono */}
        {vidId && (
          <button
            onClick={onPlayPhone}
            title="Reproducir en este dispositivo"
            className="w-9 h-9 rounded-full bg-gray-800 hover:bg-indigo-700 border border-gray-700/50 hover:border-indigo-600 flex items-center justify-center text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
          >
            <PhoneIcon />
          </button>
        )}

        {/* Play / Stop en laptop */}
        {cancion.descargada && (
          isPlaying ? (
            <button
              onClick={onStop}
              title="Detener"
              className="w-10 h-10 rounded-full bg-green-600 hover:bg-red-700 flex items-center justify-center text-white shadow-md transition-colors"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              onClick={onPlayLaptop}
              title="Reproducir en el laptop"
              className="w-10 h-10 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-white shadow-md transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
            >
              <PlayIcon />
            </button>
          )
        )}

        {/* Guardar MP3 en este dispositivo */}
        {onGuardarMp3 && (
          <button
            onClick={onGuardarMp3}
            disabled={guardandoMp3}
            title="Guardar MP3 en este dispositivo"
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-indigo-800 border border-gray-700/40 hover:border-indigo-600/60 flex items-center justify-center text-gray-500 hover:text-indigo-300 disabled:opacity-60 transition-all opacity-0 group-hover:opacity-100 relative overflow-hidden"
          >
            {guardandoMp3 ? (
              <>
                {/* barra de progreso de fondo */}
                <span
                  className="absolute left-0 top-0 bottom-0 bg-indigo-700/40 transition-all"
                  style={{ width: `${progresoMp3}%` }}
                />
                <span className="relative text-[9px] font-bold text-indigo-300">
                  {progresoMp3 < 100 ? `${progresoMp3}%` : "✓"}
                </span>
              </>
            ) : (
              <SaveDeviceIcon />
            )}
          </button>
        )}

        {/* Eliminar */}
        <button
          onClick={onDelete}
          title="Eliminar"
          className="w-8 h-8 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-950/50 flex items-center justify-center transition-colors"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ── Now Playing bar (laptop) ───────────────────────────────────────────────────

function NowPlayingBar({ cancion, onStop }: { cancion: Cancion; onStop: () => void }) {
  return (
    <div className="fixed bottom-16 left-0 right-0 z-20 px-3 pb-2 max-w-lg mx-auto">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/40 rounded-2xl p-3 flex items-center gap-3 shadow-2xl shadow-black/50">
        <AlbumArt artista={cancion.artista} isPlaying size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{cancion.titulo}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <LaptopIcon />
            <p className="text-gray-400 text-xs">Reproduciendo en laptop</p>
          </div>
        </div>
        <button
          onClick={onStop}
          className="w-10 h-10 rounded-full bg-gray-800 hover:bg-red-950/60 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-red-400 transition-all"
        >
          <StopIcon />
        </button>
      </div>
    </div>
  );
}

// ── Formulario de búsqueda ────────────────────────────────────────────────────

function FormBuscar({
  query,
  setQuery,
  onBuscar,
  buscando,
  error,
}: {
  query: string;
  setQuery: (q: string) => void;
  onBuscar: (q: string) => void;
  buscando: boolean;
  error: string;
}) {
  return (
    <div className="space-y-2">
      <form onSubmit={(e) => { e.preventDefault(); onBuscar(query); }}>
        <div className="flex items-center gap-2.5 bg-gray-900 border border-gray-700/60 rounded-2xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-red-500/40 focus-within:border-red-800/40 transition-all">
          <YTIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Artista, canción o álbum…"
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-600"
          />
          <button
            type="submit"
            disabled={buscando || !query.trim()}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex-shrink-0"
          >
            {buscando ? <span className="inline-block animate-spin px-1">↻</span> : "Buscar"}
          </button>
        </div>
      </form>
      {error && <p className="text-red-400 text-xs px-1">{error}</p>}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[75, 55, 65, 45].map((w, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-900/60 border border-gray-800/40">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 animate-pulse" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3.5 bg-gray-800 rounded-full animate-pulse" style={{ width: `${w}%` }} />
            <div className="h-3 bg-gray-800 rounded-full animate-pulse w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function MusicaPage() {
  const [apiKey, setApiKey]           = useState<string | null>(null);
  const [tab, setTab]                 = useState<Tab>("buscar");

  // Búsqueda
  const [query, setQuery]             = useState("");
  const [resultados, setResultados]   = useState<Resultado[]>([]);
  const [buscando, setBuscando]       = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [msgCards, setMsgCards]       = useState<Record<string, { text: string; ok: boolean }>>({});
  const [procesando, setProcesando]   = useState<string | null>(null);

  // Biblioteca
  const [canciones, setCanciones]     = useState<Cancion[]>([]);
  const [jugando, setJugando]         = useState<Cancion | null>(null);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mini player (teléfono)
  const [miniPlayer, setMiniPlayer]   = useState<MiniPlayerInfo | null>(null);

  // Confirmación de eliminación
  const [confirmando, setConfirmando] = useState<Cancion | null>(null);

  // Descarga de MP3 al dispositivo
  const [descargaEst, setDescargaEst] = useState<DescargaEstado | null>(null);

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
      const data: Cancion[] = (await r.json()).filter(
        (c: Cancion) => c.accion !== "delete"
      );
      setCanciones(data);
      setJugando((prev) => {
        if (!prev) return null;
        const actual = data.find((c) => c.id === prev.id);
        return actual?.accion === "play" ? actual : actual?.descargada ? prev : null;
      });
      setError("");
    } catch {
      setError("Sin conexión");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    cargar(apiKey);
    pollRef.current = setInterval(() => cargar(), 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [apiKey, cargar]);

  function guardarKey(k: string) {
    localStorage.setItem(STORAGE_KEY, k);
    setApiKey(k);
    cargar(k);
  }

  // ── Búsqueda ───────────────────────────────────────────────────────────────

  async function ejecutarBusqueda(q: string) {
    const trimmed = q.trim();
    if (!trimmed || buscando) return;
    setQuery(trimmed);
    setBuscando(true);
    setErrorBusqueda("");
    setResultados([]);
    setTab("buscar");
    try {
      const r = await fetch(
        `/api/musica/buscar?q=${encodeURIComponent(trimmed)}`,
        { headers: { "x-api-key": getApiKey() } }
      );
      if (!r.ok) throw new Error();
      setResultados(await r.json());
    } catch {
      setErrorBusqueda("No se pudo buscar. Comprueba tu conexión.");
    } finally {
      setBuscando(false);
    }
  }

  // ── Acciones biblioteca ────────────────────────────────────────────────────

  async function playLaptop(c: Cancion) {
    for (const otra of canciones.filter((x) => x.accion === "play" && x.id !== c.id)) {
      await fetch(`/api/musica/${otra.id}`, {
        method: "PATCH", headers: apiHeaders(), body: JSON.stringify({ accion: null }),
      });
    }
    await fetch(`/api/musica/${c.id}`, {
      method: "PATCH", headers: apiHeaders(), body: JSON.stringify({ accion: "play" }),
    });
    setJugando(c);
    cargar();
  }

  async function stop() {
    if (!jugando) return;
    await fetch(`/api/musica/${jugando.id}`, {
      method: "PATCH", headers: apiHeaders(), body: JSON.stringify({ accion: "stop" }),
    });
    setJugando(null);
    cargar();
  }

  async function confirmarEliminar() {
    if (!confirmando) return;
    const c = confirmando;
    setConfirmando(null);
    // Optimistic: quitar de la UI de inmediato
    setCanciones((prev) => prev.filter((x) => x.id !== c.id));
    if (jugando?.id === c.id) setJugando(null);
    if (c.descargada) {
      // Soft delete: señala al laptop que borre el archivo local.
      // Python procesará accion='delete', borrará el archivo y luego
      // llamará DELETE (sin ?soft=1) para eliminar el registro de la BD.
      await fetch(`/api/musica/${c.id}?soft=1`, { method: "DELETE", headers: apiHeaders() });
    } else {
      // Sin archivo local: eliminar directamente de la BD
      await fetch(`/api/musica/${c.id}`, { method: "DELETE", headers: apiHeaders() });
    }
  }

  function playPhone(info: { videoId: string | null; localUrl: string | null; titulo: string; artista: string }) {
    setMiniPlayer(info);
  }

  async function guardarEnDispositivo(urlLocal: string, titulo: string) {
    if (descargaEst) return;
    setDescargaEst({ url: urlLocal, progreso: 0, error: false });
    try {
      await descargarMp3(urlLocal, titulo, (p) =>
        setDescargaEst((prev) => prev ? { ...prev, progreso: p } : null)
      );
    } catch {
      setDescargaEst((prev) => prev ? { ...prev, error: true } : null);
    } finally {
      setTimeout(() => setDescargaEst(null), 3000);
    }
  }

  // ── Acciones de búsqueda ───────────────────────────────────────────────────

  function mostrarMsg(id: string, text: string, ok: boolean) {
    setMsgCards((prev) => ({ ...prev, [id]: { text, ok } }));
    setTimeout(() => setMsgCards((prev) => { const n = { ...prev }; delete n[id]; return n; }), 4000);
  }

  async function enviarResultado(r: Resultado, accion: "play" | null) {
    if (procesando === r.id) return;
    setProcesando(r.id);
    try {
      const res = await fetch("/api/musica", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          busqueda: r.titulo, titulo: r.titulo, artista: r.artista,
          url_youtube: r.url, duracion_seg: r.duracion_seg || null, accion,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        if (accion === "play" && data.id) {
          await fetch(`/api/musica/${data.id}`, {
            method: "PATCH", headers: apiHeaders(), body: JSON.stringify({ accion: "play" }),
          });
          mostrarMsg(r.id, "✓ Reproduciendo en el laptop", true);
          cargar();
        } else {
          mostrarMsg(r.id, "Ya está en la biblioteca", false);
          setTab("biblioteca");
        }
        return;
      }

      if (!res.ok) throw new Error();

      if (accion === "play") {
        mostrarMsg(r.id, "✓ Enviado al laptop", true);
        cargar();
      } else {
        mostrarMsg(r.id, "✓ Añadida a la cola de descarga", true);
        cargar();
        setTab("descargando");
      }
    } catch {
      mostrarMsg(r.id, "Error al enviar. Intenta de nuevo.", false);
    } finally {
      setProcesando(null);
    }
  }

  if (apiKey === null) return <PantallaLogin onSave={guardarKey} />;

  const listas     = canciones.filter((c) => c.descargada);
  const pendientes = canciones.filter((c) => !c.descargada);

  const miniPlayerVisible = !!miniPlayer;
  const bottomOffset = miniPlayerVisible || jugando ? "pb-56" : "pb-24";

  return (
    <div className="min-h-screen bg-gray-950 max-w-lg mx-auto">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/60 px-4 pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-white font-bold text-xl tracking-tight">Música</h1>
          <div className="flex items-center gap-1">
            {error && <span className="text-red-400 text-xs mr-1">{error}</span>}
            <button
              onClick={() => cargar()}
              title="Actualizar"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            >
              ↻
            </button>
            <button
              onClick={() => { localStorage.removeItem(STORAGE_KEY); setApiKey(null); }}
              title="Cambiar clave"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors text-sm"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900/80 rounded-xl p-1">
          {([
            ["buscar",      "Buscar",       null],
            ["biblioteca",  "Biblioteca",   listas.length],
            ["descargando", "Descargando",  pendientes.length],
          ] as const).map(([id, label, count]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === id ? "bg-gray-800 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
              {count !== null && count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  tab === id ? "bg-green-600 text-white" : "bg-gray-800 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className={`p-4 ${bottomOffset}`}>

        {/* ── Tab: Buscar ── */}
        {tab === "buscar" && (
          <div className="space-y-4">
            <FormBuscar
              query={query}
              setQuery={setQuery}
              onBuscar={ejecutarBusqueda}
              buscando={buscando}
              error={errorBusqueda}
            />

            {buscando ? (
              <Skeleton />
            ) : resultados.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 px-1">
                  {resultados.length} resultados ·{" "}
                  <span className="inline-flex items-center gap-1"><LaptopIcon />= laptop</span>
                  {" · "}
                  <span className="inline-flex items-center gap-1"><PhoneIcon />= este dispositivo</span>
                </p>
                {resultados.map((r) => {
                  const vid = extraerVideoId(r.url);
                  return (
                    <ResultadoCard
                      key={r.id}
                      r={r}
                      msg={msgCards[r.id]}
                      cargando={procesando === r.id}
                      onPlayLaptop={() => enviarResultado(r, "play")}
                      onDescargar={() => enviarResultado(r, null)}
                      onPlayPhone={() => playPhone({ videoId: vid, localUrl: null, titulo: r.titulo, artista: r.artista })}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="w-24 h-24 rounded-3xl bg-gray-900 border border-gray-800/50 flex items-center justify-center">
                  <YTIcon className="w-10 h-10" />
                </div>
                <div>
                  <p className="text-gray-300 font-semibold">Busca tu música favorita</p>
                  <p className="text-gray-600 text-sm mt-1">Escribe el nombre de un artista o canción</p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                  {["Bad Bunny", "Coldplay", "Dua Lipa", "Eminem"].map((s) => (
                    <button
                      key={s}
                      onClick={() => ejecutarBusqueda(s)}
                      className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl py-2 px-3 hover:text-white hover:border-gray-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Biblioteca ── */}
        {tab === "biblioteca" && (
          cargando ? <Skeleton /> :
          listas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="w-24 h-24 rounded-3xl bg-gray-900 border border-gray-800/50 flex items-center justify-center text-5xl">🎵</div>
              <div>
                <p className="text-gray-300 font-semibold">Biblioteca vacía</p>
                <p className="text-gray-600 text-sm mt-1">Descarga canciones desde la pestaña Buscar</p>
              </div>
              <button onClick={() => setTab("buscar")} className="text-green-500 text-sm font-medium hover:text-green-400">
                Ir a Buscar →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 px-1 mb-3">{listas.length} canción{listas.length !== 1 ? "es" : ""} descargada{listas.length !== 1 ? "s" : ""}</p>
              {listas.map((c) => {
                const vid = c.url_youtube ? extraerVideoId(c.url_youtube) : null;
                return (
                  <CancionCard
                    key={c.id}
                    cancion={c}
                    isPlaying={jugando?.id === c.id}
                    onPlayLaptop={() => playLaptop(c)}
                    onStop={stop}
                    onPlayPhone={() => playPhone({ videoId: vid, localUrl: c.url_local ?? null, titulo: c.titulo, artista: c.artista })}
                    onDelete={() => setConfirmando(c)}
                    onGuardarMp3={c.url_local ? () => guardarEnDispositivo(c.url_local!, c.titulo) : undefined}
                    guardandoMp3={!!descargaEst && descargaEst.url === c.url_local}
                    progresoMp3={descargaEst && descargaEst.url === c.url_local ? descargaEst.progreso : 0}
                  />
                );
              })}
            </div>
          )
        )}

        {/* ── Tab: Descargando ── */}
        {tab === "descargando" && (
          cargando ? <Skeleton /> :
          pendientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="w-24 h-24 rounded-3xl bg-gray-900 border border-gray-800/50 flex items-center justify-center text-5xl">⬇️</div>
              <div>
                <p className="text-gray-300 font-semibold">Sin descargas pendientes</p>
                <p className="text-gray-600 text-sm mt-1">Las canciones que solicites aparecerán aquí</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 px-1 mb-3">El laptop descargará estas canciones automáticamente</p>
              {pendientes.map((c) => {
                const vid = c.url_youtube ? extraerVideoId(c.url_youtube) : null;
                return (
                  <CancionCard
                    key={c.id}
                    cancion={c}
                    isPlaying={false}
                    onPlayLaptop={() => {}}
                    onStop={() => {}}
                    onPlayPhone={() => playPhone({ videoId: vid, localUrl: c.url_local ?? null, titulo: c.titulo, artista: c.artista })}
                    onDelete={() => setConfirmando(c)}
                    onGuardarMp3={c.url_local ? () => guardarEnDispositivo(c.url_local!, c.titulo) : undefined}
                    guardandoMp3={!!descargaEst && descargaEst.url === c.url_local}
                    progresoMp3={descargaEst && descargaEst.url === c.url_local ? descargaEst.progreso : 0}
                  />
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Mini player (teléfono) */}
      {miniPlayer && (
        <MiniPlayer
          info={miniPlayer}
          onClose={() => setMiniPlayer(null)}
          onGuardarMp3={miniPlayer.localUrl ? () => guardarEnDispositivo(miniPlayer.localUrl!, miniPlayer.titulo) : undefined}
          guardandoMp3={!!descargaEst && descargaEst.url === miniPlayer.localUrl}
          progresoMp3={descargaEst && descargaEst.url === miniPlayer.localUrl ? descargaEst.progreso : 0}
        />
      )}

      {/* Now Playing (laptop) — solo si no hay mini player activo */}
      {jugando && !miniPlayer && (
        <NowPlayingBar cancion={jugando} onStop={stop} />
      )}

      {/* Confirmación de eliminación */}
      {confirmando && (
        <ConfirmarEliminar
          cancion={confirmando}
          onConfirm={confirmarEliminar}
          onCancel={() => setConfirmando(null)}
        />
      )}

      <BottomNav active="musica" />
    </div>
  );
}
