# FORKZA AI — demo multi-gimnasio

Plataforma **FORKZA AI** (Perrot Tech) para gimnasios: asistente conversacional, reservas y automatizaciones.
Primeros tenants demo: **MONKEYS** y **SOMA Gym** (Antofagasta, Chile).
Datos, horarios y precios son **demostrativos**. No hay integración oficial activa.

## Multi-gimnasio (demo)

El mismo despliegue sirve a dos gimnasios, sin mezclar datos.

| | MONKEYS | SOMA |
|---|---|---|
| URL | `?t=monkeys` (default) | `?t=soma` |
| Marca | negro / amarillo | taupe / madera |
| Código de reserva | `GYM-2026-NNNN` | `SOMA-2026-NNNN` |

Usuarios demo del equipo (clave `demo1234`):

- `dueno@monkeys.demo`
- `dueno@soma.demo`
- `coach@soma.demo`

El asistente (`#asistente`) es público. `#dashboard` y `#automatizaciones` piden login. En GitHub Pages el login es simulado (modo demostración).

API: header `X-Tenant` (default `monkeys`). `GET /api/tenants/:slug/theme` entrega la marca.

## Arquitectura híbrida

- **IA demo** (`engine/intent.js`): interpreta lenguaje natural en local, sin LLM ni API keys.
- **Bot determinístico** (`engine/conversation.js` + `engine/store.js`): clases, cupos, reservas, leads. Toda función del store recibe `tenantId` primero.
- **WhatsApp**: canal futuro. Solo queda la interfaz `MessageChannel` documentada en el engine.
- **Humano**: derivación a `waiting_human` / `tarea_equipo`, visible en el dashboard.

La IA no inventa cupos, horarios ni precios, y no confirma reservas.

## Stack

Node 20 + Express. JavaScript ES modules. Sin bundler. Frontend estático: `index.html`, `app.js`, `styles.css`. Dependencia extra: `bcryptjs` (login demo).

## Modo standalone (GitHub Pages)

Si `GET ./api/health` no responde en 1,5 s, el mismo engine corre en el navegador con `localStorage` (`forkza_demo_state_<slug>`). Rutas relativas `./`. Incluye `.nojekyll`. El último tenant queda en `forkza_tenant`.

## Uso

```bash
npm install
npm test
npm start
```

Abre http://localhost:3000 o http://localhost:3000?t=soma

- Chat: `#asistente`
- Login equipo: `#login`
- Dashboard: `#dashboard`
- Automatizaciones: `#automatizaciones`

## Recorridos

- **A** Félix García → Reservar → Spinning → confirmar → código GYM-2026-XXXX
- **B** Alta Vista → Clase de prueba GRATIS → lead en dashboard
- **C** "Hola, quiero probar el gimnasio" → flujo trial (badge IA)
- **D** "quiero hablar con alguien" → atención pendiente
- **E** Abrir `index.html` sin backend (`npx serve .`) → mismos flujos en localStorage, con `?t=monkeys` o `?t=soma`
- **F** Login `dueno@soma.demo` → Dashboard → AUTOMATIZACIONES → Ejecutar ciclo mensual (demo) → acciones con nombres de SOMA
- **G** SOMA: horarios, planes, reservar Crosstraining 18:00 → `SOMA-2026-0001`; preguntar Kinesiología → deriva al equipo; Musculación → acceso libre sin reserva

## Automatizaciones

Base compartida para los agentes del gimnasio. Cada agente es un módulo con la misma firma:

`evaluar(contexto, fechaRef) → acciones[]`

El motor (`engine/automation.js`) recorre los agentes activos, guarda como máximo una campaña por día (si se vuelve a ejecutar el mismo día, la reemplaza) y escribe en una sola tabla de acciones. El modelo de acción es común: `mensaje` o `tarea_equipo`, con `agente`, `socioId`, `prioridad` y `estado`.

Agentes demo: **Retención** (completo) más avisos mínimos de cobranza, reactivación, recordatorio y referidos para mostrar el ciclo en ambos tenants.

### Retención

Clasifica socios activos con esta prioridad: silencioso (0 visitas en 21 días) → riesgo (≤3 visitas en 30 días o caída ≤ −50 % vs. el mes anterior) → constante (≥8 visitas) → regular.

- Constante: mensaje (racha + invitar a un amigo).
- Regular: sin acción.
- Riesgo: mensaje (motivación + próximo horario de su clase favorita).
- Silencioso: `tarea_equipo` de prioridad alta, sin mensaje.

Indicadores de la card: **Socios en riesgo** y **Recuperados este mes** (estaban en riesgo en la campaña anterior y hoy tienen ≥4 visitas en 30 días).

Textos salen de plantillas en `data/templates.js`. El texto generado no puede contener `{` `}`, ni la palabra "promo", ni `$` (salvo cobranza). Los montos nunca se inventan: salen de los datos.

API (sesión de equipo): `POST /api/automation/run` · `GET /api/automation/summary` · `GET /api/automation/actions?agente=&sede=` · `POST /api/automation/actions/:id/estado`. El reset restaura socios, asistencias y la campaña inicial. `StoreLocal` replica la misma lógica en el navegador.

### Integración real

Las asistencias entran hoy por datos demo. En producción el motor las lee a través de un adaptador `AttendanceSource`: una API o una exportación del software de control de acceso del gimnasio. El canal de envío sigue siendo `MessageChannel` (WhatsApp en una etapa posterior). El prototipo no habla con sistemas reales.
