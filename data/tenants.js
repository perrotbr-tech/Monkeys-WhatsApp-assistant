/** Configuración de tenants demo. Textos visibles al usuario viven aquí. */

export const TENANT_DEFAULT = 'monkeys';

export const tenants = [
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
    sedes: [
      { id: 'felix-garcia', nombre: 'Félix García', direccion: 'Antofagasta' },
      { id: 'alta-vista', nombre: 'Alta Vista', direccion: 'Antofagasta' },
    ],
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
    },
    sedes: [
      {
        id: 'soma-antofagasta',
        nombre: 'SOMA Antofagasta',
        direccion: 'Av. Jaime Guzmán 04050, Antofagasta',
      },
    ],
  },
];

export function listarTenants() {
  return tenants.map((t) => ({ ...t, marca: { ...t.marca }, textosBot: { ...t.textosBot }, sedes: t.sedes.map((s) => ({ ...s })) }));
}

export function buscarTenant(slug) {
  const key = String(slug || '').trim().toLowerCase();
  return tenants.find((t) => t.slug === key || t.id === key) || null;
}

export function tenantActivo(slug) {
  const t = buscarTenant(slug);
  return t && t.activo ? t : null;
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
