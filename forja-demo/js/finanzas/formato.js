/** Formato CLP chileno: $69.990 */

export function fmtClp(monto) {
  const n = Number(monto);
  if (!Number.isFinite(n)) return '$0';
  const entero = Math.round(n);
  const abs = Math.abs(entero);
  const conPuntos = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return entero < 0 ? `-$${conPuntos}` : `$${conPuntos}`;
}

export function etiquetaEstadoCargo(estado) {
  switch (estado) {
    case 'paid':
      return 'pagado';
    case 'pending':
      return 'pendiente';
    case 'overdue':
      return 'vencido';
    case 'exempt':
      return 'exento/becado';
    default:
      return String(estado || '');
  }
}

export function etiquetaMedioPago(medio) {
  switch (medio) {
    case 'transferencia':
      return 'transferencia';
    case 'tarjeta':
      return 'tarjeta';
    case 'efectivo':
      return 'efectivo';
    case 'link_pago':
      return 'link de pago demo';
    case 'exento':
      return 'exento';
    default:
      return String(medio || '—');
  }
}
