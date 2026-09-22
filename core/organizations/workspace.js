/**
 * Contexto de workspace (E3A).
 * Catálogo puro e inyectable: Core no conoce marcas ni tenants concretos.
 * Durante el puente E3A: workspaceId === tenantId cuando ambos se reciben.
 */

/**
 * @typedef {object} CatalogoWorkspaces
 * @property {(id: string) => boolean} conoce
 * @property {(tenantId: string) => string} workspaceIdDesdeTenantId
 * @property {(workspaceId: string) => string} tenantIdDesdeWorkspaceId
 * @property {() => string[]} ids
 */

function normalizarId(valor) {
  return String(valor || '').trim().toLowerCase();
}

function errorCodigo(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

/**
 * Crea un catálogo inmutable a partir de una lista de IDs.
 * No acepta cualquier string: solo los IDs suministrados.
 * @param {Iterable<string>|string[]} ids
 * @returns {CatalogoWorkspaces}
 */
export function crearCatalogoWorkspaces(ids) {
  const set = new Set();
  for (const raw of ids || []) {
    const id = normalizarId(raw);
    if (id) set.add(id);
  }
  const lista = Object.freeze([...set].sort());

  function conoce(id) {
    return set.has(normalizarId(id));
  }

  function workspaceIdDesdeTenantId(tenantId) {
    const id = normalizarId(tenantId);
    if (!set.has(id)) throw errorCodigo('workspace_desconocido');
    return id;
  }

  return Object.freeze({
    conoce,
    workspaceIdDesdeTenantId,
    tenantIdDesdeWorkspaceId: workspaceIdDesdeTenantId,
    ids: () => [...lista],
  });
}

/**
 * Exige catálogo válido (sin estado global).
 * @param {CatalogoWorkspaces|null|undefined} catalogo
 * @returns {CatalogoWorkspaces}
 */
export function exigirCatalogo(catalogo) {
  if (!catalogo || typeof catalogo.workspaceIdDesdeTenantId !== 'function' || typeof catalogo.conoce !== 'function') {
    throw errorCodigo('catalogo_requerido');
  }
  return catalogo;
}

/**
 * Resuelve el par tenant/workspace con coherencia E3A.
 * Si ambos llegan, deben ser iguales; si no, error `workspace_tenant_incoherente`.
 * @param {{ tenantId?: string|null, workspaceId?: string|null }} par
 * @param {CatalogoWorkspaces} catalogo
 * @returns {{ workspaceId: string, tenantId: string }}
 */
export function resolverParTenantWorkspace(par, catalogo) {
  const cat = exigirCatalogo(catalogo);
  const src = par || {};
  const tRaw = src.tenantId == null || src.tenantId === '' ? null : normalizarId(src.tenantId);
  const wRaw = src.workspaceId == null || src.workspaceId === '' ? null : normalizarId(src.workspaceId);

  if (tRaw && wRaw && tRaw !== wRaw) {
    throw errorCodigo('workspace_tenant_incoherente');
  }
  const id = wRaw || tRaw;
  if (!id) throw errorCodigo('workspace_requerido');
  const resolved = cat.workspaceIdDesdeTenantId(id);
  return { workspaceId: resolved, tenantId: resolved };
}

/**
 * @param {string} tenantId
 * @param {CatalogoWorkspaces} catalogo
 * @returns {string}
 */
export function workspaceIdDesdeTenantId(tenantId, catalogo) {
  return exigirCatalogo(catalogo).workspaceIdDesdeTenantId(tenantId);
}

/**
 * @param {string} workspaceId
 * @param {CatalogoWorkspaces} catalogo
 * @returns {boolean}
 */
export function esWorkspaceConocido(workspaceId, catalogo) {
  return exigirCatalogo(catalogo).conoce(workspaceId);
}

/**
 * Alias compatible: tenantId se conserva hasta E3B.
 * @param {string} workspaceId
 * @param {CatalogoWorkspaces} catalogo
 * @returns {string}
 */
export function tenantIdDesdeWorkspaceId(workspaceId, catalogo) {
  return exigirCatalogo(catalogo).tenantIdDesdeWorkspaceId(workspaceId);
}

/**
 * Seleccionar un tenant en UI no autoriza acceso.
 * Objetos internamente incoherentes (tenantId ≠ workspaceId) → false.
 * @param {{ workspaceId?: string, tenantId?: string }} solicitado
 * @param {{ workspaceId?: string, tenantId?: string }|null} sesion
 * @param {CatalogoWorkspaces} catalogo
 * @returns {boolean}
 */
export function contextoCoincideConSesion(solicitado, sesion, catalogo) {
  if (!sesion) return false;
  try {
    const a = resolverParTenantWorkspace(solicitado, catalogo);
    const b = resolverParTenantWorkspace(sesion, catalogo);
    return a.workspaceId === b.workspaceId;
  } catch {
    return false;
  }
}
