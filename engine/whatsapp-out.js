/** Salida única de mensajes del bot, representable en WhatsApp Cloud API. */

export const LIMITE_LINEAS = 6;
export const LIMITE_CHARS = 400;
export const LIMITE_LEGAL_CHARS = 1000;
export const MAX_BOTONES = 3;
export const MAX_LISTA = 10;
export const MAX_TITULO = 24;
export const MAX_DESC = 72;

export function recortar(s, n) {
  const t = String(s || '').trim();
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)).trim();
}

export function sanitizarTexto(texto) {
  return String(texto || '')
    .replace(/^\s*\d+\.\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function tipoDeOpciones(n) {
  if (!n) return null;
  if (n <= MAX_BOTONES) return 'botones';
  return 'lista';
}

export function normalizarOpcion(op) {
  const etiqueta = recortar(op.etiqueta || op.valor || '', MAX_TITULO);
  const descripcion = recortar(op.descripcion || '', MAX_DESC);
  const valor = String(op.valor != null ? op.valor : op.etiqueta || '');
  return { etiqueta, descripcion, valor };
}

export function paginarOpciones(opciones, offset = 0, size = MAX_LISTA) {
  const all = (opciones || []).map(normalizarOpcion);
  const slice = all.slice(offset, offset + size);
  const hayMas = offset + size < all.length;
  const ops = hayMas
    ? [...slice.slice(0, size - 1), { etiqueta: 'Ver más', descripcion: '', valor: 'ver mas' }]
    : slice;
  return { opciones: ops, hayMas, next: offset + size };
}

export function validarMensaje(msg, { legal = false } = {}) {
  const texto = String((msg && msg.texto) || '');
  if (/^\s*\d+\.\s/m.test(texto)) return { ok: false, error: 'numeracion' };
  const lineas = texto ? texto.split('\n').length : 0;
  if (!legal && lineas > LIMITE_LINEAS) return { ok: false, error: 'lineas' };
  const max = legal ? LIMITE_LEGAL_CHARS : LIMITE_CHARS;
  if (texto.length > max) return { ok: false, error: 'chars' };
  const ops = (msg && msg.opciones) || [];
  if (ops.length > MAX_LISTA) return { ok: false, error: 'opciones' };
  const tipo = msg && msg.tipoOpciones;
  if (tipo === 'botones' && ops.length > MAX_BOTONES) return { ok: false, error: 'botones' };
  if (ops.some((o) => String(o.etiqueta || '').length > MAX_TITULO)) return { ok: false, error: 'titulo' };
  return { ok: true };
}

/**
 * Toda respuesta del bot pasa por aquí.
 * Pagina texto y opciones para no emitir nada que WhatsApp rechazaría.
 */
export function formatearRespuesta({ texto, opciones = [], ia = false, legal = false, hora = null }) {
  let t = sanitizarTexto(texto);
  const maxChars = legal ? LIMITE_LEGAL_CHARS : LIMITE_CHARS;
  const maxLines = legal ? 12 : LIMITE_LINEAS;
  let lineas = t.split('\n');
  if (lineas.length > maxLines) lineas = lineas.slice(0, maxLines);
  t = lineas.join('\n');
  if (t.length > maxChars) t = recortar(t, maxChars);

  let ops = (opciones || []).map(normalizarOpcion);
  if (ops.length > MAX_LISTA) {
    ops = paginarOpciones(ops, 0, MAX_LISTA).opciones;
  }
  const tipoOpciones = tipoDeOpciones(ops.length);
  const msg = {
    autor: 'bot',
    texto: t,
    opciones: ops,
    tipoOpciones,
    ia: Boolean(ia),
    legal: Boolean(legal),
    hora: hora || new Date().toISOString(),
  };
  const v = validarMensaje(msg, { legal });
  if (!v.ok) {
    const err = new Error(`whatsapp_out:${v.error}`);
    err.codigo = 'WHATSAPP_OUT';
    throw err;
  }
  return msg;
}
