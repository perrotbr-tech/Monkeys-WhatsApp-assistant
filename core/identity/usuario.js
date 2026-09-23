/**
 * Identidad de usuario y contexto de acceso (E3A).
 * Contratos puros: sin reloj, red, filesystem ni datos demo.
 * userId = identidad global (correo); workspaceId = pertenencia/contexto.
 */

import { resolverParTenantWorkspace, exigirCatalogo } from '../organizations/workspace.js';
import { normalizarRol, permisosDeRol, esPermisoConocido } from '../authorization/rbac.js';

/**
 * Genera un userId estable a partir del correo (sin workspace).
 * Un userId explícito válido se respeta en crearContextoAcceso.
 * @param {{ email: string }} input
 * @returns {string}
 */
export function userIdEstable(input) {
  const email = String(input && input.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    const err = new Error('email_invalido');
    err.code = 'email_invalido';
    throw err;
  }
  const local = email.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `usr_${local}`;
}

/**
 * Construye el contexto activo de acceso (aditivo respecto de la sesión actual).
 * Conserva tenantId, email, nombre y rol; agrega userId y workspaceId.
 * Si llegan tenantId y workspaceId distintos → `workspace_tenant_incoherente`.
 * @param {{
 *   tenantId?: string,
 *   email: string,
 *   nombre?: string,
 *   rol?: string,
 *   workspaceId?: string,
 *   userId?: string,
 *   permisos?: string[],
 * }} usuario
 * @param {import('../organizations/workspace.js').CatalogoWorkspaces} catalogo
 */
export function crearContextoAcceso(usuario, catalogo) {
  exigirCatalogo(catalogo);
  const src = usuario || {};
  const { workspaceId, tenantId } = resolverParTenantWorkspace({
    tenantId: src.tenantId,
    workspaceId: src.workspaceId,
  }, catalogo);
  const email = String(src.email || '').trim().toLowerCase();
  const nombre = String(src.nombre || '').trim();
  const rol = String(src.rol || '').trim();
  const explicit = src.userId != null && String(src.userId).trim() !== ''
    ? String(src.userId).trim()
    : null;
  const userId = explicit || userIdEstable({ email });
  const rolNorm = normalizarRol(rol);
  const explicitosFiltrados = Array.isArray(src.permisos) && src.permisos.length
    ? src.permisos.filter((p) => esPermisoConocido(p))
    : null;
  /** Rol desconocido → sin permisos efectivos (no se legitima con lista explícita). */
  const rolDesconocido = Boolean(rol && String(rol).trim() && !rolNorm);
  const permisos = rolDesconocido
    ? []
    : (explicitosFiltrados && explicitosFiltrados.length
      ? explicitosFiltrados
      : (rolNorm ? permisosDeRol(rolNorm) : []));
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
