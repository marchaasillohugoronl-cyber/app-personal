import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

function authorized(req: NextRequest): boolean {
  return req.headers.get("x-api-key") === process.env.API_KEY;
}

// PATCH /api/tasks/[id]  { completada?, titulo?, descripcion?, fecha_limite?, prioridad? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json();

  const [row] = await sql`
    UPDATE tareas SET
      titulo       = COALESCE(${body.titulo       ?? null}, titulo),
      descripcion  = COALESCE(${body.descripcion  ?? null}, descripcion),
      fecha_limite = CASE WHEN ${body.fecha_limite !== undefined} THEN ${body.fecha_limite ?? null} ELSE fecha_limite END,
      prioridad    = COALESCE(${body.prioridad    ?? null}, prioridad),
      completada   = COALESCE(${body.completada   ?? null}, completada)
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

// DELETE /api/tasks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  await sql`DELETE FROM tareas WHERE id = ${id}`;
  return new NextResponse(null, { status: 204 });
}
