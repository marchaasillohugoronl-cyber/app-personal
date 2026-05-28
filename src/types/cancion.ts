export interface Cancion {
  id: number;
  titulo: string;
  artista: string;
  busqueda: string;
  descargada: boolean;
  url_youtube: string | null;
  duracion_seg: number | null;
  solicitada_en: string;
  descargada_en: string | null;
  accion: "play" | "stop" | "delete" | null;
}

export interface CancionInput {
  busqueda: string;
  titulo?: string;
  artista?: string;
}
