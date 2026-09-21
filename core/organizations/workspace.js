/**
 * Contexto de workspace (E3A).
 * Para MONKEYS y SOMA: workspaceId === tenantId.
 * Core no conoce marcas como identidad global: solo IDs estables registrados.
 */

const WORKSPACES_INICIALES = Object.freeze(['monkeys', 'soma']);

/**
 * Resuelve tenantId → workspaceId.
 * @param {string} tenantId
 * @returns {string}
 * @throws {{ code: string }} si el workspace es desconocido
 */
export function workspaceIdDesdeTenantId(tenantId) {
  const id = String(tenantId || '').trim().toLowerCase();
  if (!WORKSPACES_INICIALES.includes(id)) {
    const err = new Error('workspace_desconocido');
    err.code = 'workspace_desconocido';
    throw err;
  }
  return id;
}

/**
 * @param {string} workspaceId
 * @returns {boolean}
 */
export function esWorkspaceConocido(workspaceId) {
  const id = String(workspaceId || '').trim().toLowerCase();
  return WORKSPACES_INICIALES.includes(id);
}

/**
 * Alias compatible: tenantId se conserva hasta E3B.
 * @param {string} workspaceId
 * @returns {string}
 */
export function tenantIdDesdeWorkspaceId(workspaceId) {
  return workspaceIdDesdeTenantId(workspaceId);
}

/**
 * Seleccionar un tenant en UI no autoriza acceso.
 * El contexto autenticado debe coincidir con el workspace solicitado.
 * @param {{ workspaceId?: string, tenantId?: string }} solicitado
 * @param {{ workspaceId?: string, tenantId?: string }|null} sesion
 * @returns {boolean}
 */
export function contextoCoincideConSesion(solicitado, sesion) {
  if (!sesion) return false;
  let wsSolicitado;
  let wsSesion;
  try {
    wsSolicitado = solicitado.workspaceId
      || workspaceIdDesdeTenantId(solicitado.tenantId);
    wsSesion = sesion.workspaceId
      || workspaceIdDesdeTenantId(sesion.tenantId);
  } catch {
    return false;
  }
  return wsSolicitado === wsSesion;
}

export { WORKSPACES_INICIALES };
