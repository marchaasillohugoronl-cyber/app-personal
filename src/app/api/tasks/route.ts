import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { TareaInput } from "@/types/task";

function authorized(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  return key === process.env.API_KEY;
}

// GET /api/tasks?completed=false
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const soloP = searchParams.get("completed");

  const rows =
    soloP === "false"
      ? await sql`SELECT * FROM tareas WHERE completada = false ORDER BY fecha_limite ASC NULLS LAST, creada_en ASC`
      : await sql`SELECT * FROM tareas ORDER BY completada ASC, fecha_limite ASC NULLS LAST, creada_en ASC`;

  return NextResponse.json(rows);
}

// POST /api/tasks  { titulo, descripcion?, fecha_limite?, prioridad? }
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body: TareaInput = await req.json();
  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO tareas (titulo, descripcion, fecha_limite, prioridad)
    VALUES (
      ${body.titulo.trim()},
      ${body.descripcion?.trim() || null},
      ${body.fecha_limite || null},
      ${body.prioridad || "normal"}
    )
    RETURNING *
  `;

  return NextResponse.json(row, { status: 201 });
}
