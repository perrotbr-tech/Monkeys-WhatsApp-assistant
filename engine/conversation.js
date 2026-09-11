/**
 * Orquestador conversacional. La IA solo interpreta; las reservas las confirma el store.
 *
 * @typedef {Object} MessageChannel
 * Canal futuro (WhatsApp). No implementado en este MVP.
 * @property {(to: string, texto: string) => Promise<void>} send
 */

import { clonarDemo } from '../data/demo.js';
import { crearIntentService, INTENCIONES, normalizar } from './intent.js';
import { crearMemoria, clonar, normalizarTelefono, nombreValido } from './store.js';

const SEDES = ['Félix García', 'Alta Vista'];
const OBJETIVOS = [
  'Bajar de peso',
  'Ganar fuerza',
  'Mejorar condición física',
  'Conocer el gimnasio',
  'Otro',
];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const MENU_OPS = [
  { etiqueta: '1 🏋️ Ver clases', valor: '1' },
  { etiqueta: '2 📅 Reservar mi cupo', valor: '2' },
  { etiqueta: '3 🔥 Probar una clase GRATIS', valor: '3' },
  { etiqueta: '4 💪 Ver planes', valor: '4' },
  { etiqueta: '5 🔎 Consultar mi reserva', valor: '5' },
  { etiqueta: '6 👋 Hablar con el equipo', valor: '6' },
];

const IA_LINEA = {
  [INTENCIONES.CLASES]: 'Entendí que quieres ver las clases.',
  [INTENCIONES.RESERVA]: 'Entendí que quieres reservar un cupo.',
  [INTENCIONES.TRIAL]: 'Entendí que quieres una clase de prueba.',
  [INTENCIONES.PLANES]: 'Entendí que quieres ver los planes.',
  [INTENCIONES.HUMANO]: 'Entendí que quieres hablar con el equipo.',
  [INTENCIONES.LOOKUP]: 'Entendí que quieres consultar una reserva.',
  [INTENCIONES.MENU]: 'Entendí que quieres volver al menú.',
  [INTENCIONES.AYUDA]: 'Entendí que necesitas orientación.',
};

export function crearEngine(datosIniciales) {
  const memoria = crearMemoria(datosIniciales || clonarDemo());
  const intent = crearIntentService();

  function iniciar() {
    const conv = memoria.crearConversacion();
    const msg = botMsg(
      '¡Hola! 👋 Bienvenido a MONKEYS. ¿En qué sede quieres entrenar?',
      sedesOps(),
    );
    conv.messages.push(msg);
    return { conversacion: publicConv(conv), mensajes: [msg] };
  }

  function procesar(conversacionId, textoCrudo) {
    const conv = memoria.getConversacion(conversacionId);
    if (!conv) {
      return {
        conversacion: null,
        mensajes: [botMsg('No encontramos esa conversación. Recarga e inténtalo de nuevo.')],
      };
    }

    const texto = String(textoCrudo || '').slice(0, 500).trim();
    conv.messages.push({ autor: 'user', texto, opciones: [], ia: false, hora: ahora() });
    const cmd = normalizar(texto);

    let out;
    if (cmd === 'menu') out = irMenu(conv, false);
    else if (cmd === 'cancelar') {
      conv.data = {};
      out = irMenu(conv, false, 'Cancelé el flujo.');
    } else if (cmd === 'volver') out = irMenu(conv, false);
    else if (cmd === 'humano') out = iniciarHumano(conv, false);
    else if (cmd === 'ayuda') out = ayuda(conv);
    else if (conv.status === 'waiting_human') {
      out = [botMsg('Tu solicitud ya está con el equipo. Escribe menú para volver al asistente.', [{ etiqueta: 'Menú', valor: 'menu' }])];
    } else out = continuar(conv, texto, cmd);

    const mensajes = Array.isArray(out) ? out : [out];
    for (const m of mensajes) conv.messages.push(m);
    return { conversacion: publicConv(conv), mensajes };
  }

  function continuar(conv, texto, cmd) {
    switch (conv.paso) {
      case 'pick_sede':
        return pickSede(conv, cmd);
      case 'menu':
        return desdeMenu(conv, texto, cmd);
      case 'reserve_pick_class':
        return reservePickClass(conv, texto, cmd);
      case 'reserve_name':
        return reserveName(conv, texto);
      case 'reserve_phone':
        return reservePhone(conv, texto);
      case 'reserve_email':
        return reserveEmail(conv, texto, cmd);
      case 'reserve_confirm':
        return reserveConfirm(conv, cmd);
      case 'trial_name':
        return trialName(conv, texto);
      case 'trial_phone':
        return trialPhone(conv, texto);
      case 'trial_goal':
        return trialGoal(conv, texto);
      case 'trial_class':
        return trialClass(conv, texto, cmd);
      case 'trial_day':
        return trialDay(conv, texto, cmd);
      case 'human_reason':
        return humanReason(conv, texto);
      case 'lookup_code':
        return lookupCode(conv, texto);
      case 'plans_info_name':
        return plansInfoName(conv, texto);
      case 'plans_info_phone':
        return plansInfoPhone(conv, texto);
      default:
        return irMenu(conv, false, 'Volvamos al menú.');
    }
  }

  function pickSede(conv, cmd) {
    const sede = matchSede(cmd);
    if (!sede) return [botMsg('Elige una sede para continuar.', sedesOps())];
    conv.sede = sede;
    conv.paso = 'menu';
    return [botMsg(`Sede ${sede}. ¿Qué quieres hacer hoy?`, MENU_OPS)];
  }

  function desdeMenu(conv, texto, cmd) {
    if (cmd.includes('quiero mas informacion') || cmd.includes('mas informacion')) {
      conv.paso = 'plans_info_name';
      conv.data = {};
      return [botMsg('Con gusto. ¿Cuál es tu nombre?')];
    }
    const n = menuNumero(cmd, texto);
    if (n === 1 || cmd.includes('ver clases')) return verClases(conv, false);
    if (n === 2 || cmd.includes('reservar mi cupo')) return iniciarReserva(conv, false, null);
    if (n === 3 || cmd.includes('probar') || cmd.includes('gratis')) return iniciarTrial(conv, false);
    if (n === 4 || cmd.includes('ver planes')) return verPlanes(conv, false);
    if (n === 5 || cmd.includes('consultar')) return iniciarLookup(conv, false);
    if (n === 6 || cmd.includes('hablar') || cmd.includes('equipo')) return iniciarHumano(conv, false);

    const det = intent.detectar(texto);
    if (det.intencion === INTENCIONES.DESCONOCIDA) {
      return [botMsg('No te seguí del todo. Elige una opción o escríbela.', MENU_OPS)];
    }
    return aplicarIntencion(conv, det, true);
  }

  function aplicarIntencion(conv, det, marcarIa) {
    if (det.intencion === INTENCIONES.CLASES) return verClases(conv, marcarIa);
    if (det.intencion === INTENCIONES.RESERVA) return iniciarReserva(conv, marcarIa, det.entidades.clase);
    if (det.intencion === INTENCIONES.TRIAL) return iniciarTrial(conv, marcarIa);
    if (det.intencion === INTENCIONES.PLANES) return verPlanes(conv, marcarIa);
    if (det.intencion === INTENCIONES.HUMANO) return iniciarHumano(conv, marcarIa);
    if (det.intencion === INTENCIONES.LOOKUP) return iniciarLookup(conv, marcarIa);
    if (det.intencion === INTENCIONES.MENU) return irMenu(conv, marcarIa);
    if (det.intencion === INTENCIONES.AYUDA) return ayuda(conv, marcarIa);
    return [botMsg('No te seguí del todo. Elige una opción.', MENU_OPS)];
  }

  function verClases(conv, ia) {
    conv.paso = 'menu';
    const lineas = memoria.listarClases(conv.sede).map(formatClase).join('\n');
    return maybeIa(ia, INTENCIONES.CLASES, [
      botMsg(`${lineas}\n\nPuedes reservar un cupo o volver al menú.`, [
        { etiqueta: '📅 Reservar', valor: '2' },
        { etiqueta: 'Menú', valor: 'menu' },
      ]),
    ]);
  }

  function iniciarReserva(conv, ia, claseNombre) {
    conv.data = { phoneTries: 0 };
    if (claseNombre) {
      const clase = memoria.buscarClase(conv.sede, claseNombre);
      if (!clase || clase.agotada) {
        conv.paso = 'reserve_pick_class';
        const msg = !clase
          ? `No encontré ${claseNombre} en ${conv.sede}. Elige una clase:`
          : `Esa clase está AGOTADA. Elige otra en ${conv.sede}:`;
        return maybeIa(ia, INTENCIONES.RESERVA, [botMsg(msg, classOps(conv.sede))]);
      }
      conv.data.claseId = clase.id;
      conv.paso = 'reserve_name';
      return maybeIa(ia, INTENCIONES.RESERVA, [
        botMsg(`Vas a reservar ${formatClase(clase)}\n\n¿Cuál es tu nombre?`),
      ]);
    }
    conv.paso = 'reserve_pick_class';
    return maybeIa(ia, INTENCIONES.RESERVA, [
      botMsg(`¿Qué clase quieres reservar en ${conv.sede}?`, classOps(conv.sede)),
    ]);
  }

  function reservePickClass(conv, texto, cmd) {
    const clase = pickClase(conv.sede, texto, cmd);
    if (!clase) return [botMsg('Elige una clase de la lista.', classOps(conv.sede))];
    if (clase.agotada) {
      return [botMsg('Esa clase está AGOTADA y no se puede reservar. Elige otra.', classOps(conv.sede))];
    }
    conv.data.claseId = clase.id;
    conv.paso = 'reserve_name';
    return [botMsg(`Vas a reservar ${formatClase(clase)}\n\n¿Cuál es tu nombre?`)];
  }

  function reserveName(conv, texto) {
    if (!nombreValido(texto)) return [botMsg('El nombre debe tener entre 2 y 60 caracteres.')];
    conv.data.nombre = texto.trim();
    conv.usuario = conv.data.nombre;
    conv.paso = 'reserve_phone';
    return [botMsg('¿Cuál es tu teléfono? (Chile, ej. +56 9 1234 5678)')];
  }

  function reservePhone(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (!tel) {
      conv.data.phoneTries = (conv.data.phoneTries || 0) + 1;
      if (conv.data.phoneTries >= 3) {
        conv.paso = 'menu';
        return [botMsg('No pude validar el teléfono. Volvamos al menú.', MENU_OPS)];
      }
      return [botMsg('Teléfono no válido. Usa +56 9 XXXX XXXX o 9XXXXXXXX.')];
    }
    conv.data.telefono = tel;
    conv.telefono = tel;
    conv.paso = 'reserve_email';
    return [botMsg('Correo (opcional). Escríbelo o pulsa omitir.', [{ etiqueta: 'Omitir', valor: 'omitir' }])];
  }

  function reserveEmail(conv, texto, cmd) {
    if (cmd !== 'omitir') {
      const mail = texto.trim();
      if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        return [botMsg('Correo no válido. Inténtalo de nuevo o escribe omitir.')];
      }
      conv.data.email = mail || null;
    } else conv.data.email = null;
    conv.paso = 'reserve_confirm';
    const clase = memoria.getClase(conv.data.claseId);
    const resumen = [
      'Resumen de tu reserva:',
      `• Sede: ${conv.sede}`,
      `• Clase: ${clase.nombre}`,
      `• ${clase.dia} ${clase.hora}`,
      `• Nombre: ${conv.data.nombre}`,
      `• Teléfono: ${conv.data.telefono}`,
    ].join('\n');
    return [botMsg(resumen, [
      { etiqueta: 'CONFIRMAR RESERVA', valor: 'confirmar' },
      { etiqueta: 'CANCELAR', valor: 'cancelar' },
    ])];
  }

  function reserveConfirm(conv, cmd) {
    if (cmd === 'cancelar' || cmd === 'no') {
      conv.data = {};
      return irMenu(conv, false, 'Cancelé la reserva.');
    }
    if (cmd !== 'confirmar' && cmd !== 'si' && cmd !== 'confirmar reserva') {
      return [botMsg('Para seguir, confirma o cancela.', [
        { etiqueta: 'CONFIRMAR RESERVA', valor: 'confirmar' },
        { etiqueta: 'CANCELAR', valor: 'cancelar' },
      ])];
    }
    const result = memoria.confirmarReserva({
      claseId: conv.data.claseId,
      nombre: conv.data.nombre,
      telefono: conv.data.telefono,
      email: conv.data.email,
      sede: conv.sede,
    });
    conv.paso = 'menu';
    conv.data = {};
    if (!result.ok) return [botMsg(result.error, MENU_OPS)];
    return [botMsg(`🔥 ¡LISTO! TU CUPO ESTÁ RESERVADO.\nCódigo ${result.booking.codigo}`, MENU_OPS)];
  }

  function iniciarTrial(conv, ia) {
    conv.data = { phoneTries: 0 };
    conv.paso = 'trial_name';
    return maybeIa(ia, INTENCIONES.TRIAL, [botMsg('Clase de prueba GRATIS. ¿Cuál es tu nombre?')]);
  }

  function trialName(conv, texto) {
    if (!nombreValido(texto)) return [botMsg('El nombre debe tener entre 2 y 60 caracteres.')];
    conv.data.nombre = texto.trim();
    conv.usuario = conv.data.nombre;
    conv.paso = 'trial_phone';
    return [botMsg('¿Cuál es tu teléfono? (Chile)')];
  }

  function trialPhone(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (!tel) {
      conv.data.phoneTries = (conv.data.phoneTries || 0) + 1;
      if (conv.data.phoneTries >= 3) {
        conv.paso = 'menu';
        return [botMsg('No pude validar el teléfono. Volvamos al menú.', MENU_OPS)];
      }
      return [botMsg('Teléfono no válido. Usa +56 9 XXXX XXXX o 9XXXXXXXX.')];
    }
    conv.data.telefono = tel;
    conv.telefono = tel;
    conv.paso = 'trial_goal';
    return [botMsg('¿Cuál es tu objetivo?', OBJETIVOS.map((o) => ({ etiqueta: o, valor: o })))];
  }

  function trialGoal(conv, texto) {
    const goal = OBJETIVOS.find((o) => normalizar(o) === normalizar(texto)) || texto.trim();
    if (!goal) return [botMsg('Elige un objetivo.', OBJETIVOS.map((o) => ({ etiqueta: o, valor: o })))];
    conv.data.objetivo = goal;
    conv.paso = 'trial_class';
    return [botMsg('¿Qué clase te gustaría probar?', classOps(conv.sede, false))];
  }

  function trialClass(conv, texto, cmd) {
    const clase = pickClase(conv.sede, texto, cmd);
    if (!clase) return [botMsg('Elige una clase de la sede.', classOps(conv.sede, false))];
    conv.data.clase = clase.nombre;
    conv.paso = 'trial_day';
    return [botMsg('¿Qué día te acomoda?', DIAS.map((d) => ({ etiqueta: d, valor: d })))];
  }

  function trialDay(conv, texto, cmd) {
    const dia = DIAS.find((d) => normalizar(d) === cmd) || DIAS.find((d) => cmd.includes(normalizar(d)));
    if (!dia) return [botMsg('Elige un día de lunes a sábado.', DIAS.map((d) => ({ etiqueta: d, valor: d })))];
    memoria.crearLead({
      nombre: conv.data.nombre,
      telefono: conv.data.telefono,
      objetivo: conv.data.objetivo,
      clase: conv.data.clase,
      dia,
      sede: conv.sede,
    });
    conv.paso = 'menu';
    conv.data = {};
    return [botMsg('🔥 ¡LISTO! Registramos tu solicitud de clase de prueba. Un ejecutivo podrá contactarte para coordinarla.', MENU_OPS)];
  }

  function verPlanes(conv, ia) {
    conv.paso = 'menu';
    const planes = memoria.listarPlanes().map((p) => `• ${p.nombre} ${p.precio}`).join('\n');
    return maybeIa(ia, INTENCIONES.PLANES, [
      botMsg(`${planes}\n\nValores demostrativos para este prototipo.`, [
        { etiqueta: 'QUIERO MÁS INFORMACIÓN', valor: 'quiero mas informacion' },
        { etiqueta: 'Menú', valor: 'menu' },
      ]),
    ]);
  }

  function plansInfoName(conv, texto) {
    if (!nombreValido(texto)) return [botMsg('El nombre debe tener entre 2 y 60 caracteres.')];
    conv.data.nombre = texto.trim();
    conv.paso = 'plans_info_phone';
    return [botMsg('¿Tu teléfono?')];
  }

  function plansInfoPhone(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (!tel) return [botMsg('Teléfono no válido. Usa +56 9 XXXX XXXX.')];
    memoria.crearLead({
      nombre: conv.data.nombre,
      telefono: tel,
      objetivo: 'Información de planes',
      clase: '—',
      dia: '—',
      sede: conv.sede,
    });
    conv.paso = 'menu';
    conv.data = {};
    return [botMsg('Quedó registrado. Un ejecutivo te contactará.', MENU_OPS)];
  }

  function iniciarHumano(conv, ia) {
    conv.paso = 'human_reason';
    return maybeIa(ia, INTENCIONES.HUMANO, [botMsg('Cuéntanos brevemente en qué necesitas ayuda.')]);
  }

  function humanReason(conv, texto) {
    conv.motivo = texto.trim() || 'Sin detalle';
    conv.status = 'waiting_human';
    conv.paso = 'done';
    return [botMsg('Gracias. Tu solicitud quedó registrada para atención de un ejecutivo.', [{ etiqueta: 'Menú', valor: 'menu' }])];
  }

  function iniciarLookup(conv, ia) {
    conv.paso = 'lookup_code';
    return maybeIa(ia, INTENCIONES.LOOKUP, [botMsg('Ingresa tu código (ej. GYM-2026-0001).')]);
  }

  function lookupCode(conv, texto) {
    const b = memoria.buscarReserva(texto);
    conv.paso = 'menu';
    if (!b) return [botMsg('No encontramos una reserva con ese código.', MENU_OPS)];
    return [botMsg(`Código ${b.codigo}\n• ${b.clase} — ${b.sede}\n• ${b.dia} ${b.hora}\n• Estado: ${b.estado}`, MENU_OPS)];
  }

  function ayuda(conv, ia = false) {
    conv.paso = conv.sede ? 'menu' : 'pick_sede';
    return maybeIa(ia, INTENCIONES.AYUDA, [
      botMsg(
        'Puedo mostrarte clases, reservar un cupo, agendar una clase de prueba, ver planes o derivarte a un ejecutivo.',
        conv.sede ? MENU_OPS : sedesOps(),
      ),
    ]);
  }

  function irMenu(conv, ia, preface) {
    if (conv.status === 'waiting_human') conv.status = 'active';
    if (!conv.sede) {
      conv.paso = 'pick_sede';
      return [botMsg('¿En qué sede quieres entrenar?', sedesOps())];
    }
    conv.paso = 'menu';
    conv.data = {};
    const t = preface ? `${preface}\n\n¿Qué quieres hacer hoy?` : '¿Qué quieres hacer hoy?';
    return maybeIa(ia, INTENCIONES.MENU, [botMsg(t, MENU_OPS)]);
  }

  function pickClase(sede, texto, cmd) {
    const clases = memoria.listarClases(sede);
    const n = Number.parseInt(cmd, 10);
    if (Number.isInteger(n) && n >= 1 && n <= clases.length) return clases[n - 1];
    return (
      clases.find((c) => normalizar(c.nombre) === cmd)
      || clases.find((c) => cmd.includes(normalizar(c.nombre)))
      || memoria.buscarClase(sede, texto)
    );
  }

  function classOps(sede, markAgotada = true) {
    return memoria.listarClases(sede).map((c, i) => ({
      etiqueta: markAgotada && c.agotada
        ? `${i + 1}. ${c.nombre} · AGOTADA`
        : `${i + 1}. ${c.nombre} · ${c.dia} ${c.hora}`,
      valor: c.nombre,
    }));
  }

  function formatClase(c) {
    const cupo = c.agotada ? 'AGOTADA' : `${c.disponibles ?? c.capacity - c.reserved}/${c.capacity} cupos`;
    return `• ${c.nombre} · ${c.dia} ${c.hora} · ${c.entrenador} · ${cupo}`;
  }

  function maybeIa(ia, intencion, mensajes) {
    if (!ia || !mensajes.length) return mensajes;
    const linea = IA_LINEA[intencion];
    if (!linea) return mensajes;
    mensajes[0] = { ...mensajes[0], texto: `${linea}\n\n${mensajes[0].texto}`, ia: true };
    return mensajes;
  }

  return {
    iniciar,
    procesar,
    listarClases: (sede) => memoria.listarClases(sede),
    listarPlanes: () => memoria.listarPlanes(),
    listarReservas: () => memoria.listarReservas(),
    listarLeads: () => memoria.listarLeads(),
    listarConversaciones: () => memoria.listarConversaciones(),
    reset() { memoria.hidratar(clonarDemo()); },
    exportar() { return memoria.snapshot(); },
    hidratar(datos) { memoria.hidratar(datos); },
    intent,
  };
}

function publicConv(conv) {
  return clonar({
    id: conv.id,
    sede: conv.sede,
    status: conv.status,
    paso: conv.paso,
    usuario: conv.usuario,
    telefono: conv.telefono,
    motivo: conv.motivo,
  });
}

function botMsg(texto, opciones = [], ia = false) {
  return { autor: 'bot', texto, opciones, ia, hora: ahora() };
}

function sedesOps() {
  return SEDES.map((s) => ({ etiqueta: `📍 ${s}`, valor: s }));
}

function menuNumero(cmd, texto) {
  const t = String(texto || '').trim();
  if (/^[1-6]$/.test(t) || /^[1-6]$/.test(cmd)) return Number(t || cmd);
  return null;
}

function matchSede(cmd) {
  if (cmd.includes('felix') || cmd.includes('garcia')) return 'Félix García';
  if (cmd.includes('alta') || cmd.includes('vista')) return 'Alta Vista';
  return SEDES.find((s) => normalizar(s) === cmd) || null;
}

function ahora() {
  return new Date().toISOString();
}
