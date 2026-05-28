export type Prioridad = "baja" | "normal" | "alta" | "urgente";

export interface Tarea {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null; // ISO 8601
  prioridad: Prioridad;
  completada: boolean;
  creada_en: string;
}

export interface TareaInput {
  titulo: string;
  descripcion?: string;
  fecha_limite?: string;
  prioridad?: Prioridad;
}
