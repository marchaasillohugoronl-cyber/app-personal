import { NextRequest, NextResponse } from "next/server";
import yts from "yt-search";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return req.headers.get("x-api-key") === process.env.API_KEY;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q requerido" }, { status: 400 });

  try {
    const result = await yts(q);
    const videos = result.videos.slice(0, 8).map((v) => ({
      id:           v.videoId,
      titulo:       v.title,
      artista:      v.author.name,
      duracion:     v.duration.timestamp,
      duracion_seg: v.duration.seconds,
      thumbnail:    v.thumbnail,
      url:          v.url,
    }));
    return NextResponse.json(videos);
  } catch (e) {
    console.error("[buscar] yt-search error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al buscar" },
      { status: 500 }
    );
  }
}
