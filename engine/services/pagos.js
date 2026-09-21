/**
 * Proveedores de pago. Interfaz PaymentProvider:
 * crearLink(pago) → {url, referencia}
 * verificar(referencia) → {referencia, estado}
 * webhook(payload) → {tipo, referencia, estado}
 *
 * Sin fetch propio: MercadoPago recibe httpClient inyectado.
 * Sin credenciales, el tenant usa LinkPagoDemo.
 */

export const ESTADOS_PAGO = Object.freeze(['pendiente', 'pagada', 'vencida', 'rechazada']);

function mapEstadoMp(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'pagada') return 'pagada';
  if (s === 'rejected' || s === 'cancelled' || s === 'rechazada') return 'rechazada';
  if (s === 'expired' || s === 'vencida') return 'vencida';
  return 'pendiente';
}

export function crearTransferenciaManual({ datosBancarios } = {}) {
  return {
    id: 'transferencia',
    crearLink(pago) {
      const referencia = pago.referencia || `tr-${pago.id}`;
      return { url: null, referencia, datosBancarios: datosBancarios || '' };
    },
    verificar(referencia) {
      return { referencia, estado: 'pendiente' };
    },
    webhook(payload) {
      const p = payload || {};
      return {
        tipo: 'pago',
        referencia: p.referencia,
        estado: p.estado || 'pagada',
      };
    },
  };
}

export function crearLinkPagoDemo() {
  return {
    id: 'link_demo',
    crearLink(pago) {
      const referencia = pago.linkReferencia || pago.referencia || `demo-${pago.id}`;
      return { url: `#pago/${referencia}`, referencia };
    },
    verificar(referencia) {
      return { referencia, estado: 'pendiente' };
    },
    webhook(payload) {
      const p = payload || {};
      return {
        tipo: 'pago',
        referencia: p.referencia || p.id,
        estado: p.estado || 'pagada',
      };
    },
  };
}

export function crearMercadoPagoProvider({ accessToken, httpClient } = {}) {
  if (!accessToken) {
    const err = new Error('mercadopago_sin_credenciales');
    err.code = 'MP_NO_CREDS';
    throw err;
  }
  const http = httpClient;
  if (!http || typeof http.request !== 'function') {
    const err = new Error('mercadopago_sin_cliente');
    err.code = 'MP_NO_HTTP';
    throw err;
  }
  return {
    id: 'mercadopago',
    async crearLink(pago) {
      const pref = await http.request({
        method: 'POST',
        url: 'https://api.mercadopago.com/checkout/preferences',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: {
          items: [{
            title: pago.concepto || 'Membresía',
            quantity: 1,
            currency_id: 'CLP',
            unit_price: pago.monto,
          }],
          external_reference: String(pago.id),
        },
      });
      return { url: pref.init_point, referencia: pref.id };
    },
    async verificar(referencia) {
      const pay = await http.request({
        method: 'GET',
        url: `https://api.mercadopago.com/v1/payments/${encodeURIComponent(referencia)}`,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { referencia, estado: mapEstadoMp(pay.status) };
    },
    webhook(payload) {
      const p = payload || {};
      const data = p.data || {};
      return {
        tipo: 'pago',
        referencia: p.external_reference || data.id || p.referencia,
        estado: mapEstadoMp(p.status || data.status),
      };
    },
  };
}

/**
 * Elige proveedor de link. Credenciales MP → MercadoPagoProvider; si no, LinkPagoDemo.
 * Nunca llama a Mercado Pago si no hay accessToken + httpClient.
 */
export function proveedorDe(opts = {}) {
  const token = opts.accessToken || '';
  if (token) return crearMercadoPagoProvider({ accessToken: token, httpClient: opts.httpClient });
  return crearLinkPagoDemo();
}

export function modoPasarela(opts = {}) {
  return opts.accessToken ? 'mercadopago' : 'demo';
}
