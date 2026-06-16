"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Tarea, Prioridad } from "@/types/task";
import {
  formatDistanceToNow,
  isPast,
  isToday,
  isTomorrow,
  isThisWeek,
  parseISO,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { BottomNav } from "@/components/BottomNav";

// ── Auth ───────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "av_api_key";

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function apiHeaders(): HeadersInit {
  return { "Content-Type": "application/json", "x-api-key": getApiKey() };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function etiquetaFecha(iso: string): { texto: string; color: string } {
  const d = parseISO(iso);
  if (isPast(d) && !isToday(d))
    return { texto: `Venció ${formatDistanceToNow(d, { locale: es, addSuffix: true })}`, color: "text-red-500" };
  if (isToday(d))
    return { texto: `Hoy ${format(d, "HH:mm")}`, color: "text-orange-400" };
  if (isTomorrow(d))
    return { texto: `Mañana ${format(d, "HH:mm")}`, color: "text-yellow-400" };
  if (isThisWeek(d, { locale: es }))
    return { texto: format(d, "EEEE HH:mm", { locale: es }), color: "text-blue-400" };
  return { texto: format(d, "d MMM yyyy HH:mm", { locale: es }), color: "text-gray-500" };
}

const PRIORIDAD_BAR: Record<Prioridad, string> = {
  baja:    "bg-gray-600",
  normal:  "bg-blue-500",
  alta:    "bg-orange-500",
  urgente: "bg-red-500",
};

const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  baja: "Baja", normal: "Normal", alta: "Alta", urgente: "Urgente",
};

// ── Agrupación ─────────────────────────────────────────────────────────────────

type Grupo = { titulo: string; tareas: Tarea[] };

function agrupar(tareas: Tarea[]): Grupo[] {
  const vencidas: Tarea[] = [], hoy: Tarea[] = [], proximas: Tarea[] = [];
  const sinFecha: Tarea[] = [], completadas: Tarea[] = [];

  for (const t of tareas) {
    if (t.completada) { completadas.push(t); continue; }
    if (!t.fecha_limite) { sinFecha.push(t); continue; }
    const d = parseISO(t.fecha_limite);
    if (isPast(d) && !isToday(d)) vencidas.push(t);
    else if (isToday(d))          hoy.push(t);
    else                          proximas.push(t);
  }

  const grupos: Grupo[] = [];
  if (vencidas.length)    grupos.push({ titulo: "⚠️ Vencidas",   tareas: vencidas });
  if (hoy.length)         grupos.push({ titulo: "📅 Hoy",         tareas: hoy });
  if (proximas.length)    grupos.push({ titulo: "🗓️ Próximas",    tareas: proximas });
  if (sinFecha.length)    grupos.push({ titulo: "📝 Sin fecha",   tareas: sinFecha });
  if (completadas.length) grupos.push({ titulo: "✅ Completadas", tareas: completadas });
  return grupos;
}

// ── Componentes ────────────────────────────────────────────────────────────────

function TareaCard({
  tarea,
  onComplete,
  onDelete,
}: {
  tarea: Tarea;
  onComplete: (id: number, val: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const fecha = tarea.fecha_limite ? etiquetaFecha(tarea.fecha_limite) : null;

  return (
    <div
      className={`flex items-start gap-2.5 p-3.5 rounded-2xl border transition-all ${
        tarea.completada
          ? "bg-gray-900/30 border-gray-800/30 opacity-50"
          : "bg-gray-900/70 border-gray-800/50 hover:border-gray-700/60"
      }`}
    >
      {/* Priority bar */}
      <div
        className={`w-1 self-stretch rounded-full flex-shrink-0 mt-0.5 ${PRIORIDAD_BAR[tarea.prioridad]}`}
      />

      {/* Checkbox */}
      <button
        onClick={() => onComplete(tarea.id, !tarea.completada)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          tarea.completada
            ? "bg-green-600 border-green-600"
            : "border-gray-600 hover:border-green-500"
        }`}
      >
        {tarea.completada && <span className="text-white text-xs leading-none">✓</span>}
      </button>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm leading-snug ${tarea.completada ? "line-through text-gray-600" : "text-white"}`}>
          {tarea.titulo}
        </p>
        {tarea.descripcion && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{tarea.descripcion}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs text-gray-600 font-medium">
            {PRIORIDAD_LABEL[tarea.prioridad]}
          </span>
          {fecha && (
            <span className={`text-xs font-medium ${fecha.color}`}>{fecha.texto}</span>
          )}
        </div>
      </div>

      {/* Eliminar */}
      <button
        onClick={() => onDelete(tarea.id)}
        className="text-gray-700 hover:text-red-400 hover:bg-red-950/30 w-7 h-7 rounded-lg flex items-center justify-center text-lg leading-none transition-colors flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
}

// ── Web Speech API ─────────────────────────────────────────────────────────────

type EstadoMic = "inactivo" | "escuchando" | "error";

function useMicrofono(onResultado: (texto: string) => void) {
  const [estado, setEstado] = useState<EstadoMic>("inactivo");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  function iniciar() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Rec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Rec) { setEstado("error"); return; }

    const rec = new Rec();
    rec.lang = "es-ES";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart  = () => setEstado("escuchando");
    rec.onend    = () => setEstado("inactivo");
    rec.onerror  = () => setEstado("error");
    rec.onresult = (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => {
      const texto = e.results[0][0].transcript;
      setEstado("inactivo");
      onResultado(texto);
    };

    recRef.current = rec;
    rec.start();
  }

  function detener() {
    recRef.current?.stop();
    setEstado("inactivo");
  }

  const soportado =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);

  return { estado, iniciar, detener, soportado };
}

// ── Parser de voz → campos de recordatorio ────────────────────────────────────

function parsearVoz(texto: string): {
  titulo: string;
  prioridad: Prioridad;
  fecha: string;          // "YYYY-MM-DDTHH:mm" o ""
  textoOriginal: string;
} {
  let t = texto.toLowerCase().trim();
  const textoOriginal = texto;

  // Prefijos típicos de dictado que no son parte del recordatorio
  t = t.replace(
    /^(recuérdame|recuerdame|recordar|recordatorio|añadir|agregar|crear|pon un recordatorio|agrega|ponme|que no se me olvide|no olvidar)\s+/i,
    ""
  );

  // ── Prioridad ─────────────────────────────────────────────────────────────
  let prioridad: Prioridad = "normal";
  if (/\b(urgente|urgentemente|es urgente)\b/.test(t)) {
    prioridad = "urgente";
    t = t.replace(/\b(urgente|urgentemente|es urgente)\b/g, "");
  } else if (/\b(importante|alta prioridad|es importante)\b/.test(t)) {
    prioridad = "alta";
    t = t.replace(/\b(importante|alta prioridad|es importante)\b/g, "");
  } else if (/\b(baja prioridad|sin urgencia|cuando pueda)\b/.test(t)) {
    prioridad = "baja";
    t = t.replace(/\b(baja prioridad|sin urgencia|cuando pueda)\b/g, "");
  }

  // ── Fecha ─────────────────────────────────────────────────────────────────
  const ahora = new Date();
  let fecha: Date | undefined;

  if (/\bpasado ma[ñn]ana\b/.test(t)) {
    fecha = new Date(ahora); fecha.setDate(fecha.getDate() + 2);
    t = t.replace(/\bpasado ma[ñn]ana\b/, "");
  } else if (/\bma[ñn]ana\b/.test(t)) {
    fecha = new Date(ahora); fecha.setDate(fecha.getDate() + 1);
    t = t.replace(/\bma[ñn]ana\b/, "");
  } else if (/\bhoy\b/.test(t)) {
    fecha = new Date(ahora);
    t = t.replace(/\bhoy\b/, "");
  }

  // Día de semana: "el lunes", "este martes"...
  const DIAS: Record<string, number> = {
    domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
    jueves: 4, viernes: 5, sabado: 6, sábado: 6,
  };
  const diaRe = /\b(?:el\s+|este\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/;
  const diaM = t.match(diaRe);
  if (diaM && !fecha) {
    const sinAcento = diaM[1].normalize("NFD").replace(/[̀-ͯ]/g, "");
    const n = DIAS[sinAcento] ?? DIAS[diaM[1]];
    if (n !== undefined) {
      fecha = new Date(ahora);
      let diff = n - fecha.getDay();
      if (diff <= 0) diff += 7;
      fecha.setDate(fecha.getDate() + diff);
      t = t.replace(diaM[0], "");
    }
  }

  // "en X días/semanas"
  const enM = t.match(/\ben\s+(\d+)\s+(d[ií]as?|semanas?)\b/);
  if (enM && !fecha) {
    fecha = new Date(ahora);
    const n = parseInt(enM[1]);
    fecha.setDate(fecha.getDate() + (/semana/.test(enM[2]) ? n * 7 : n));
    t = t.replace(enM[0], "");
  }

  // Hora: "a las 3", "a las 3 y media", "a las 3 de la tarde"
  const horaRe = /\ba\s+las?\s+(\d+)(?:\s+y\s+(media|cuarto|veinte))?(?:\s+de\s+la\s+(ma[ñn]ana|tarde|noche))?\b/;
  const horaM = t.match(horaRe);
  if (horaM) {
    if (!fecha) fecha = new Date(ahora);
    let hora = parseInt(horaM[1]);
    let min = 0;
    if (horaM[2] === "media")  min = 30;
    if (horaM[2] === "cuarto") min = 15;
    if (horaM[2] === "veinte") min = 20;
    if (horaM[3] === "tarde" || horaM[3] === "noche") { if (hora < 12) hora += 12; }
    else if (!horaM[3] && hora >= 1 && hora <= 6) hora += 12;
    fecha.setHours(hora, min, 0, 0);
    t = t.replace(horaM[0], "");
  } else if (fecha) {
    fecha.setHours(9, 0, 0, 0); // hora por defecto: 9:00
  }

  // ── Limpieza ──────────────────────────────────────────────────────────────
  t = t.replace(/\s{2,}/g, " ").trim();
  t = t.replace(/^(para|el|la|los|las|de|del|que|a|y|un|una)\s+/gi, "");
  t = t.replace(/\s+(para|el|la|de|del|que|a|y)\s*$/gi, "").trim();

  const titulo = t.charAt(0).toUpperCase() + t.slice(1);

  const fechaStr = fecha
    ? [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0"),
      ].join("-") +
      "T" +
      [
        String(fecha.getHours()).padStart(2, "0"),
        String(fecha.getMinutes()).padStart(2, "0"),
      ].join(":")
    : "";

  return { titulo, prioridad, fecha: fechaStr, textoOriginal };
}

// ── Formulario de nueva tarea ──────────────────────────────────────────────────

function FormularioTarea({ apiKey, onCreated }: { apiKey: string; onCreated: () => void }) {
  const [titulo, setTitulo]       = useState("");
  const [descripcion, setDesc]    = useState("");
  const [fecha, setFecha]         = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("normal");
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState(false);
  const [vozHint, setVozHint]     = useState(""); // texto reconocido para mostrar

  const mic = useMicrofono((texto) => {
    const parsed = parsearVoz(texto);
    setVozHint(parsed.textoOriginal);
    setTitulo(parsed.titulo);
    setPrioridad(parsed.prioridad);
    if (parsed.fecha) setFecha(parsed.fecha);
    setExpanded(true);
    // Borrar el hint después de 5 s
    setTimeout(() => setVozHint(""), 5000);
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setLoading(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        titulo:       titulo.trim(),
        descripcion:  descripcion.trim() || undefined,
        fecha_limite: fecha || undefined,
        prioridad,
      }),
    });
    setTitulo(""); setDesc(""); setFecha(""); setPrioridad("normal");
    setExpanded(false); setVozHint("");
    setLoading(false);
    onCreated();
  }

  const escuchando = mic.estado === "escuchando";

  return (
    <form onSubmit={submit} className="space-y-2">
      {/* Fila principal */}
      <div className="flex gap-2">
        <div className={`flex-1 flex items-center gap-2 bg-gray-900 border rounded-2xl px-4 py-3 transition-all ${
          escuchando
            ? "border-red-500/60 ring-2 ring-red-500/30"
            : "border-gray-700/60 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent"
        }`}>
          {escuchando ? (
            /* Indicador animado de escucha */
            <div className="flex-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-gray-400 text-sm">Escuchando…</span>
            </div>
          ) : (
            <input
              value={titulo}
              onChange={(e) => { setTitulo(e.target.value); setExpanded(!!e.target.value); }}
              placeholder="Nueva tarea o recordatorio…"
              className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-600"
              required
            />
          )}
        </div>

        {/* Botón micrófono */}
        {mic.soportado && (
          <button
            type="button"
            onClick={escuchando ? mic.detener : mic.iniciar}
            title={escuchando ? "Detener" : "Dictar con voz"}
            className={`w-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all border ${
              escuchando
                ? "bg-red-600 hover:bg-red-500 border-red-500 text-white"
                : mic.estado === "error"
                ? "bg-gray-800 border-gray-700 text-red-400"
                : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300 hover:text-white"
            }`}
          >
            {escuchando ? (
              /* Ícono stop */
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              /* Ícono micrófono */
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/>
              </svg>
            )}
          </button>
        )}

        {/* Botón añadir */}
        <button
          type="submit"
          disabled={loading || !titulo.trim()}
          className="w-12 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-xl font-bold disabled:opacity-40 transition-colors flex-shrink-0 flex items-center justify-center"
        >
          {loading ? <span className="text-sm animate-spin">↻</span> : "+"}
        </button>
      </div>

      {/* Texto reconocido (hint) */}
      {vozHint && !escuchando && (
        <p className="text-xs text-gray-500 px-2 flex items-center gap-1.5">
          <span className="text-green-500">✓</span>
          <span className="truncate">«{vozHint}»</span>
        </p>
      )}

      {/* Error: navegador sin soporte */}
      {mic.estado === "error" && (
        <p className="text-xs text-red-400 px-2">
          El navegador no soporta reconocimiento de voz. Usa Chrome o Edge.
        </p>
      )}

      {/* Campos extendidos */}
      {expanded && (
        <div className="bg-gray-900/70 border border-gray-800/50 rounded-2xl p-3 space-y-2.5">
          <textarea
            value={descripcion}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-gray-600 resize-none"
          />
          <div className="flex gap-2 pt-2 border-t border-gray-800/50">
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700/40 text-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as Prioridad)}
              className="bg-gray-800 border border-gray-700/40 text-gray-300 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="baja">↓ Baja</option>
              <option value="normal">→ Normal</option>
              <option value="alta">↑ Alta</option>
              <option value="urgente">⚡ Urgente</option>
            </select>
          </div>
        </div>
      )}
    </form>
  );
}

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
            <p className="text-gray-500 text-sm mt-1">Gestiona tus tareas y música</p>
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

// ── App ────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [apiKey, setApiKey]           = useState<string | null>(null);
  const [tareas, setTareas]           = useState<Tarea[]>([]);
  const [error, setError]             = useState("");
  const [verCompletadas, setVerComp]  = useState(false);

  useEffect(() => {
    const k = getApiKey();
    setApiKey(k || null);
  }, []);

  const cargar = useCallback(async (key?: string) => {
    const k = key ?? apiKey ?? "";
    if (!k) return;
    try {
      const r = await fetch("/api/tasks", { headers: { "x-api-key": k } });
      if (r.status === 401) { setApiKey(null); return; }
      setTareas(await r.json());
      setError("");
    } catch {
      setError("Sin conexión");
    }
  }, [apiKey]);

  useEffect(() => { cargar(); }, [cargar]);

  function guardarKey(k: string) {
    localStorage.setItem(STORAGE_KEY, k);
    setApiKey(k);
    cargar(k);
  }

  async function completar(id: number, val: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: apiHeaders(), body: JSON.stringify({ completada: val }),
    });
    cargar();
  }

  async function eliminar(id: number) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE", headers: apiHeaders() });
    cargar();
  }

  if (apiKey === null) return <PantallaLogin onSave={guardarKey} />;

  const grupos     = agrupar(tareas);
  const pendientes = tareas.filter((t) => !t.completada).length;

  return (
    <div className="min-h-screen bg-gray-950 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/60 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">Tareas</h1>
            <p className={`text-sm mt-0.5 ${pendientes === 0 ? "text-green-500" : "text-gray-400"}`}>
              {pendientes === 0
                ? "Todo al día ✓"
                : `${pendientes} pendiente${pendientes > 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {error && <span className="text-red-400 text-xs mr-1">{error}</span>}
            <button
              onClick={() => setVerComp((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                verCompletadas
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "border-gray-800 text-gray-500 hover:text-gray-300"
              }`}
            >
              {verCompletadas ? "Ocultar hechas" : "Ver todas"}
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
        <FormularioTarea apiKey={apiKey} onCreated={cargar} />
      </div>

      {/* Contenido */}
      <div className="p-4 pb-24 space-y-5">
        {grupos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-24 h-24 rounded-3xl bg-gray-900 flex items-center justify-center text-5xl shadow-inner border border-gray-800/50">
              
            </div>
            <div>
              <p className="text-gray-300 font-semibold text-base">Sin tareas pendientes</p>
              <p className="text-gray-600 text-sm mt-1">Añade una tarea usando el campo de arriba</p>
            </div>
          </div>
        ) : (
          grupos
            .filter((g) => verCompletadas || g.titulo !== "✅ Completadas")
            .map((g) => (
              <section key={g.titulo}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  {g.titulo}
                </h2>
                <div className="space-y-2">
                  {g.tareas.map((t) => (
                    <TareaCard
                      key={t.id}
                      tarea={t}
                      onComplete={completar}
                      onDelete={eliminar}
                    />
                  ))}
                </div>
              </section>
            ))
        )}
      </div>

      <BottomNav active="tareas" />
    </div>
  );
}
