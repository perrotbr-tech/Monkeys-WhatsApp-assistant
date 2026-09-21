/** Helpers compartidos de agentes: sede estable vs nombre visible. */

import { buscarTenant, nombreSede, mismaSede } from '../../data/tenants.js';

export function tenantDeSocio(socio) {
  return buscarTenant(socio && socio.tenantId);
}

/** Nombre visible para plantillas; nunca el ID crudo. */
export function etiquetaSedeSocio(socio) {
  return nombreSede(tenantDeSocio(socio), socio && socio.sedeId);
}

/**
 * Horario de la clase favorita en la sede del socio (match por sedeId).
 * Fallback: "Clase en Nombre Visible" — nunca el ID.
 */
export function horarioSugerido(socio, clases) {
  const tenant = tenantDeSocio(socio);
  const c = (clases || []).find(
    (x) => x.nombre === socio.claseFavorita && mismaSede(tenant, x.sedeId || x.sede, socio.sedeId),
  );
  if (!c) return `${socio.claseFavorita} en ${etiquetaSedeSocio(socio)}`;
  return `${c.dia} ${c.hora}`;
}
