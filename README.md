# App Web — Tareas y Recordatorios

Aplicación móvil para agregar tareas y recordatorios que el asistente de voz leerá al encender la laptop.

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · PostgreSQL (Neon) · Vercel

---

## Deploy en 5 pasos

### 1. Crear base de datos en Neon (gratis)

1. Ir a [neon.tech](https://neon.tech) → crear cuenta → **New Project**
2. Nombre: `asistente-voz` → **Create Project**
3. Copiar la **Connection String** (empieza con `postgresql://...`)
4. Ir a **SQL Editor** → pegar y ejecutar el contenido de [schema.sql](schema.sql)

### 2. Subir el código a GitHub

Desde la raíz del repositorio principal:

```bash
git add app-web/
git commit -m "feat: app web de tareas"
git push
```

### 3. Desplegar en Vercel (gratis)

1. Ir a [vercel.com](https://vercel.com) → **Add New Project** → importar tu repo
2. En **Root Directory** escribir: `app-web`
3. Agregar estas **Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La connection string de Neon |
   | `API_KEY` | Una clave segura (ver abajo cómo generarla) |

4. Click en **Deploy** — en ~1 minuto tendrás la URL

**Generar una clave segura:**
```bash
# Linux / macOS
openssl rand -hex 32

# Windows PowerShell
[System.Web.Security.Membership]::GeneratePassword(40, 5)
```

### 4. Configurar el asistente local

Crear el archivo `.env` en la raíz del proyecto (junto a `main.py`):

```bash
# Linux / macOS
cp .env.example .env
nano .env   # o el editor que prefieras
```

```env
RECORDATORIOS_URL=https://tu-app.vercel.app
RECORDATORIOS_KEY=la-misma-clave-que-pusiste-en-vercel
```

```bash
# Windows — editar con Notepad
copy .env.example .env
notepad .env
```

### 5. Probar

```bash
python -c "from comandos.recordatorios import listar_pendientes; print(listar_pendientes())"
```

Si responde `"No tienes tareas pendientes. ¡Todo al día!"` está funcionando.

---

## Uso desde el celular

1. Abrir la URL de Vercel en el navegador del celular
2. Ingresar la API Key cuando la pida (se guarda en el navegador)
3. Agregar tareas con el formulario

La próxima vez que enciendas la laptop, el asistente dirá automáticamente qué tienes pendiente.

**Comandos de voz disponibles:**

| Frase | Acción |
|---|---|
| "qué tareas tengo" | Lista todas las pendientes con fecha |
| "mis recordatorios" | Ídem |
| "qué actividades tengo" | Ídem |
| "qué tengo pendiente" | Ídem |
| "qué hay para hoy" | Ídem |

---

## Desarrollo local

```bash
cd app-web
cp .env.example .env.local   # poner DATABASE_URL y API_KEY
npm install
npm run dev
# Abrir http://localhost:3000
```

---

## Estructura de la API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/tasks` | Listar tareas (`?completed=false` solo pendientes) |
| `POST` | `/api/tasks` | Crear tarea |
| `PATCH` | `/api/tasks/:id` | Actualizar / marcar completa |
| `DELETE` | `/api/tasks/:id` | Eliminar |

Todas las rutas requieren el header `x-api-key: <tu-clave>`.

**Ejemplo con curl:**
```bash
# Listar pendientes
curl https://tu-app.vercel.app/api/tasks?completed=false \
  -H "x-api-key: tu-clave"

# Crear tarea
curl -X POST https://tu-app.vercel.app/api/tasks \
  -H "x-api-key: tu-clave" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Estudiar para el examen","fecha_limite":"2026-05-28T18:00:00","prioridad":"alta"}'
```
# app-personal
