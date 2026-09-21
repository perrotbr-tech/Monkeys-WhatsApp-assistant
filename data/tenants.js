/**
 * Contrato único de configuración de tenant (E2).
 * Solo datos: sin lógica de negocio ni Bifurcaciones por marca.
 *
 * Campos mínimos:
 * - tenantId / id estable, slug público, nombre visible
 * - idioma, zonaHoraria, identidad visual (marca)
 * - codigoPrefix, sedes[{id,nombre}], planes vía demo/slice
 * - menu, capacidades, textosBot, aliasHistoricos
 */

/** @typedef {{ etiqueta: string, valor: string }} MenuOpcion */

/**
 * @typedef {object} SedeConfig
 * @property {string} id
 * @property {string} nombre
 * @property {string} [direccion]
 * @property {string[]} [alias] nombres históricos aceptados en lectura
 */

/**
 * @typedef {object} CapacidadesTenant
 * @property {boolean} cuposPorPlan
 * @property {boolean} clasePruebaGratis
 * @property {boolean} emojiReserva
 * @property {string} etiquetaReservar
 * @property {string} textoTrialNombre
 * @property {string} [prefijoSocioId]
 * @property {string[]} servicios
 */

/**
 * @typedef {object} AliasHistoricos
 * @property {string[]} localStorageKeys
 * @property {Record<string, string>} sedes  nombre histórico → sedeId
 */

/**
 * @typedef {object} TenantConfig
 * @property {string} id
 * @property {string} slug
 * @property {string} nombre
 * @property {string} pais
 * @property {string} moneda
 * @property {string} zonaHoraria
 * @property {string} idioma
 * @property {string} codigoPrefix
 * @property {boolean} demo
 * @property {boolean} activo
 * @property {object} marca
 * @property {object} textosBot
 * @property {string} datosBancarios
 * @property {SedeConfig[]} sedes
 * @property {MenuOpcion[]} menu
 * @property {CapacidadesTenant} capacidades
 * @property {AliasHistoricos} aliasHistoricos
 */

const MENU_BASE = Object.freeze([
  { etiqueta: 'Ver clases', valor: 'ver clases' },
  { etiqueta: 'Reservar mi cupo', valor: 'reservar mi cupo' },
  { etiqueta: 'Probar una clase', valor: 'probar una clase' },
  { etiqueta: 'Ver planes', valor: 'ver planes' },
  { etiqueta: 'Consultar reserva', valor: 'consultar' },
  { etiqueta: 'Hablar con equipo', valor: 'hablar con el equipo' },
]);

/** @type {TenantConfig[]} */
const TENANTS_BASE = [
  {
    id: 'monkeys',
    slug: 'monkeys',
    nombre: 'MONKEYS',
    pais: 'CL',
    moneda: 'CLP',
    zonaHoraria: 'America/Santiago',
    idioma: 'es-CL',
    codigoPrefix: 'GYM',
    demo: true,
    activo: true,
    marca: {
      colorFondo: '#0B0B0B',
      colorSuperficie: '#161616',
      colorPanel: '#222222',
      colorAcento: '#F5B400',
      colorAcentoSecundario: '#F5B400',
      colorTexto: '#FFFFFF',
      colorTextoMuted: '#9A9A9A',
      colorOnAcento: '#0B0B0B',
      wordmark: 'MONKEYS',
      bajada: 'FITNESS COMMUNITY',
      logoTexto: 'MONKEYS',
      wordmarkItalic: false,
      letterSpacing: '0.12em',
      fontWeight: '900',
    },
    textosBot: {
      bienvenida: '¡Hola! 👋 Bienvenido a MONKEYS. ¿En qué sede quieres entrenar?',
      despedida: 'Gracias por escribirnos. Te esperamos en la comunidad.',
      disclaimer: 'Prototipo demostrativo · datos ficticios',
      lookupEjemplo: 'GYM-2026-0001',
    },
    datosBancarios: 'Transferencia (ficticia, demo): Banco Estado · Chequera electrónica · 00000001 · RUT 76.111.111-1 · MONKEYS SpA. Prototipo demostrativo.',
    sedes: [
      { id: 'felix-garcia', nombre: 'Félix García', direccion: 'Antofagasta', alias: ['Félix García', 'Felix Garcia'] },
      { id: 'alta-vista', nombre: 'Alta Vista', direccion: 'Antofagasta', alias: ['Alta Vista'] },
    ],
    menu: MENU_BASE.map((o) => ({ ...o })),
    capacidades: {
      cuposPorPlan: false,
      clasePruebaGratis: true,
      emojiReserva: true,
      etiquetaReservar: '📅 Reservar',
      textoTrialNombre: 'Clase de prueba GRATIS. ¿Cuál es tu nombre?',
      prefijoSocioId: 's',
      servicios: ['clases', 'reservas', 'trial', 'planes', 'membresia', 'pago'],
    },
    aliasHistoricos: {
      localStorageKeys: ['monkeys_demo_state'],
      sedes: {
        'Félix García': 'felix-garcia',
        'Felix Garcia': 'felix-garcia',
        'Alta Vista': 'alta-vista',
      },
    },
  },
  {
    id: 'soma',
    slug: 'soma',
    nombre: 'SOMA Gym',
    pais: 'CL',
    moneda: 'CLP',
    zonaHoraria: 'America/Santiago',
    idioma: 'es-CL',
    codigoPrefix: 'SOMA',
    demo: true,
    activo: true,
    marca: {
      colorFondo: '#0E0E0E',
      colorSuperficie: '#1A1917',
      colorPanel: '#242220',
      colorAcento: '#8C8672',
      colorAcentoSecundario: '#C9A96E',
      colorTexto: '#F2EFE9',
      colorTextoMuted: '#A39E94',
      colorOnAcento: '#0E0E0E',
      wordmark: 'SOMA',
      bajada: 'Entrena eficiente',
      logoTexto: 'SOMA',
      wordmarkItalic: true,
      letterSpacing: '4px',
      fontWeight: '800',
    },
    textosBot: {
      bienvenida: 'Hola, soy el asistente de SOMA. Te ayudo con horarios, planes, reservas y clase de prueba. ¿Qué necesitas?',
      despedida: 'Gracias. Te esperamos en SOMA Antofagasta.',
      disclaimer: 'Prototipo demostrativo · datos ficticios',
      lookupEjemplo: 'SOMA-2026-0001',
      valoresPlanes: 'Valores según planes publicados · sujetos a cambio',
    },
    datosBancarios: 'Transferencia (ficticia, demo): Banco de Chile · Cuenta corriente · 00000002 · RUT 76.222.222-2 · SOMA Gym SpA. Prototipo demostrativo.',
    sedes: [
      {
        id: 'soma-antofagasta',
        nombre: 'SOMA Antofagasta',
        direccion: 'Av. Jaime Guzmán 04050, Antofagasta',
        alias: ['SOMA Antofagasta', 'SOMA', 'Antofagasta'],
      },
    ],
    menu: MENU_BASE.map((o) => ({ ...o })),
    capacidades: {
      cuposPorPlan: true,
      clasePruebaGratis: false,
      emojiReserva: false,
      etiquetaReservar: 'Reservar',
      textoTrialNombre: 'Clase de prueba. ¿Cuál es tu nombre?',
      prefijoSocioId: 'sm',
      servicios: ['clases', 'reservas', 'trial', 'planes', 'membresia', 'pago', 'kinesiologia', 'musculacion'],
    },
    aliasHistoricos: {
      localStorageKeys: [],
      sedes: {
        'SOMA Antofagasta': 'soma-antofagasta',
        SOMA: 'soma-antofagasta',
        Antofagasta: 'soma-antofagasta',
      },
    },
  },
];

/** Catálogo mutable: permite registrar tenants de prueba sin tocar motor/servidor. */
const catalogo = TENANTS_BASE.map(clonarTenant);

export const TENANT_DEFAULT = 'monkeys';

function clonarTenant(t) {
  return {
    ...t,
    marca: { ...t.marca },
    textosBot: { ...t.textosBot },
    sedes: (t.sedes || []).map((s) => ({ ...s, alias: [...(s.alias || [])] })),
    menu: (t.menu || []).map((o) => ({ ...o })),
    capacidades: { ...(t.capacidades || {}) },
    aliasHistoricos: {
      localStorageKeys: [...((t.aliasHistoricos && t.aliasHistoricos.localStorageKeys) || [])],
      sedes: { ...((t.aliasHistoricos && t.aliasHistoricos.sedes) || {}) },
    },
  };
}

export function listarTenants() {
  return catalogo.map(clonarTenant);
}

export function idsTenantsActivos() {
  return catalogo.filter((t) => t.activo).map((t) => t.id);
}

export function buscarTenant(slug) {
  const key = String(slug || '').trim().toLowerCase();
  return catalogo.find((t) => t.slug === key || t.id === key) || null;
}

export function tenantActivo(slug) {
  const t = buscarTenant(slug);
  return t && t.activo ? clonarTenant(t) : null;
}

/**
 * Registra o reemplaza un tenant en el catálogo (solo configuración).
 * @param {TenantConfig} config
 */
export function registrarTenant(config) {
  if (!config || !config.id || !config.slug) {
    throw new Error('registrarTenant_requires_id_slug');
  }
  const row = clonarTenant({
    demo: false,
    activo: true,
    pais: 'CL',
    moneda: 'CLP',
    zonaHoraria: 'America/Santiago',
    idioma: 'es-CL',
    codigoPrefix: String(config.id).toUpperCase(),
    marca: {},
    textosBot: {},
    datosBancarios: '',
    sedes: [],
    menu: MENU_BASE.map((o) => ({ ...o })),
    capacidades: {
      cuposPorPlan: false,
      clasePruebaGratis: true,
      emojiReserva: false,
      etiquetaReservar: 'Reservar',
      textoTrialNombre: 'Clase de prueba. ¿Cuál es tu nombre?',
      prefijoSocioId: 'x',
      servicios: ['clases', 'reservas', 'planes'],
    },
    aliasHistoricos: { localStorageKeys: [], sedes: {} },
    ...config,
  });
  const idx = catalogo.findIndex((t) => t.id === row.id);
  if (idx >= 0) catalogo[idx] = row;
  else catalogo.push(row);
  return clonarTenant(row);
}

/** Restaura el catálogo demo (útil en pruebas). */
export function resetCatalogoTenants() {
  catalogo.length = 0;
  for (const t of TENANTS_BASE) catalogo.push(clonarTenant(t));
}

/**
 * Resuelve sedeId estable desde id, nombre o alias histórico.
 * @param {TenantConfig|null} tenant
 * @param {string|null|undefined} valor
 * @returns {string|null}
 */
export function resolverSedeId(tenant, valor) {
  if (valor == null || valor === '') return null;
  const raw = String(valor).trim();
  if (!tenant) return raw;
  const sedes = tenant.sedes || [];
  const byId = sedes.find((s) => s.id === raw);
  if (byId) return byId.id;
  const lower = raw.toLowerCase();
  const byNombre = sedes.find((s) => s.nombre === raw
    || String(s.nombre).toLowerCase() === lower
    || (s.alias || []).some((a) => a === raw || String(a).toLowerCase() === lower));
  if (byNombre) return byNombre.id;
  const hist = tenant.aliasHistoricos && tenant.aliasHistoricos.sedes;
  if (hist && hist[raw]) return hist[raw];
  const histHit = hist && Object.entries(hist).find(([k]) => k.toLowerCase() === lower);
  if (histHit) return histHit[1];
  return null;
}

/**
 * Nombre visible de una sede (desde id o alias).
 * @param {TenantConfig|null} tenant
 * @param {string|null|undefined} valor
 * @returns {string}
 */
export function nombreSede(tenant, valor) {
  const id = resolverSedeId(tenant, valor) || valor;
  if (!tenant || !id) return valor == null ? '' : String(valor);
  const sede = (tenant.sedes || []).find((s) => s.id === id);
  return sede ? sede.nombre : String(valor);
}

/**
 * Compara dos referencias de sede (id o nombre) del mismo tenant.
 */
export function mismaSede(tenant, a, b) {
  const idA = resolverSedeId(tenant, a);
  const idB = resolverSedeId(tenant, b);
  if (idA && idB) return idA === idB;
  return String(a || '') === String(b || '');
}

export function capacidadesDe(tenant) {
  const c = (tenant && tenant.capacidades) || {};
  return {
    cuposPorPlan: !!c.cuposPorPlan,
    clasePruebaGratis: c.clasePruebaGratis !== false,
    emojiReserva: !!c.emojiReserva,
    etiquetaReservar: c.etiquetaReservar || 'Reservar',
    textoTrialNombre: c.textoTrialNombre || 'Clase de prueba. ¿Cuál es tu nombre?',
    prefijoSocioId: c.prefijoSocioId || 's',
    servicios: Array.isArray(c.servicios) ? [...c.servicios] : [],
  };
}

export function menuDe(tenant) {
  const m = tenant && Array.isArray(tenant.menu) && tenant.menu.length
    ? tenant.menu
    : MENU_BASE;
  return m.map((o) => ({ ...o }));
}

export function varsMarca(marca) {
  const m = marca || {};
  return {
    '--color-fondo': m.colorFondo,
    '--color-superficie': m.colorSuperficie,
    '--color-panel': m.colorPanel,
    '--color-acento': m.colorAcento,
    '--color-acento-2': m.colorAcentoSecundario,
    '--color-texto': m.colorTexto,
    '--color-texto-muted': m.colorTextoMuted,
    '--color-on-acento': m.colorOnAcento,
    '--wordmark-spacing': m.letterSpacing || '0.12em',
    '--wordmark-weight': m.fontWeight || '900',
  };
}

export const USUARIOS_DEMO = [
  { tenantId: 'monkeys', email: 'dueno@monkeys.demo', nombre: 'Dueña demo', rol: 'dueño' },
  { tenantId: 'soma', email: 'dueno@soma.demo', nombre: 'Dueña demo', rol: 'dueño' },
  { tenantId: 'soma', email: 'coach@soma.demo', nombre: 'Coach demo', rol: 'coach' },
];

export const CLAVE_DEMO = 'demo1234';

export { MENU_BASE };
