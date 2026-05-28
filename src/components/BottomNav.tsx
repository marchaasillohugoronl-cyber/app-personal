"use client";
import Link from "next/link";

const NAV = [
  { id: "tareas" as const, href: "/",       icon: "📝", label: "Tareas" },
  { id: "musica" as const, href: "/musica", icon: "🎵", label: "Música" },
];

export function BottomNav({ active }: { active: "tareas" | "musica" }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur-xl border-t border-gray-800/60 max-w-lg mx-auto">
      <div className="flex">
        {NAV.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
              active === item.id
                ? "text-green-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
