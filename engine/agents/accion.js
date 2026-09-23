import { parseFecha } from '../dates.js';
import { aplicarContratoAccion } from '../../core/contracts/accion.js';
import { catalogoWorkspaces } from '../../data/tenants.js';

/**
 * Acción base de agentes de Gestión.
 * Aplica contrato E3A (workspaceId, destinatario, origen) sin alterar textos.
 */
export function baseAccion(agente, socio, fecha, tipo, prioridad, motivo, texto) {
  const estado = 'pendiente';
  const fechaISO = parseFecha(fecha).toISOString();
  const workspaceId = socio.workspaceId || socio.tenantId || null;
  const base = {
    id: null,
    workspaceId,
    tenantId: workspaceId,
    agente,
    tipo,
    socioId: socio.id,
    canal: 'simulado',
    texto,
    motivo,
    prioridad,
    estado,
    fechaISO,
    sedeId: socio.sedeId,
  };
  return aplicarContratoAccion(base, {
    origenTipo: 'agente',
    origenId: agente,
    catalogo: catalogoWorkspaces(),
  });
}

export { baseAccion as base };
