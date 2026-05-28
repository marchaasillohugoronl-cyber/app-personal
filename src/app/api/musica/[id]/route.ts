import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

function authorized(req: NextRequest) {
  return req.headers.get("x-api-key") === process.env.API_KEY;
}

// PATCH /api/musica/[id]  { accion?, descargada?, titulo?, artista?, url_youtube?, duracion_seg? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json();

  const [row] = await sql`
    UPDATE canciones SET
      titulo        = COALESCE(${body.titulo       ?? null}, titulo),
      artista       = COALESCE(${body.artista      ?? null}, artista),
      url_youtube   = COALESCE(${body.url_youtube  ?? null}, url_youtube),
      duracion_seg  = COALESCE(${body.duracion_seg ?? null}, duracion_seg),
      descargada    = COALESCE(${body.descargada   ?? null}, descargada),
      descargada_en = CASE WHEN ${body.descargada === true} THEN NOW() ELSE descargada_en END,
      accion        = ${body.accion ?? null}
    WHERE id = ${id}
    RETURNING *
  `;
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

// DELETE /api/musica/[id]
// Con ?soft=1 solo marca accion='delete' (señal para que el laptop borre el archivo).
// Sin parámetro (por defecto) elimina el registro de la BD.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const soft = req.nextUrl.searchParams.get("soft") === "1";
  if (soft) {
    await sql`UPDATE canciones SET accion = 'delete' WHERE id = ${id}`;
  } else {
    await sql`DELETE FROM canciones WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}
