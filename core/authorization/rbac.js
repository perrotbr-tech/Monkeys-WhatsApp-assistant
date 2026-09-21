/**
 * Autorización por roles y permisos explícitos (E3A).
 * No depende de nombres MONKEYS/SOMA. Deniega por defecto lo desconocido.
 * E3A define y prueba el contrato; la aplicación total en rutas es E3C.
 */

/** Roles canónicos admitidos (actuales + futuros). */
export const ROLES_CANONICOS = Object.freeze([
  'propietario',
  'administrador',
  'recepcion',
  'ventas',
  'entrenador',
  'alumno',
]);

/** Alias de roles legacy → canónico. */
const ALIAS_ROL = Object.freeze({
  dueño: 'propietario',
  dueno: 'propietario',
  propietario: 'propietario',
  administrador: 'administrador',
  admin: 'administrador',
  recepcion: 'recepcion',
  recepción: 'recepcion',
  ventas: 'ventas',
  coach: 'entrenador',
  entrenador: 'entrenador',
  alumno: 'alumno',
});

/** Catálogo de permisos conocidos. */
export const PERMISOS_CONOCIDOS = Object.freeze([
  'gestion:acceso',
  'gestion:socios:leer',
  'gestion:socios:escribir',
  'gestion:pagos:leer',
  'gestion:pagos:escribir',
  'gestion:automatizacion',
  'gestion:panel',
  'forja:acceso',
  'forja:programar',
  'forja:ejecutar',
]);

const SET_PERMISOS = new Set(PERMISOS_CONOCIDOS);

/** Permisos por rol canónico. */
const PERMISOS_POR_ROL = Object.freeze({
  propietario: [
    'gestion:acceso',
    'gestion:socios:leer',
    'gestion:socios:escribir',
    'gestion:pagos:leer',
    'gestion:pagos:escribir',
    'gestion:automatizacion',
    'gestion:panel',
  ],
  administrador: [
    'gestion:acceso',
    'gestion:socios:leer',
    'gestion:socios:escribir',
    'gestion:pagos:leer',
    'gestion:pagos:escribir',
    'gestion:automatizacion',
    'gestion:panel',
  ],
  recepcion: [
    'gestion:acceso',
    'gestion:socios:leer',
    'gestion:socios:escribir',
    'gestion:panel',
  ],
  ventas: [
    'gestion:acceso',
    'gestion:socios:leer',
    'gestion:pagos:leer',
    'gestion:panel',
  ],
  entrenador: [
    'gestion:acceso',
    'gestion:socios:leer',
    'gestion:panel',
    'forja:acceso',
    'forja:programar',
  ],
  alumno: [
    'forja:acceso',
    'forja:ejecutar',
  ],
});

/**
 * @param {string} rol
 * @returns {string|null} rol canónico o null si desconocido
 */
export function normalizarRol(rol) {
  const key = String(rol || '').trim().toLowerCase();
  if (!key) return null;
  return ALIAS_ROL[key] || null;
}

/**
 * @param {string} rolCanonico
 * @returns {string[]}
 */
export function permisosDeRol(rolCanonico) {
  const lista = PERMISOS_POR_ROL[rolCanonico];
  return lista ? [...lista] : [];
}

/**
 * @param {string} permiso
 * @returns {boolean}
 */
export function esPermisoConocido(permiso) {
  return SET_PERMISOS.has(String(permiso || ''));
}

/**
 * Evalúa si el contexto tiene un permiso.
 * Rol desconocido → denegado. Permiso desconocido → denegado.
 * Permisos explícitos del contexto se evalúan si están en el catálogo.
 * @param {{ rol?: string, permisos?: string[] }} contexto
 * @param {string} permiso
 * @returns {boolean}
 */
export function tienePermiso(contexto, permiso) {
  const p = String(permiso || '');
  if (!esPermisoConocido(p)) return false;

  const explicitos = Array.isArray(contexto && contexto.permisos)
    ? contexto.permisos
    : null;

  if (explicitos) {
    return explicitos.includes(p);
  }

  const rol = normalizarRol(contexto && contexto.rol);
  if (!rol) return false;
  return permisosDeRol(rol).includes(p);
}

/**
 * @param {{ rol?: string, permisos?: string[] }} contexto
 * @param {string} permiso
 * @returns {boolean}
 */
export function denegarSiNoTiene(contexto, permiso) {
  return !tienePermiso(contexto, permiso);
}
