/**
 * Contrato AuditSink (E3A).
 * Solo contrato + implementación en memoria para pruebas.
 * Catálogo de workspaces inyectado; sin estado global en Core.
 */

import { exigirCatalogo } from '../organizations/workspace.js';

/**
 * @typedef {object} AuditEvent
 * @property {string} id
 * @property {string} workspaceId
 * @property {string|null} actorId
 * @property {string} action
 * @property {string} targetType
 * @property {string|null} targetId
 * @property {string} sourceDomain
 * @property {string} timestamp
 * @property {Record<string, unknown>} metadata
 */

/**
 * Valida un evento de auditoría (sin datos sensibles en metadata).
 * @param {Partial<AuditEvent>} evento
 * @param {import('../organizations/workspace.js').CatalogoWorkspaces} catalogo
 * @returns {AuditEvent}
 */
export function validarEventoAuditoria(evento, catalogo) {
  const cat = exigirCatalogo(catalogo);
  const e = evento || {};
  if (!e.id || !e.action || !e.targetType || !e.sourceDomain || !e.timestamp) {
    const err = new Error('audit_evento_incompleto');
    err.code = 'audit_evento_incompleto';
    throw err;
  }
  if (!e.workspaceId) {
    const err = new Error('audit_sin_workspace');
    err.code = 'audit_sin_workspace';
    throw err;
  }
  const workspaceId = cat.workspaceIdDesdeTenantId(e.workspaceId);
  const metadata = e.metadata && typeof e.metadata === 'object' ? { ...e.metadata } : {};
  for (const key of Object.keys(metadata)) {
    const k = key.toLowerCase();
    if (k.includes('password') || k.includes('clave') || k.includes('token') || k.includes('secret')) {
      const err = new Error('audit_metadata_sensible');
      err.code = 'audit_metadata_sensible';
      throw err;
    }
  }
  return {
    id: String(e.id),
    workspaceId: String(workspaceId),
    actorId: e.actorId == null ? null : String(e.actorId),
    action: String(e.action),
    targetType: String(e.targetType),
    targetId: e.targetId == null ? null : String(e.targetId),
    sourceDomain: String(e.sourceDomain),
    timestamp: String(e.timestamp),
    metadata,
  };
}

/**
 * Implementación en memoria de AuditSink.
 * @param {import('../organizations/workspace.js').CatalogoWorkspaces} catalogo
 */
export function crearAuditSinkMemoria(catalogo) {
  const cat = exigirCatalogo(catalogo);
  /** @type {AuditEvent[]} */
  const eventos = [];
  let seq = 0;

  return {
    record(evento) {
      seq += 1;
      const conId = {
        ...evento,
        id: evento && evento.id ? evento.id : `aud-${seq}`,
      };
      const row = validarEventoAuditoria(conId, cat);
      eventos.push(row);
      return { ...row, metadata: { ...row.metadata } };
    },
    listarPorWorkspace(workspaceId) {
      const ws = String(workspaceId || '');
      return eventos
        .filter((e) => e.workspaceId === ws)
        .map((e) => ({ ...e, metadata: { ...e.metadata } }));
    },
    todos() {
      return eventos.map((e) => ({ ...e, metadata: { ...e.metadata } }));
    },
    limpiar() {
      eventos.length = 0;
      seq = 0;
    },
  };
}
