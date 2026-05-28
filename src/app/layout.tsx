import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mis Tareas — Asistente de Voz",
  description: "Recordatorios y tareas para el asistente de voz",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
