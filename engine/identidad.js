/** Identidad de contacto. Usado por store y socios. */

export function normalizarTelefono(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('569')) return `+${digits}`;
  if (digits.length === 9 && digits.startsWith('9')) return `+56${digits}`;
  return null;
}

export function nombreValido(raw) {
  const n = String(raw || '').trim();
  return n.length >= 2 && n.length <= 60;
}
