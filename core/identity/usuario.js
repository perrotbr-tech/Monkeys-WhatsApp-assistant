/**
 * Identidad de usuario y contexto de acceso (E3A).
 * Contratos puros: sin reloj, red, filesystem ni datos demo.
 */

import { workspaceIdDesdeTenantId } from '../organizations/workspace.js';
import { normalizarRol, permisosDeRol } from '../authorization/rbac.js';

/**
 * Genera un userId estable a partir de workspace y correo.
 * @param {{ workspaceId?: string, tenantId?: string, email: string }} input
 * @returns {string}
 */
export function userIdEstable(input) {
  const workspaceId = input.workspaceId
    || workspaceIdDesdeTenantId(input.tenantId);
  const email = String(input.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    const err = new Error('email_invalido');
    err.code = 'email_invalido';
    throw err;
  }
  const local = email.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `usr_${workspaceId}_${local}`;
}

/**
 * Construye el contexto activo de acceso (aditivo respecto de la sesión actual).
 * Conserva tenantId, email, nombre y rol; agrega userId y workspaceId.
 * @param {{
 *   tenantId: string,
 *   email: string,
 *   nombre: string,
 *   rol: string,
 *   workspaceId?: string,
 *   userId?: string,
 *   permisos?: string[],
 * }} usuario
 * @returns {{
 *   userId: string,
 *   workspaceId: string,
 *   tenantId: string,
 *   email: string,
 *   nombre: string,
 *   rol: string,
 *   permisos: string[],
 * }}
 */
export function crearContextoAcceso(usuario) {
  const tenantId = String(usuario.tenantId || '').trim();
  const workspaceId = usuario.workspaceId || workspaceIdDesdeTenantId(tenantId);
  const email = String(usuario.email || '').trim().toLowerCase();
  const nombre = String(usuario.nombre || '').trim();
  const rol = String(usuario.rol || '').trim();
  const userId = usuario.userId || userIdEstable({ workspaceId, email });
  const rolNorm = normalizarRol(rol);
  const permisos = Array.isArray(usuario.permisos) && usuario.permisos.length
    ? [...usuario.permisos]
    : (rolNorm ? permisosDeRol(rolNorm) : []);
  return {
    userId,
    workspaceId,
    tenantId,
    email,
    nombre,
    rol,
    permisos,
  };
}

/**
 * Vista de sesión compatible (campos existentes + aditivos).
 * @param {ReturnType<typeof crearContextoAcceso>} ctx
 */
export function vistaSesion(ctx) {
  return {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    tenantId: ctx.tenantId,
    email: ctx.email,
    nombre: ctx.nombre,
    rol: ctx.rol,
  };
}
