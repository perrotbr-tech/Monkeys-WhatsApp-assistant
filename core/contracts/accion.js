/**
 * Contrato de metadatos de acciones (E3A).
 * No repara silenciosamente acciones inválidas: lanza si faltan campos.
 * Fecha se recibe ya resuelta (Clock inyectado fuera de Core).
 * No muta la acción de entrada.
 */

import { resolverParTenantWorkspace, exigirCatalogo } from '../organizations/workspace.js';

export const ORIGEN_DOMINIO_GESTION = 'gestion';
export const DESTINATARIO_SOCIO = 'socio';
export const DESTINATARIO_EQUIPO = 'equipo';

/**
 * @param {string} tipo
 * @returns {'socio'|'equipo'}
 */
export function destinatarioPorTipo(tipo) {
  if (tipo === 'mensaje') return DESTINATARIO_SOCIO;
  if (tipo === 'tarea_equipo') return DESTINATARIO_EQUIPO;
  const err = new Error('tipo_accion_desconocido');
  err.code = 'tipo_accion_desconocido';
  throw err;
}

/**
 * Valida y construye metadatos obligatorios de una acción.
 * @param {object} input
 * @param {import('../organizations/workspace.js').CatalogoWorkspaces} catalogo
 * @returns {object}
 */
export function metadatosAccion(input, catalogo) {
  exigirCatalogo(catalogo);
  const src = input || {};
  const { workspaceId, tenantId } = resolverParTenantWorkspace({
    workspaceId: src.workspaceId,
    tenantId: src.tenantId,
  }, catalogo);

  const tipo = src.tipo;
  const destinatarioRol = src.destinatarioRol || (tipo ? destinatarioPorTipo(tipo) : null);
  if (!destinatarioRol) {
    const err = new Error('accion_sin_destinatario');
    err.code = 'accion_sin_destinatario';
    throw err;
  }
  if (destinatarioRol !== DESTINATARIO_SOCIO && destinatarioRol !== DESTINATARIO_EQUIPO) {
    const err = new Error('destinatario_invalido');
    err.code = 'destinatario_invalido';
    throw err;
  }

  const origenDominio = src.origenDominio || ORIGEN_DOMINIO_GESTION;
  const origenTipo = src.origenTipo;
  const origenId = src.origenId;
  if (!origenTipo || !origenId) {
    const err = new Error('accion_sin_origen');
    err.code = 'accion_sin_origen';
    throw err;
  }

  const estado = src.estado;
  if (!estado) {
    const err = new Error('accion_sin_estado');
    err.code = 'accion_sin_estado';
    throw err;
  }

  const fechaISO = src.fechaISO;
  if (!fechaISO) {
    const err = new Error('accion_sin_fecha');
    err.code = 'accion_sin_fecha';
    throw err;
  }

  return {
    workspaceId,
    tenantId,
    destinatarioRol,
    origenDominio,
    origenTipo,
    origenId,
    actor: src.actor == null ? null : src.actor,
    fechaISO,
    motivo: src.motivo == null ? null : src.motivo,
    estado,
  };
}

/**
 * Aplica el contrato a una acción existente sin alterar texto ni segmentación.
 * No muta `accion` de entrada. Identificadores cruzados → `workspace_tenant_incoherente`.
 * @param {object} accion
 * @param {{
 *   origenTipo?: string,
 *   origenId?: string,
 *   actor?: string|null,
 *   catalogo: import('../organizations/workspace.js').CatalogoWorkspaces,
 * }} extras
 * @returns {object} nueva acción con metadatos
 */
export function aplicarContratoAccion(accion, extras = {}) {
  if (!accion || typeof accion !== 'object') {
    const err = new Error('accion_invalida');
    err.code = 'accion_invalida';
    throw err;
  }
  const catalogo = extras.catalogo;
  exigirCatalogo(catalogo);
  const tipo = accion.tipo;
  const origenTipo = extras.origenTipo || accion.origenTipo || accion.agente || null;
  const origenId = extras.origenId || accion.origenId || accion.agente || null;
  const meta = metadatosAccion({
    workspaceId: accion.workspaceId,
    tenantId: accion.tenantId,
    destinatarioRol: accion.destinatarioRol,
    origenDominio: accion.origenDominio || ORIGEN_DOMINIO_GESTION,
    origenTipo,
    origenId,
    actor: extras.actor !== undefined ? extras.actor : (accion.actor == null ? null : accion.actor),
    fechaISO: accion.fechaISO,
    motivo: accion.motivo,
    estado: accion.estado,
    tipo,
  }, catalogo);

  if (tipo === 'mensaje' && meta.destinatarioRol !== DESTINATARIO_SOCIO) {
    const err = new Error('mensaje_debe_ir_a_socio');
    err.code = 'mensaje_debe_ir_a_socio';
    throw err;
  }
  if (tipo === 'tarea_equipo' && meta.destinatarioRol !== DESTINATARIO_EQUIPO) {
    const err = new Error('tarea_debe_ir_a_equipo');
    err.code = 'tarea_debe_ir_a_equipo';
    throw err;
  }

  return {
    ...accion,
    ...meta,
  };
}
