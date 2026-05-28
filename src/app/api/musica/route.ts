import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

function authorized(req: NextRequest) {
  return req.headers.get("x-api-key") === process.env.API_KEY;
}

// GET /api/musica
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rows = await sql`
    SELECT * FROM canciones ORDER BY descargada DESC, solicitada_en DESC
  `;
  return NextResponse.json(rows);
}

// POST /api/musica  { busqueda, titulo?, artista? }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  if (!body.busqueda?.trim()) return NextResponse.json({ error: "busqueda requerida" }, { status: 400 });

  // Evitar duplicados por búsqueda
  const [existe] = await sql`SELECT id FROM canciones WHERE busqueda = ${body.busqueda.trim()} LIMIT 1`;
  if (existe) return NextResponse.json({ error: "Ya existe en la biblioteca", id: existe.id }, { status: 409 });

  const [row] = await sql`
    INSERT INTO canciones (busqueda, titulo, artista)
    VALUES (
      ${body.busqueda.trim()},
      ${body.titulo?.trim() || body.busqueda.trim()},
      ${body.artista?.trim() || "Desconocido"}
    )
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}
