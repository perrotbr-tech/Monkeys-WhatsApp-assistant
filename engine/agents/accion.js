import { parseFecha } from '../dates.js';

export function baseAccion(agente, socio, fecha, tipo, prioridad, motivo, texto) {
  return {
    id: null,
    tenantId: socio.tenantId || null,
    agente,
    tipo,
    socioId: socio.id,
    canal: 'simulado',
    texto,
    motivo,
    prioridad,
    estado: 'pendiente',
    fechaISO: parseFecha(fecha).toISOString(),
    sedeId: socio.sedeId,
  };
}

export { baseAccion as base };
