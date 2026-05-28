import { NextRequest, NextResponse } from "next/server";

function authorized(req: NextRequest) {
  return req.headers.get("x-api-key") === process.env.API_KEY;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q requerido" }, { status: 400 });

  try {
    const yts = (await import("yt-search")).default;
    const result = await yts(q);
    const videos = result.videos.slice(0, 8).map((v) => ({
      id:          v.videoId,
      titulo:      v.title,
      artista:     v.author.name,
      duracion:    v.duration.timestamp,
      duracion_seg: v.duration.seconds,
      thumbnail:   v.thumbnail,
      url:         v.url,
    }));
    return NextResponse.json(videos);
  } catch {
    return NextResponse.json({ error: "Error al buscar en YouTube" }, { status: 500 });
  }
}
