export interface Cancion {
  id: number;
  titulo: string;
  artista: string;
  busqueda: string;
  descargada: boolean;
  url_youtube: string | null;
  url_local: string | null;   // http://[ip-laptop]:8888/archivo.mp3 — streaming en WiFi local
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
