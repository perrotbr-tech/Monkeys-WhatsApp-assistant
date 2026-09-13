/**
 * Plantillas de automatización. Placeholders se rellenan en el motor.
 * El texto generado NO puede contener "{" "}" ni "promo".
 * "$" solo está permitido en el agente de cobranza.
 */
export const plantillas = {
  retencion_constante:
    'Hola {nombre}, tu racha de {racha} semanas en {claseFavorita} en {sede} esta fuerte. Invita a un amigo a entrenar contigo.',
  retencion_constante_codigo:
    'Hola {nombre}, tu racha de {racha} semanas en {claseFavorita} en {sede} esta fuerte. Si un amigo quiere sumarse, tu codigo es {codigoReferido}.',
  retencion_riesgo:
    'Hola {nombre}, te esperamos de nuevo en {claseFavorita}. El proximo horario en {sede} es {horarioSugerido}.',
  retencion_tarea_silencioso:
    'Contactar a {nombre} en {sede}: sin visitas en 21 dias. Clase favorita {claseFavorita}.',
  cobranza_aviso:
    'Hola {nombre}, el equipo revisara el estado de tu plan {plan} en {sede}.',
  reactivacion_tarea:
    'Llamar a {nombre} en {sede} para retomar {claseFavorita}. Socio en baja.',
  recordatorio_clase:
    'Hola {nombre}, te esperamos en {claseFavorita} ({horarioSugerido}) en {sede}.',
  referidos_invita:
    'Hola {nombre}, si un amigo quiere sumarse a {claseFavorita} en {sede}, conversemos.',
};

export function aplicarPlantilla(tpl, vars) {
  let out = String(tpl || '');
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.split(`{${k}}`).join(v == null ? '' : String(v));
  }
  out = out.replace(/\{[a-zA-Z]+\}/g, '').replace(/[ \t]+/g, ' ').trim();
  return out;
}

export function textoValido(texto, { allowDollar = false } = {}) {
  if (!texto) return true;
  if (texto.includes('{') || texto.includes('}')) return false;
  if (/\bpromo\b/i.test(texto)) return false;
  if (!allowDollar && texto.includes('$')) return false;
  return true;
}
