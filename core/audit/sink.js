/**
 * Contrato AuditSink (E3A).
 * Solo contrato + implementación en memoria para pruebas.
 * No audita todas las rutas ni persiste en snapshots.
 */

import { workspaceIdDesdeTenantId, esWorkspaceConocido } from '../organizations/workspace.js';

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
 * @returns {AuditEvent}
 */
export function validarEventoAuditoria(evento) {
  const e = evento || {};
  if (!e.id || !e.action || !e.targetType || !e.sourceDomain || !e.timestamp) {
    const err = new Error('audit_evento_incompleto');
    err.code = 'audit_evento_incompleto';
    throw err;
  }
  let workspaceId = e.workspaceId;
  if (!workspaceId) {
    const err = new Error('audit_sin_workspace');
    err.code = 'audit_sin_workspace';
    throw err;
  }
  if (!esWorkspaceConocido(workspaceId)) {
    try {
      workspaceId = workspaceIdDesdeTenantId(workspaceId);
    } catch (err) {
      throw err;
    }
  }
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
 * @returns {{
 *   record: (evento: Partial<AuditEvent>) => AuditEvent,
 *   listarPorWorkspace: (workspaceId: string) => AuditEvent[],
 *   todos: () => AuditEvent[],
 *   limpiar: () => void,
 * }}
 */
export function crearAuditSinkMemoria() {
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
      const row = validarEventoAuditoria(conId);
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
