"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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

// ── API Key ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "av_api_key";

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function apiHeaders(): HeadersInit {
  return { "Content-Type": "application/json", "x-api-key": getApiKey() };
}

// ── Helpers de fecha ───────────────────────────────────────────────────────────

function etiquetaFecha(iso: string): { texto: string; color: string } {
  const d = parseISO(iso);
  if (isPast(d) && !isToday(d))
    return { texto: `Venció ${formatDistanceToNow(d, { locale: es, addSuffix: true })}`, color: "text-red-600" };
  if (isToday(d))
    return { texto: `Hoy ${format(d, "HH:mm")}`, color: "text-orange-600" };
  if (isTomorrow(d))
    return { texto: `Mañana ${format(d, "HH:mm")}`, color: "text-yellow-600" };
  if (isThisWeek(d, { locale: es }))
    return { texto: format(d, "EEEE HH:mm", { locale: es }), color: "text-blue-600" };
  return { texto: format(d, "d MMM yyyy HH:mm", { locale: es }), color: "text-gray-500" };
}

const PRIORIDAD_BADGE: Record<Prioridad, string> = {
  baja:    "bg-gray-100 text-gray-600",
  normal:  "bg-blue-100 text-blue-700",
  alta:    "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

// ── Agrupación de tareas ───────────────────────────────────────────────────────

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
  if (vencidas.length)   grupos.push({ titulo: "⚠️ Vencidas", tareas: vencidas });
  if (hoy.length)        grupos.push({ titulo: "📅 Hoy", tareas: hoy });
  if (proximas.length)   grupos.push({ titulo: "🗓️ Próximas", tareas: proximas });
  if (sinFecha.length)   grupos.push({ titulo: "📝 Sin fecha", tareas: sinFecha });
  if (completadas.length)grupos.push({ titulo: "✅ Completadas", tareas: completadas });
  return grupos;
}

// ── Componente de tarea ────────────────────────────────────────────────────────

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
      className={`bg-white rounded-xl shadow-sm border p-4 flex gap-3 ${
        tarea.completada ? "opacity-50" : ""
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onComplete(tarea.id, !tarea.completada)}
        className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center
          ${tarea.completada ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"}`}
      >
        {tarea.completada && <span className="text-white text-xs">✓</span>}
      </button>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-gray-900 ${tarea.completada ? "line-through" : ""}`}>
          {tarea.titulo}
        </p>
        {tarea.descripcion && (
          <p className="text-sm text-gray-500 mt-0.5 truncate">{tarea.descripcion}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_BADGE[tarea.prioridad]}`}>
            {tarea.prioridad}
          </span>
          {fecha && (
            <span className={`text-xs font-medium ${fecha.color}`}>{fecha.texto}</span>
          )}
        </div>
      </div>

      {/* Eliminar */}
      <button
        onClick={() => onDelete(tarea.id)}
        className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0 self-start"
      >
        ×
      </button>
    </div>
  );
}

// ── Formulario ─────────────────────────────────────────────────────────────────

function FormularioTarea({ apiKey, onCreated }: { apiKey: string; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("normal");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setLoading(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        fecha_limite: fecha || undefined,
        prioridad,
      }),
    });
    setTitulo("");
    setDescripcion("");
    setFecha("");
    setPrioridad("normal");
    setExpanded(false);
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
      <div className="flex gap-2">
        <input
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); setExpanded(true); }}
          placeholder="Nueva tarea o recordatorio..."
          className="flex-1 border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          required
        />
        <button
          type="submit"
          disabled={loading || !titulo.trim()}
          className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-green-700"
        >
          {loading ? "…" : "✚"}
        </button>
      </div>

      {expanded && (
        <>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción opcional"
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as Prioridad)}
              className="border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="baja">↓ Baja</option>
              <option value="normal">→ Normal</option>
              <option value="alta">↑ Alta</option>
              <option value="urgente">⚡ Urgente</option>
            </select>
          </div>
        </>
      )}
    </form>
  );
}

// ── Pantalla de clave API ──────────────────────────────────────────────────────

function PantallaApiKey({ onSave }: { onSave: (k: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-4">
        <div className="text-center">
          <p className="text-3xl mb-2">🔑</p>
          <h1 className="font-bold text-gray-900 text-lg">Clave de acceso</h1>
          <p className="text-sm text-gray-500 mt-1">
            Introduce la API_KEY que configuraste en Vercel
          </p>
        </div>
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="API key..."
          className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
          onKeyDown={(e) => e.key === "Enter" && val && onSave(val)}
        />
        <button
          onClick={() => val && onSave(val)}
          disabled={!val}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-medium disabled:opacity-40"
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

// ── App principal ──────────────────────────────────────────────────────────────

export default function Home() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [error, setError] = useState("");
  const [verCompletadas, setVerCompletadas] = useState(false);

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

  function guardarApiKey(k: string) {
    localStorage.setItem(STORAGE_KEY, k);
    setApiKey(k);
    cargar(k);
  }

  async function completar(id: number, val: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: apiHeaders(),
      body: JSON.stringify({ completada: val }),
    });
    cargar();
  }

  async function eliminar(id: number) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE", headers: apiHeaders() });
    cargar();
  }

  if (apiKey === null) return <PantallaApiKey onSave={guardarApiKey} />;

  const filtradas = verCompletadas ? tareas : tareas.filter((t) => !t.completada);
  const grupos = agrupar(tareas);
  const pendientes = tareas.filter((t) => !t.completada).length;

  return (
    <div className="max-w-lg mx-auto min-h-screen">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-5 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl">Mis Tareas 🎙️</h1>
            <p className="text-green-100 text-sm mt-0.5">
              {pendientes === 0 ? "Todo al día ✓" : `${pendientes} pendiente${pendientes > 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/musica"
              className="bg-green-700 hover:bg-green-800 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
            >
              🎵 Música
            </Link>
            <button
              onClick={() => setVerCompletadas((v) => !v)}
              className="text-green-100 text-sm underline"
            >
              {verCompletadas ? "Ocultar hechas" : "Ver todas"}
            </button>
          </div>
        </div>
        {error && <p className="text-red-200 text-xs mt-1">{error}</p>}
      </div>

      <div className="p-4 space-y-4">
        {/* Formulario */}
        <FormularioTarea apiKey={apiKey} onCreated={cargar} />

        {/* Grupos */}
        {grupos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🎉</p>
            <p>No hay tareas pendientes</p>
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

        {/* Cambiar clave */}
        <button
          onClick={() => { localStorage.removeItem(STORAGE_KEY); setApiKey(null); }}
          className="w-full text-center text-xs text-gray-300 py-4"
        >
          Cambiar clave API
        </button>
      </div>
    </div>
  );
}
