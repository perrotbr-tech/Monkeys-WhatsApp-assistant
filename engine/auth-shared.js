/**
 * Autenticación compartida compatible con navegador (demo standalone / GitHub Pages).
 * Sin node:crypto, bcryptjs ni IO de servidor.
 */

import { catalogoWorkspaces } from '../data/tenants.js';
import { crearContextoAcceso, vistaSesion } from '../core/identity/usuario.js';

export const LOCK_MS = 10 * 60 * 1000;
export const MAX_FALLOS = 5;

/**
 * Enriquecimiento aditivo de identidad (E3A): userId + workspaceId.
 * Conserva tenantId, email, nombre y rol.
 */
export function enriquecerUsuarioSesion(user) {
  return vistaSesion(crearContextoAcceso({
    tenantId: user.tenantId,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    userId: user.userId,
    workspaceId: user.workspaceId,
  }, catalogoWorkspaces()));
}
