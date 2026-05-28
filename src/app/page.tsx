"use client";

import { useCallback, useEffect, useState } from "react";
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

function FormularioTarea({ apiKey, onCreated }: { apiKey: string; onCreated: () => void }) {
  const [titulo, setTitulo]       = useState("");
  const [descripcion, setDesc]    = useState("");
  const [fecha, setFecha]         = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("normal");
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setLoading(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        titulo:      titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        fecha_limite: fecha || undefined,
        prioridad,
      }),
    });
    setTitulo(""); setDesc(""); setFecha(""); setPrioridad("normal"); setExpanded(false);
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); setExpanded(true); }}
          placeholder="Nueva tarea o recordatorio…"
          className="flex-1 bg-gray-900 border border-gray-700/60 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-600"
          required
        />
        <button
          type="submit"
          disabled={loading || !titulo.trim()}
          className="w-12 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-xl font-bold disabled:opacity-40 transition-colors flex-shrink-0 flex items-center justify-center"
        >
          {loading ? <span className="text-sm animate-spin">↻</span> : "+"}
        </button>
      </div>

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
              🎉
            </div>
            <div>
              <p className="text-gray-300 font-semibold text-base">Sin tareas pendientes</p>
              <p className="text-gray-600 text-sm mt-1">Añade una tarea usando el campo de arriba</p>
            </div>
          </div>
        ) : (
          grupos
            .filter((g) => verCompletadas || !g.titulo.startsWith("✅"))
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
