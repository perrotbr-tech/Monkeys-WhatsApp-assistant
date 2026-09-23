# FORKZA AI — demo multi-gimnasio

Plataforma **FORKZA AI** (Perrot Tech) para gimnasios: asistente conversacional, reservas y automatizaciones.
Primeros tenants demo: **MONKEYS** y **SOMA Gym** (Antofagasta, Chile).
Datos y horarios son **demostrativos**. Los planes de SOMA usan valores publicados (sujetos a cambio). No hay integración oficial activa.

## Multi-gimnasio (demo)

El mismo despliegue sirve a varios gimnasios vía configuración de tenant, sin mezclar datos. MONKEYS y SOMA son tenants demo; el selector y los motores se construyen recorriendo el catálogo.

| | MONKEYS | SOMA |
|---|---|---|
| URL | `?t=monkeys` (default) | `?t=soma` |
| `tenantId` estable | `monkeys` | `soma` |
| Marca | negro / amarillo (config) | taupe / madera (config) |
| Código de reserva | `GYM-YYYY-NNNN` | `SOMA-YYYY-NNNN` |
| Sedes (ids) | `felix-garcia`, `alta-vista` | `soma-antofagasta` |

Persistencia: Snapshot V3 (`schemaVersion: 3`, `byWorkspace`). Clave localStorage `forkza_demo_state_<tenantId>` (legacy `monkeys_demo_state` solo migración histórica).

Usuarios demo del equipo (clave `demo1234`):

- `dueno@monkeys.demo` / `dueno@soma.demo` (propietario)
- `recepcion@monkeys.demo`, `ventas@monkeys.demo`, `coach@monkeys.demo`, `alumno@monkeys.demo`
- `coach@soma.demo`

El asistente (`#asistente`) es público. Vistas de Gestión piden login y respetan permisos RBAC (servidor = autoridad). En GitHub Pages el login es simulado (modo demostración).

API: header `X-Tenant` (default `monkeys`). `GET /api/tenants/:slug/theme` entrega la marca.

La fecha de referencia es la del día (zona `America/Santiago`). Para tests y capturas se puede fijar con `?fecha=YYYY-MM-DD`. “Hoy” y “Mañana” salen de esa fecha. Asistencias y campañas demo se generan sobre los últimos 60 días.

Brand: `favicon`, sello del chat, símbolo FORKZA e iconos PWA salen de `/brand` (archivos oficiales). No se regeneran.

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

## Demo Forja Training (validación)

Prototipo estático aislado en `forja-demo/` para entrevistar a un coach de Powerlifting. Entrada: `forja-demo/index.html` (GitHub Pages: `/Monkeys-WhatsApp-assistant/forja-demo/`). Datos ficticios, estado en `localStorage` (`forja-demo-v1`, documento v2 con Finanzas), botón «Restablecer demo». Incluye sección **Finanzas** demo (KPIs CLP, cargos/pagos; sin bancos ni cobros reales). **No es Forja Training productivo**; no inicia E4/E5 ni se conecta a la navegación de Forkza Gestión.

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
- Socios: `#socios`
- Pagos: `#pagos`
- Automatizaciones: `#automatizaciones`
- Pago demo: `#pago/<referencia>`

## Recorridos

- **A** Félix García → Reservar → Spinning → confirmar → código GYM-2026-XXXX
- **B** Alta Vista → Clase de prueba GRATIS → lead en dashboard
- **C** "Hola, quiero probar el gimnasio" → flujo trial (badge IA)
- **D** "quiero hablar con alguien" → atención pendiente
- **E** Abrir `index.html` sin backend (`npx serve .`) → mismos flujos en localStorage, con `?t=monkeys` o `?t=soma`
- **F** Login `dueno@soma.demo` → Dashboard → AUTOMATIZACIONES → Ejecutar ciclo mensual (demo) → acciones con nombres de SOMA
- **G** SOMA: Ver clases pregunta día (Hoy · Mañana · Otro día) y disciplina; lista corto de ese cruce (máx. 6 líneas). Ver planes agrupa por familia (CrossTraining · Small Group · HappyFLEX · Kids · Pases), de a 4, con el rótulo de valores publicados. Reservar Crosstraining 18:00 → `SOMA-YYYY-0001`; preguntar Kinesiología → deriva al equipo; Musculación → acceso libre sin reserva
- **H** SOMA: socio con plan reserva y el bot dice “Te quedan X cupos este mes”. Si agotó el mes, rechaza y crea `tarea_equipo` (motivo cupos agotados), sin precios ni upgrade. “¿Cuántos cupos me quedan?” responde restantes y que se renuevan el 1 de cada mes. MONKEYS no aplica cupos por plan.
- **I** Reserva WhatsApp: disciplina → Hoy/Mañana/Otro día → horarios de ese cruce (≤ 10). Nunca una lista de toda la semana. El simulador pinta botones (≤ 3) o lista (4–10).
- **J** Login → `#socios` → importar CSV → ficha → `#pagos` marcar transferencia o Enviar link → `#pago/<ref>` Pagar (demo) → chat “mi membresía” / “pagar”.

## Socios y pagos

El equipo (sesión) administra socios y cuotas. El chat `mi_membresia` y `pagar` no piden login: identifican al socio por teléfono E.164.

- **Socios** (`#socios`): búsqueda, filtros (sede, plan, estado, vence en 7 días), ficha, alta/edición, baja con motivo, reactivación, importación CSV (plantilla descargable). No se duplica por teléfono.
- **Membresía**: `{tenantId, socioId, planId, inicio, fin, estado: vigente | vencida | pausada}`. Al registrar un pago se crea o se extiende según `periodo` del plan (mensual 30 días, trimestral 90, anual 365, pase 1 día). El monto sale siempre del plan.
- **Pagos** (`#pagos`): pendiente, pagada, vencida, rechazada. Marcar pagado (transferencia con referencia), enviar link, exportar CSV del mes. Conciliación: esperado = pagado + pendiente + vencido.
- **Proveedores** (`engine/services/pagos.js`, interfaz `PaymentProvider`):
  - `TransferenciaManual`: cuota pendiente con datos bancarios del tenant (texto de config; en demo, ficticios y rotulados).
  - `LinkPagoDemo`: URL local `#pago/<referencia>` con botón “Pagar (demo)”.
  - `MercadoPagoProvider`: Checkout Pro (preferencia → `init_point`, webhook → estado). Lee `MERCADOPAGO_ACCESS_TOKEN` (y opcional `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`). Si no hay token, el tenant usa `LinkPagoDemo` y el panel muestra **Pasarela en modo demostración**. Los tests no llaman a Mercado Pago: el cliente HTTP se inyecta y se mockea.
- Cobranza toma membresías que vencen en ≤ 7 días (y pagos rechazados). Reactivación toma vencidas > 15 días y socios en baja.

## Automatizaciones

Base compartida para los agentes del gimnasio. Cada agente es un módulo con la misma firma:

`evaluar(contexto, fechaRef) → acciones[]`

El motor (`engine/automation.js`) recorre los agentes activos, guarda como máximo una campaña por día (si se vuelve a ejecutar el mismo día, la reemplaza) y escribe en una sola tabla de acciones. El modelo de acción es común: `mensaje` o `tarea_equipo`, con `agente`, `socioId`, `prioridad` y `estado`.

Agentes demo: **Retención** (completo) más avisos mínimos de cobranza, reactivación, recordatorio y referidos. En `#automatizaciones` hay una card por agente: Retención con socios en riesgo / recuperados; los otros cuatro con el conteo de acciones del último ciclo y el texto del aviso.

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
