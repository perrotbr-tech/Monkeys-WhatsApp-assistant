/**
 * Orquestador conversacional. La IA solo interpreta; las reservas las confirma el store.
 *
 * @typedef {Object} MessageChannel
 * Canal futuro (WhatsApp). No implementado en este MVP.
 * @property {(to: string, texto: string) => Promise<void>} send
 */

import { clonarDemo } from '../data/demo.js';
import { TENANT_DEFAULT, menuDe, capacidadesDe, mismaSede, nombreSede, resolverSedeId } from '../data/tenants.js';
import { i18n } from '../data/i18n.js';
import { crearIntentService, INTENCIONES, normalizar } from './intent.js';
import { crearMemoria, clonar, normalizarTelefono, nombreValido } from './store.js';
import { fechaHoy, addDays, weekdayEs, dayNum } from './dates.js';
import { relojActivo } from './clock.js';
import {
  extraerRelDia, extraerDisciplina, disciplinasDe, filtrarClases, lineaHorario,
  paginar, agruparPlanes, etiquetaDia, diaSemanaDeRel,
} from './catalogo.js';
import { formatearRespuesta, paginarOpciones } from './whatsapp-out.js';

const OBJETIVOS = [
  'Bajar de peso',
  'Ganar fuerza',
  'Mejorar condición física',
  'Conocer el gimnasio',
  'Otro',
];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const IA_LINEA = {
  [INTENCIONES.CLASES]: 'Entendí que quieres ver las clases.',
  [INTENCIONES.RESERVA]: 'Entendí que quieres reservar un cupo.',
  [INTENCIONES.TRIAL]: 'Entendí que quieres una clase de prueba.',
  [INTENCIONES.PLANES]: 'Entendí que quieres ver los planes.',
  [INTENCIONES.HUMANO]: 'Entendí que quieres hablar con el equipo.',
  [INTENCIONES.LOOKUP]: 'Entendí que quieres consultar una reserva.',
  [INTENCIONES.MI_MEMBRESIA]: 'Entendí que quieres ver tu membresía.',
  [INTENCIONES.PAGAR]: 'Entendí que quieres pagar.',
  [INTENCIONES.MENU]: 'Entendí que quieres volver al menú.',
  [INTENCIONES.AYUDA]: 'Entendí que necesitas orientación.',
};

export function crearEngine(datosIniciales, tenantId = TENANT_DEFAULT, opts = {}) {
  const clock = opts.clock || relojActivo();
  const memoria = datosIniciales && datosIniciales.memoria
    ? datosIniciales.memoria
    : crearMemoria(datosIniciales || clonarDemo(tenantId, opts.fechaRef), { clock });
  const tid = tenantId;
  const intent = crearIntentService();
  let fechaRef = opts.fechaRef || fechaHoy((memoria.getTenant(tid) || {}).zonaHoraria, clock);

  function ahora() {
    return clock.iso();
  }

  function botMsg(texto, opciones = [], ia = false, extra = {}) {
    return formatearRespuesta({
      texto,
      opciones,
      ia,
      legal: extra.legal,
      hora: ahora(),
    });
  }

  function fecha() {
    return fechaRef;
  }

  function setFechaRef(f) {
    if (f) fechaRef = f;
  }

  function tenant() {
    return memoria.getTenant(tid) || { id: tid, sedes: [], textosBot: {}, marca: {} };
  }

  function menuOps() {
    return menuDe(tenant());
  }

  function caps() {
    return capacidadesDe(tenant());
  }

  function sedes() {
    return memoria.listarSedes(tid);
  }

  function iniciar() {
    const t = tenant();
    const lista = sedes();
    const autoSede = lista.length === 1 ? lista[0] : null;
    const sedeId = autoSede ? autoSede.id : null;
    const sedeNombre = autoSede ? autoSede.nombre : null;
    const conv = memoria.crearConversacion(tid, autoSede
      ? { sede: sedeNombre, sedeId, paso: 'menu' }
      : { paso: 'pick_sede' });
    const bienvenida = (t.textosBot && t.textosBot.bienvenida)
      || 'Hola. ¿En qué sede quieres entrenar?';
    const msg = autoSede
      ? botMsg(bienvenida, menuOps())
      : botMsg(bienvenida, sedesOps(lista));
    conv.messages.push(msg);
    return { conversacion: publicConv(conv), mensajes: [msg] };
  }

  function procesar(conversacionId, textoCrudo) {
    try {
      return procesarSeguro(conversacionId, textoCrudo);
    } catch {
      const conv = memoria.getConversacion(tid, conversacionId);
      return {
        conversacion: conv ? publicConv(conv) : null,
        mensajes: [botMsg('No te seguí del todo. Elige una opción o escríbela.', menuOps())],
      };
    }
  }

  function procesarSeguro(conversacionId, textoCrudo) {
    const conv = memoria.getConversacion(tid, conversacionId);
    if (!conv) {
      return {
        conversacion: null,
        mensajes: [botMsg('No encontramos esa conversación. Recarga e inténtalo de nuevo.')],
      };
    }

    const texto = String(textoCrudo || '').slice(0, 2000).trim();
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
    else if (esConsultaCupos(cmd) && conv.paso !== 'reserve_name' && conv.paso !== 'trial_name') {
      out = responderCupos(conv, texto);
    } else if (esConsultaMembresia(cmd) && conv.paso !== 'reserve_name' && conv.paso !== 'trial_name') {
      out = responderMembresia(conv);
    } else if (esConsultaPagar(cmd) && conv.paso !== 'reserve_name' && conv.paso !== 'trial_name') {
      out = responderPagar(conv);
    }
    else if (esKine(cmd) && conv.paso !== 'reserve_name' && conv.paso !== 'trial_name') {
      out = responderKine(conv);
    } else if (esMusculacion(cmd) && conv.paso !== 'reserve_name' && conv.paso !== 'trial_name') {
      out = responderMusculacion(conv);
    } else if (conv.status === 'waiting_human') {
      out = [botMsg('Tu solicitud ya está con el equipo. Escribe menú para volver al asistente.', [{ etiqueta: 'Menú', valor: 'menu' }])];
    } else out = continuar(conv, texto, cmd);

    const mensajes = Array.isArray(out) ? out : [out];
    for (const m of mensajes) conv.messages.push(m);
    return { conversacion: publicConv(conv), mensajes };
  }

  function continuar(conv, texto, cmd) {
    switch (conv.paso) {
      case 'pick_sede':
        return pickSede(conv, texto, cmd);
      case 'menu':
        return desdeMenu(conv, texto, cmd);
      case 'clases_dia':
        return clasesDia(conv, texto, cmd);
      case 'clases_disciplina':
        return clasesDisciplina(conv, texto, cmd);
      case 'clases_lista':
        return clasesLista(conv, texto, cmd);
      case 'planes_lista':
        return planesLista(conv, texto, cmd);
      case 'espera_name':
        return esperaName(conv, texto);
      case 'espera_phone':
        return esperaPhone(conv, texto);
      case 'reserve_disciplina':
        return reserveDisciplina(conv, texto, cmd);
      case 'reserve_dia':
        return reserveDia(conv, texto, cmd);
      case 'reserve_hora':
        return reserveHora(conv, texto, cmd);
      case 'reserve_pick_class':
        return reserveHora(conv, texto, cmd);
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
      case 'lookup_done':
        return lookupDone(conv, cmd);
      case 'cupos_phone':
        return cuposPhone(conv, texto);
      case 'membresia_phone':
        return membresiaPhone(conv, texto);
      case 'pagar_phone':
        return pagarPhone(conv, texto);
      case 'plans_info_name':
        return plansInfoName(conv, texto);
      case 'plans_info_phone':
        return plansInfoPhone(conv, texto);
      default:
        return irMenu(conv, false, 'Volvamos al menú.');
    }
  }

  function pickSede(conv, texto, cmd) {
    const sede = matchSede(cmd);
    if (!sede) {
      const det = intent.detectar(texto);
      if (det.intencion !== INTENCIONES.DESCONOCIDA && det.confianza >= 0.8) {
        conv.data.pending = det;
        return [botMsg('Primero elige una sede para continuar.', sedesOps(sedes()))];
      }
      return [botMsg('Elige una sede para continuar.', sedesOps(sedes()))];
    }
    conv.sede = sede.nombre;
    conv.sedeId = sede.id;
    conv.paso = 'menu';
    if (conv.data && conv.data.pending) {
      const det = conv.data.pending;
      conv.data.pending = null;
      return aplicarIntencion(conv, det, true);
    }
    return [botMsg(`Sede ${sede.nombre}. ¿Qué quieres hacer hoy?`, menuOps())];
  }

  function desdeMenu(conv, texto, cmd) {
    if (cmd.includes('quiero mas informacion') || cmd.includes('mas informacion')) {
      conv.paso = 'plans_info_name';
      conv.data = {};
      return [botMsg('Con gusto. ¿Cuál es tu nombre?')];
    }
    const n = menuNumero(cmd, texto);
    if (n === 1 || cmd.includes('ver clases')) return iniciarClases(conv, false, texto);
    if (n === 2 || cmd.includes('reservar mi cupo')) return iniciarReserva(conv, false, null, null, texto);
    if (n === 3 || cmd.includes('probar') || cmd.includes('gratis')) return iniciarTrial(conv, false);
    if (n === 4 || cmd.includes('ver planes')) return verPlanes(conv, false);
    if (n === 5 || cmd.includes('consultar')) return iniciarLookup(conv, false);
    if (n === 6 || cmd.includes('hablar') || cmd.includes('equipo')) return iniciarHumano(conv, false);

    const det = intent.detectar(texto);
    if (det.intencion === INTENCIONES.DESCONOCIDA) {
      const clases = memoria.listarClases(tid, conv.sede);
      if (extraerRelDia(texto) || extraerDisciplina(texto, clases)) {
        return iniciarClases(conv, false, texto);
      }
      return [botMsg('No te seguí del todo. Elige una opción o escríbela.', menuOps())];
    }
    return aplicarIntencion(conv, det, true, texto);
  }

  function aplicarIntencion(conv, det, marcarIa, texto) {
    if (det.intencion === INTENCIONES.CLASES) return iniciarClases(conv, marcarIa, texto || '');
    if (det.intencion === INTENCIONES.RESERVA) {
      return iniciarReserva(conv, marcarIa, det.entidades.clase, det.entidades.hora, texto || '');
    }
    if (det.intencion === INTENCIONES.TRIAL) return iniciarTrial(conv, marcarIa);
    if (det.intencion === INTENCIONES.PLANES) return verPlanes(conv, marcarIa);
    if (det.intencion === INTENCIONES.HUMANO) return iniciarHumano(conv, marcarIa);
    if (det.intencion === INTENCIONES.CUPOS) return responderCupos(conv, texto || '');
    if (det.intencion === INTENCIONES.MI_MEMBRESIA) return responderMembresia(conv, true);
    if (det.intencion === INTENCIONES.PAGAR) return responderPagar(conv, true);
    if (det.intencion === INTENCIONES.LOOKUP) return iniciarLookup(conv, marcarIa);
    if (det.intencion === INTENCIONES.MENU) return irMenu(conv, marcarIa);
    if (det.intencion === INTENCIONES.AYUDA) return ayuda(conv, marcarIa);
    return [botMsg('No te seguí del todo. Elige una opción.', menuOps())];
  }

  function iniciarClases(conv, ia, texto) {
    conv.data = { ...(conv.data || {}), clasesOffset: 0 };
    const clases = memoria.listarClases(tid, conv.sede);
    const disc = extraerDisciplina(texto, clases);
    const rel = extraerRelDia(texto);
    if (disc) conv.data.disciplina = disc;
    if (rel) conv.data.relDia = rel;
    return seguirClases(conv, ia);
  }

  function seguirClases(conv, ia) {
    if (!conv.data.relDia) {
      conv.paso = 'clases_dia';
      return maybeIa(ia, INTENCIONES.CLASES, [botMsg('¿Para qué día?', [
        { etiqueta: 'Hoy', valor: 'hoy' },
        { etiqueta: 'Mañana', valor: 'mañana' },
        { etiqueta: 'Otro día', valor: 'otro dia' },
      ])]);
    }
    if (conv.data.relDia === 'otro') {
      conv.paso = 'clases_dia';
      const hoy = weekdayEs(fecha());
      const man = weekdayEs(addDays(fecha(), 1));
      const ops = DIAS.filter((d) => d !== hoy && d !== man).map((d) => ({ etiqueta: d, valor: d }));
      return [botMsg('¿Qué día?', ops)];
    }
    conv.data.dia = diaSemanaDeRel(conv.data.relDia, fecha()) || conv.data.relDia;
    const clases = memoria.listarClases(tid, conv.sede);
    const discs = disciplinasDe(clases);
    if (!conv.data.disciplina && discs.length > 1) {
      conv.paso = 'clases_disciplina';
      return [botMsg('¿Qué disciplina?', discs.map((d) => ({ etiqueta: d, valor: d })))];
    }
    if (!conv.data.disciplina && discs.length === 1) conv.data.disciplina = discs[0];
    return emitirClases(conv, ia);
  }

  function clasesDia(conv, texto, cmd) {
    if (cmd.includes('otro')) {
      conv.data.relDia = 'otro';
      return seguirClases(conv, false);
    }
    const rel = extraerRelDia(texto) || extraerRelDia(cmd);
    if (!rel || rel === 'otro') {
      return [botMsg('¿Para qué día?', [
        { etiqueta: 'Hoy', valor: 'hoy' },
        { etiqueta: 'Mañana', valor: 'mañana' },
        { etiqueta: 'Otro día', valor: 'otro dia' },
      ])];
    }
    conv.data.relDia = rel;
    const disc = extraerDisciplina(texto, memoria.listarClases(tid, conv.sede));
    if (disc) conv.data.disciplina = disc;
    return seguirClases(conv, false);
  }

  function clasesDisciplina(conv, texto) {
    const clases = memoria.listarClases(tid, conv.sede);
    const disc = extraerDisciplina(texto, clases);
    if (!disc) {
      const discs = disciplinasDe(clases);
      return [botMsg('¿Qué disciplina?', discs.map((d) => ({ etiqueta: d, valor: d })))];
    }
    conv.data.disciplina = disc;
    return emitirClases(conv, false);
  }

  function emitirClases(conv, ia) {
    const disc = conv.data.disciplina;
    if (disc && /kinesiolog/i.test(normalizar(disc))) return responderKine(conv);
    if (disc && /musculacion/i.test(normalizar(disc))) return responderMusculacion(conv);

    const rows = filtrarClases(memoria.listarClases(tid, conv.sede), {
      sede: conv.sede,
      dia: conv.data.dia,
      disciplina: disc,
    }).filter((c) => c.reservable !== false)
      .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

    conv.paso = 'clases_lista';
    const offset = conv.data.clasesOffset || 0;
    const { slice, hayMas, next } = paginar(rows, offset, 5);
    conv.data.clasesNext = next;
    const titulo = `${disc || 'Clases'} · ${etiquetaDia(conv.data.relDia, fecha())}`;
    const lineas = slice.map(lineaHorario);
    let cuerpo = [titulo, ...lineas].join('\n');
    while (cuerpo.length > 400 && lineas.length > 1) {
      lineas.pop();
      cuerpo = [titulo, ...lineas].join('\n');
    }
    const ops = [];
    if (slice.some((c) => !c.agotada && c.reservable !== false)) {
      ops.push({ etiqueta: caps().etiquetaReservar, valor: '2' });
    }
    if (slice.some((c) => c.agotada)) {
      ops.push({ etiqueta: 'Lista de espera', valor: 'lista de espera' });
    }
    if (hayMas) ops.push({ etiqueta: 'Ver más', valor: 'ver mas' });
    ops.push({ etiqueta: 'Menú', valor: 'menu' });
    if (!slice.length) {
      conv.paso = 'menu';
      return maybeIa(ia, INTENCIONES.CLASES, [botMsg(`No hay ${disc || 'clases'} ese día.`, menuOps())]);
    }
    return maybeIa(ia, INTENCIONES.CLASES, [botMsg(cuerpo, ops)]);
  }

  function clasesLista(conv, texto, cmd) {
    if (cmd.includes('ver mas') || cmd === 'mas') {
      conv.data.clasesOffset = conv.data.clasesNext || 6;
      return emitirClases(conv, false);
    }
    if (cmd.includes('lista de espera')) return iniciarEspera(conv);
    if (cmd === '2' || cmd.includes('reservar')) return iniciarReserva(conv, false, conv.data.disciplina, null, '');
    const disc = extraerDisciplina(texto, memoria.listarClases(tid, conv.sede));
    if (disc) {
      conv.data.disciplina = disc;
      conv.data.clasesOffset = 0;
      return emitirClases(conv, false);
    }
    return desdeMenu(conv, texto, cmd);
  }

  function iniciarEspera(conv) {
    conv.data.esperaClase = conv.data.disciplina;
    conv.data.esperaDia = conv.data.dia;
    if (conv.usuario) {
      conv.data.nombre = conv.usuario;
      conv.paso = 'espera_phone';
      return [botMsg('¿Cuál es tu teléfono para la lista de espera?')];
    }
    conv.paso = 'espera_name';
    return [botMsg('Para la lista de espera, ¿tu nombre?')];
  }

  function iniciarReserva(conv, ia, claseNombre, hora, texto = '') {
    const prev = conv.data || {};
    conv.data = {
      phoneTries: 0,
      horasOffset: 0,
      disciplina: prev.disciplina || null,
      relDia: prev.relDia || null,
      dia: prev.dia || null,
    };
    const clases = memoria.listarClases(tid, conv.sede);
    const raw = [claseNombre, hora, texto].filter(Boolean).join(' ');
    const disc = extraerDisciplina(raw, clases);
    const rel = extraerRelDia(raw);
    const h = hora || extraerHora(raw);
    if (disc) conv.data.disciplina = disc;
    if (rel && rel !== 'otro') conv.data.relDia = rel;
    if (h) conv.data.hora = h;
    if (rel === 'otro') conv.data.relDia = 'otro';

    const directa = raw ? memoria.buscarClase(tid, conv.sede, raw) : null;
    const tieneDiaHora = Boolean(rel && rel !== 'otro' && h);
    if (directa && directa.reservable !== false && tieneDiaHora) {
      if (directa.agotada || directa.reserved >= directa.capacity) {
        conv.data.disciplina = directa.nombre;
        conv.data.relDia = directa.dia;
        conv.data.dia = directa.dia;
        return emitirHorasReserva(conv, ia);
      }
      return pedirNombreReserva(conv, directa, ia);
    }
    return seguirReserva(conv, ia);
  }

  function seguirReserva(conv, ia) {
    const clases = memoria.listarClases(tid, conv.sede).filter((c) => c.reservable !== false);
    const discs = disciplinasDe(clases);
    if (!conv.data.disciplina && discs.length > 1) {
      conv.paso = 'reserve_disciplina';
      const { opciones } = paginarOpciones(discs.map((d) => ({ etiqueta: d, valor: d })));
      return maybeIa(ia, INTENCIONES.RESERVA, [botMsg('¿Qué disciplina quieres reservar?', opciones)]);
    }
    if (!conv.data.disciplina && discs.length === 1) conv.data.disciplina = discs[0];
    if (conv.data.disciplina && /kinesiolog/i.test(normalizar(conv.data.disciplina))) return responderKine(conv);
    if (conv.data.disciplina && /musculacion/i.test(normalizar(conv.data.disciplina))) return responderMusculacion(conv);

    if (!conv.data.relDia) {
      conv.paso = 'reserve_dia';
      return maybeIa(ia, INTENCIONES.RESERVA, [botMsg('¿Para qué día?', [
        { etiqueta: 'Hoy', valor: 'hoy' },
        { etiqueta: 'Mañana', valor: 'mañana' },
        { etiqueta: 'Otro día', valor: 'otro dia' },
      ])]);
    }
    if (conv.data.relDia === 'otro') {
      conv.paso = 'reserve_dia';
      return [botMsg('¿Qué día?', proximosDiasOps())];
    }
    conv.data.dia = diaSemanaDeRel(conv.data.relDia, fecha()) || conv.data.relDia;
    return emitirHorasReserva(conv, ia);
  }

  function aplicarFiltrosReserva(conv, texto, cmd) {
    const clases = memoria.listarClases(tid, conv.sede);
    const raw = [texto, cmd].filter(Boolean).join(' ');
    const disc = extraerDisciplina(raw, clases);
    const rel = extraerRelDia(raw);
    const h = extraerHora(texto) || extraerHora(raw) || extraerHora(cmd);
    if (disc) conv.data.disciplina = disc;
    if (rel) conv.data.relDia = rel;
    if (h) conv.data.hora = h;
    const directa = raw ? memoria.buscarClase(tid, conv.sede, raw) : null;
    if (directa && directa.reservable !== false && rel && rel !== 'otro' && h) {
      if (directa.agotada || directa.reserved >= directa.capacity) {
        conv.data.disciplina = directa.nombre;
        conv.data.relDia = directa.dia;
        conv.data.dia = directa.dia;
        return emitirHorasReserva(conv, false);
      }
      return pedirNombreReserva(conv, directa, false);
    }
    return null;
  }

  function reserveDisciplina(conv, texto, cmd) {
    const salto = aplicarFiltrosReserva(conv, texto, cmd);
    if (salto) return salto;
    if (!conv.data.disciplina) {
      const discs = disciplinasDe(memoria.listarClases(tid, conv.sede).filter((c) => c.reservable !== false));
      const { opciones } = paginarOpciones(discs.map((d) => ({ etiqueta: d, valor: d })));
      return [botMsg('¿Qué disciplina quieres reservar?', opciones)];
    }
    return seguirReserva(conv, false);
  }

  function reserveDia(conv, texto, cmd) {
    if (cmd.includes('otro') && !extraerDisciplina(texto, memoria.listarClases(tid, conv.sede))) {
      conv.data.relDia = 'otro';
      return seguirReserva(conv, false);
    }
    const salto = aplicarFiltrosReserva(conv, texto, cmd);
    if (salto) return salto;
    if (!conv.data.relDia || conv.data.relDia === 'otro') {
      if (conv.data.relDia === 'otro') return [botMsg('¿Qué día?', proximosDiasOps())];
      return [botMsg('¿Para qué día?', [
        { etiqueta: 'Hoy', valor: 'hoy' },
        { etiqueta: 'Mañana', valor: 'mañana' },
        { etiqueta: 'Otro día', valor: 'otro dia' },
      ])];
    }
    return seguirReserva(conv, false);
  }

  function emitirHorasReserva(conv, ia) {
    const rows = filtrarClases(memoria.listarClases(tid, conv.sede), {
      sede: conv.sede,
      dia: conv.data.dia,
      disciplina: conv.data.disciplina,
    }).filter((c) => c.reservable !== false)
      .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

    if (!rows.length) {
      conv.paso = 'reserve_dia';
      conv.data.relDia = null;
      conv.data.dia = null;
      return [botMsg(`No hay ${conv.data.disciplina} ese día. Elige otro.`, [
        { etiqueta: 'Hoy', valor: 'hoy' },
        { etiqueta: 'Mañana', valor: 'mañana' },
        { etiqueta: 'Otro día', valor: 'otro dia' },
      ])];
    }

    conv.paso = 'reserve_hora';
    const offset = conv.data.horasOffset || 0;
    const { slice, hayMas, next } = paginar(rows, offset, 10);
    conv.data.horasNext = next;
    const ops = slice.map((c) => {
      const libres = Math.max(0, (c.capacity || 0) - (c.reserved || 0));
      const full = c.agotada || libres === 0;
      const coach = c.entrenador || '';
      return {
        etiqueta: full
          ? `${c.hora} · completa`
          : (coach ? `${c.hora} · ${coach}` : `${c.hora} · ${libres} libres`),
        descripcion: full ? 'lista de espera' : `${libres} libres`,
        valor: full ? `espera ${c.id}` : `${c.nombre} ${c.dia} ${c.hora}`,
      };
    });
    if (hayMas) ops.push({ etiqueta: 'Ver más', valor: 'ver mas' });
    const titulo = `Horarios ${conv.data.disciplina} · ${etiquetaDia(conv.data.relDia || conv.data.dia, fecha())}`;
    return maybeIa(ia, INTENCIONES.RESERVA, [botMsg(titulo, ops)]);
  }

  function reserveHora(conv, texto, cmd) {
    if (cmd.includes('ver mas') || cmd === 'mas') {
      conv.data.horasOffset = conv.data.horasNext || 10;
      return emitirHorasReserva(conv, false);
    }
    if (cmd.startsWith('espera ')) {
      conv.data.esperaClase = conv.data.disciplina;
      conv.data.esperaDia = conv.data.dia;
      return iniciarEspera(conv);
    }
    const clase = pickHora(conv, texto, cmd);
    if (!clase) return emitirHorasReserva(conv, false);
    if (clase.reservable === false) {
      if (clase.conHora) return responderKine(conv);
      if (clase.accesoLibre) return responderMusculacion(conv);
      return [botMsg('Esa actividad no se reserva por el asistente.', menuOps())];
    }
    if (clase.agotada || clase.reserved >= clase.capacity) {
      conv.data.esperaClase = clase.nombre;
      conv.data.esperaDia = clase.dia;
      return iniciarEspera(conv);
    }
    return pedirNombreReserva(conv, clase, false);
  }

  function pickHora(conv, texto, cmd) {
    const rows = filtrarClases(memoria.listarClases(tid, conv.sede), {
      sede: conv.sede,
      dia: conv.data.dia,
      disciplina: conv.data.disciplina,
    }).filter((c) => c.reservable !== false);
    const exacta = rows.find((c) => normalizar(`${c.nombre} ${c.dia} ${c.hora}`) === cmd);
    if (exacta) return exacta;
    const h = extraerHora(cmd) || extraerHora(normalizar(texto));
    if (h) {
      const byH = rows.find((c) => c.hora === h);
      if (byH) return byH;
    }
    return pickClase(conv.sede, texto, cmd, true);
  }

  function pedirNombreReserva(conv, clase, ia) {
    conv.data.claseId = clase.id;
    conv.paso = 'reserve_name';
    const linea = `${clase.nombre}, ${clase.dia} ${clase.hora}`;
    return maybeIa(ia, INTENCIONES.RESERVA, [
      botMsg(`Vas a reservar ${linea}. ¿Cuál es tu nombre?`),
    ]);
  }

  function proximosDiasOps() {
    const ops = [];
    for (let i = 1; i <= 8 && ops.length < 7; i += 1) {
      const d = addDays(fecha(), i);
      const wd = weekdayEs(d);
      if (wd === 'Domingo') continue;
      ops.push({ etiqueta: `${wd} ${dayNum(d)}`, valor: wd });
    }
    return ops;
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
        return [botMsg('No pude validar el teléfono. Volvamos al menú.', menuOps())];
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
    const clase = memoria.getClase(tid, conv.data.claseId);
    const resumen = [
      'Resumen de tu reserva:',
      `• Sede: ${conv.sede}`,
      `• Clase: ${clase.nombre}`,
      `• ${clase.dia} ${clase.hora}`,
      `• Nombre: ${conv.data.nombre}`,
      `• Teléfono: ${conv.data.telefono}`,
    ].join('\n');
    return [botMsg(resumen, [
      { etiqueta: 'Confirmar', valor: 'confirmar' },
      { etiqueta: 'Cambiar hora', valor: 'cambiar hora' },
      { etiqueta: 'Cancelar', valor: 'cancelar' },
    ], false, { legal: true })];
  }

  function reserveConfirm(conv, cmd) {
    if (cmd === 'cancelar' || cmd === 'no') {
      conv.data = {};
      return irMenu(conv, false, 'Cancelé la reserva.');
    }
    if (cmd.includes('cambiar hora') || cmd === 'cambiar') {
      conv.data.horasOffset = 0;
      const clase = memoria.getClase(tid, conv.data.claseId);
      if (clase) {
        conv.data.disciplina = clase.nombre;
        conv.data.dia = clase.dia;
        conv.data.relDia = clase.dia;
      }
      return emitirHorasReserva(conv, false);
    }
    if (cmd !== 'confirmar' && cmd !== 'si' && cmd !== 'confirmar reserva') {
      return [botMsg('Para seguir, confirma o cancela.', [
        { etiqueta: 'Confirmar', valor: 'confirmar' },
        { etiqueta: 'Cambiar hora', valor: 'cambiar hora' },
        { etiqueta: 'Cancelar', valor: 'cancelar' },
      ])];
    }
    const result = memoria.confirmarReserva(tid, {
      claseId: conv.data.claseId,
      nombre: conv.data.nombre,
      telefono: conv.data.telefono,
      email: conv.data.email,
      sede: conv.sede,
    });
    conv.paso = 'menu';
    conv.data = {};
    if (!result.ok) return [botMsg(result.error, menuOps())];
    const fuego = caps().emojiReserva ? '🔥 ' : '';
    let texto = `${fuego}¡LISTO! TU CUPO ESTÁ RESERVADO.\nCódigo ${result.booking.codigo}`;
    if (result.cuposRestantes != null) {
      texto += `\nTe quedan ${result.cuposRestantes} cupos este mes.`;
    }
    return [botMsg(texto, menuOps(), false, { legal: true })];
  }

  function iniciarTrial(conv, ia) {
    conv.data = { phoneTries: 0 };
    conv.paso = 'trial_name';
    const txt = caps().textoTrialNombre;
    return maybeIa(ia, INTENCIONES.TRIAL, [botMsg(txt)]);
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
        return [botMsg('No pude validar el teléfono. Volvamos al menú.', menuOps())];
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
    const discs = disciplinasDe(memoria.listarClases(tid, conv.sede).filter((c) => c.reservable !== false));
    const { opciones } = paginarOpciones(discs.map((d) => ({ etiqueta: d, valor: d })));
    return [botMsg('¿Qué clase te gustaría probar?', opciones)];
  }

  function trialClass(conv, texto, cmd) {
    const clase = pickClase(conv.sede, texto, cmd, false);
    if (!clase) {
      const discs = disciplinasDe(memoria.listarClases(tid, conv.sede).filter((c) => c.reservable !== false));
      const { opciones } = paginarOpciones(discs.map((d) => ({ etiqueta: d, valor: d })));
      return [botMsg('Elige una clase de la sede.', opciones)];
    }
    conv.data.clase = clase.nombre;
    conv.paso = 'trial_day';
    return [botMsg('¿Qué día te acomoda?', DIAS.map((d) => ({ etiqueta: d, valor: d })))];
  }

  function trialDay(conv, texto, cmd) {
    const dia = DIAS.find((d) => normalizar(d) === cmd) || DIAS.find((d) => cmd.includes(normalizar(d)));
    if (!dia) return [botMsg('Elige un día de lunes a sábado.', DIAS.map((d) => ({ etiqueta: d, valor: d })))];
    memoria.crearLead(tid, {
      nombre: conv.data.nombre,
      telefono: conv.data.telefono,
      objetivo: conv.data.objetivo,
      clase: conv.data.clase,
      dia,
      sede: conv.sede,
    });
    conv.paso = 'menu';
    conv.data = {};
    const fuego = caps().emojiReserva ? '🔥 ' : '';
    return [botMsg(`${fuego}¡LISTO! Registramos tu solicitud de clase de prueba. Un ejecutivo podrá contactarte para coordinarla.`, menuOps())];
  }

  function verPlanes(conv, ia) {
    conv.data = { ...(conv.data || {}), planesOffset: 0 };
    return emitirPlanes(conv, ia);
  }

  function emitirPlanes(conv, ia) {
    const planes = memoria.listarPlanes(tid);
    const grupos = agruparPlanes(planes);
    const flat = grupos.flatMap((g) => g.items.map((p) => ({ ...p, familia: g.familia })));
    conv.paso = 'planes_lista';
    const offset = conv.data.planesOffset || 0;
    const { slice, hayMas, next } = paginar(flat, offset, 3);
    conv.data.planesNext = next;
    const byFam = new Map();
    for (const p of slice) {
      if (!byFam.has(p.familia)) byFam.set(p.familia, []);
      byFam.get(p.familia).push(p);
    }
    const partes = [];
    for (const [fam, items] of byFam) {
      partes.push(fam);
      for (const p of items) partes.push(lineaPlan(p));
    }
    partes.push((tenant().textosBot && tenant().textosBot.valoresPlanes) || i18n.valoresDemo);
    const ops = [{ etiqueta: 'Más información', valor: 'quiero mas informacion' }];
    if (hayMas) ops.push({ etiqueta: 'Ver más', valor: 'ver mas planes' });
    ops.push({ etiqueta: 'Menú', valor: 'menu' });
    return maybeIa(ia, INTENCIONES.PLANES, [botMsg(partes.join('\n'), ops)]);
  }

  function planesLista(conv, texto, cmd) {
    if (cmd.includes('ver mas')) {
      conv.data.planesOffset = conv.data.planesNext || 4;
      return emitirPlanes(conv, false);
    }
    if (cmd.includes('quiero mas informacion') || cmd.includes('mas informacion')) {
      conv.paso = 'plans_info_name';
      conv.data = {};
      return [botMsg('Con gusto. ¿Cuál es tu nombre?')];
    }
    return desdeMenu(conv, texto, cmd);
  }

  function esperaName(conv, texto) {
    if (!nombreValido(texto)) return [botMsg('El nombre debe tener entre 2 y 60 caracteres.')];
    conv.data.nombre = texto.trim();
    conv.usuario = conv.data.nombre;
    conv.paso = 'espera_phone';
    return [botMsg('¿Tu teléfono?')];
  }

  function esperaPhone(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (!tel) return [botMsg('Teléfono no válido. Usa +56 9 XXXX XXXX.')];
    memoria.crearLead(tid, {
      nombre: conv.data.nombre || conv.usuario || 'Lista de espera',
      telefono: tel,
      objetivo: 'Lista de espera',
      clase: conv.data.esperaClase || conv.data.disciplina || '—',
      dia: conv.data.esperaDia || conv.data.dia || '—',
      sede: conv.sede,
    });
    conv.paso = 'menu';
    conv.data = {};
    return [botMsg('Quedaste en lista de espera. El equipo te avisa si se libera un cupo.', menuOps())];
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
    memoria.crearLead(tid, {
      nombre: conv.data.nombre,
      telefono: tel,
      objetivo: 'Información de planes',
      clase: '—',
      dia: '—',
      sede: conv.sede,
    });
    conv.paso = 'menu';
    conv.data = {};
    return [botMsg('Quedó registrado. Un ejecutivo te contactará.', menuOps())];
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
    if (conv.telefono) return listarReservasPropias(conv, ia);
    conv.paso = 'lookup_code';
    return maybeIa(ia, INTENCIONES.LOOKUP, [botMsg('Ingresa tu teléfono o el código de la reserva.')]);
  }

  function lookupCode(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (tel) {
      conv.telefono = tel;
      return listarReservasPropias(conv, false);
    }
    const b = memoria.buscarReserva(tid, texto);
    if (!b) {
      conv.paso = 'menu';
      return [botMsg('No encontramos una reserva con ese código.', menuOps())];
    }
    conv.data.codigoCancel = b.codigo;
    conv.paso = 'lookup_done';
    const ops = b.estado === 'confirmada'
      ? [{ etiqueta: 'Cancelar reserva', valor: 'cancelar reserva' }, { etiqueta: 'Menú', valor: 'menu' }]
      : menuOps();
    return [botMsg(`${b.codigo}\n${b.clase} · ${b.dia} ${b.hora}\n${b.estado}`, ops)];
  }

  function listarReservasPropias(conv, ia) {
    const rows = memoria.listarReservas(tid)
      .filter((b) => b.telefono === conv.telefono && b.estado === 'confirmada')
      .slice(0, 9);
    if (!rows.length) {
      conv.paso = 'lookup_code';
      return maybeIa(ia, INTENCIONES.LOOKUP, [botMsg('No hay reservas activas. Ingresa un código.')]);
    }
    conv.paso = 'lookup_done';
    const ops = rows.map((b) => ({
      etiqueta: b.codigo,
      descripcion: `${b.clase} ${b.dia} ${b.hora}`,
      valor: `cancelar ${b.codigo}`,
    }));
    ops.push({ etiqueta: 'Menú', valor: 'menu' });
    return maybeIa(ia, INTENCIONES.LOOKUP, [botMsg('Tus reservas. Elige una para cancelar.', ops)]);
  }

  function lookupDone(conv, cmd) {
    const cancelCodigo = cmd.startsWith('cancelar ') && cmd !== 'cancelar reserva'
      ? cmd.replace(/^cancelar\s+/, '').trim()
      : (cmd.includes('cancelar reserva') ? conv.data.codigoCancel : null);
    if (cancelCodigo) {
      const r = memoria.cancelarReserva(tid, cancelCodigo);
      conv.paso = 'menu';
      conv.data = {};
      if (!r.ok) return [botMsg(r.error, menuOps())];
      return [botMsg('Cancelé la reserva y devolví el cupo del plan.', menuOps())];
    }
    return irMenu(conv, false);
  }

  function responderCupos(conv) {
    const tel = conv.telefono;
    if (!tel) {
      conv.paso = 'cupos_phone';
      return [botMsg('¿Cuál es tu teléfono para revisar tus cupos?')];
    }
    return informarCupos(conv, tel);
  }

  function cuposPhone(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (!tel) return [botMsg('Teléfono no válido. Usa +56 9 XXXX XXXX.')];
    conv.telefono = tel;
    return informarCupos(conv, tel);
  }

  function informarCupos(conv, tel) {
    conv.paso = 'menu';
    const socio = memoria.buscarSocioPorTelefono(tid, tel);
    if (!socio || socio.estado === 'baja') {
      return [botMsg('No encontramos un plan asociado a ese teléfono.', menuOps())];
    }
    const plan = (memoria.listarPlanes(tid) || []).find((p) => p.id === socio.planId);
    if (!plan || plan.cuposMes == null) {
      return [botMsg('Tu plan no limita cupos mensuales. Se renuevan el 1 de cada mes.', menuOps())];
    }
    const quedan = Math.max(0, plan.cuposMes - (socio.cuposUsadosMes || 0));
    return [botMsg(
      `Te quedan ${quedan} de ${plan.cuposMes} cupos este mes. Se renuevan el 1 de cada mes.`,
      menuOps(),
    )];
  }

  function responderMembresia(conv, ia = false) {
    const tel = conv.telefono;
    if (!tel) {
      conv.paso = 'membresia_phone';
      return maybeIa(ia, INTENCIONES.MI_MEMBRESIA, [botMsg('¿Cuál es tu teléfono para revisar tu membresía?')]);
    }
    return informarMembresia(conv, tel, ia);
  }

  function membresiaPhone(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (!tel) return [botMsg('Teléfono no válido. Usa +56 9 XXXX XXXX.')];
    conv.telefono = tel;
    return informarMembresia(conv, tel, false);
  }

  function informarMembresia(conv, tel, ia) {
    conv.paso = 'menu';
    const r = memoria.resumenMembresiaChat(tid, tel, fecha());
    if (!r.ok) return maybeIa(ia, INTENCIONES.MI_MEMBRESIA, [botMsg(r.error, menuOps())]);
    return maybeIa(ia, INTENCIONES.MI_MEMBRESIA, [botMsg(r.texto, menuOps())]);
  }

  function responderPagar(conv, ia = false) {
    const tel = conv.telefono;
    if (!tel) {
      conv.paso = 'pagar_phone';
      return maybeIa(ia, INTENCIONES.PAGAR, [botMsg('¿Cuál es tu teléfono para generar el pago?')]);
    }
    return informarPagar(conv, tel, ia);
  }

  function pagarPhone(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (!tel) return [botMsg('Teléfono no válido. Usa +56 9 XXXX XXXX.')];
    conv.telefono = tel;
    return informarPagar(conv, tel, false);
  }

  function informarPagar(conv, tel, ia) {
    conv.paso = 'menu';
    const r = memoria.responderPagarChat(tid, tel, fecha());
    if (!r.ok) return maybeIa(ia, INTENCIONES.PAGAR, [botMsg(r.error, menuOps())]);
    return maybeIa(ia, INTENCIONES.PAGAR, [botMsg(r.texto, menuOps())]);
  }

  function ayuda(conv, ia = false) {
    conv.paso = conv.sede ? 'menu' : 'pick_sede';
    return maybeIa(ia, INTENCIONES.AYUDA, [
      botMsg(
        'Puedo mostrarte clases, reservar un cupo, agendar una clase de prueba, ver planes o derivarte a un ejecutivo.',
        conv.sede ? menuOps() : sedesOps(sedes()),
      ),
    ]);
  }

  function irMenu(conv, ia, preface) {
    if (conv.status === 'waiting_human') conv.status = 'active';
    if (!conv.sede) {
      const lista = sedes();
      if (lista.length === 1) {
        conv.sede = lista[0].nombre;
        conv.sedeId = lista[0].id;
        conv.paso = 'menu';
      } else {
        conv.paso = 'pick_sede';
        return [botMsg('¿En qué sede quieres entrenar?', sedesOps(lista))];
      }
    }
    conv.paso = 'menu';
    conv.data = {};
    const t = preface ? `${preface}\n\n¿Qué quieres hacer hoy?` : '¿Qué quieres hacer hoy?';
    return maybeIa(ia, INTENCIONES.MENU, [botMsg(t, menuOps())]);
  }

  function responderKine(conv) {
    conv.motivo = 'Kinesiología con hora';
    conv.status = 'waiting_human';
    conv.paso = 'done';
    const sedeRef = conv.sedeId || conv.sede;
    memoria.crearAccion(tid, {
      agente: 'recordatorio',
      tipo: 'tarea_equipo',
      socioId: null,
      texto: null,
      motivo: `Derivar consulta de Kinesiología${conv.usuario ? ` de ${conv.usuario}` : ''} en ${conv.sede || nombreSede(tenant(), sedeRef)}.`,
      prioridad: 'alta',
      sedeId: sedeRef,
    });
    return [botMsg(
      'Kinesiología se atiende con hora, no se reserva por el asistente. Dejamos la solicitud al equipo para coordinarla.',
      [{ etiqueta: 'Menú', valor: 'menu' }],
    )];
  }

  function responderMusculacion(conv) {
    conv.paso = 'menu';
    return [botMsg(
      'Musculación es acceso libre de 06:30 a 22:00, lunes a sábado. No se reserva cupo.',
      menuOps(),
    )];
  }

  function pickClase(sede, texto, cmd, soloReservable) {
    let clases = memoria.listarClases(tid, sede);
    if (soloReservable) clases = clases.filter((c) => c.reservable !== false);
    const exacta = clases.find((c) => normalizar(`${c.nombre} ${c.dia} ${c.hora}`) === cmd);
    if (exacta) return exacta;
    const n = Number.parseInt(cmd, 10);
    if (Number.isInteger(n) && n >= 1 && n <= clases.length && clases.length <= 10) return clases[n - 1];
    return (
      clases.find((c) => normalizar(c.nombre) === cmd && (!extraerHora(cmd) || c.hora === extraerHora(cmd)))
      || memoria.buscarClase(tid, sede, texto)
      || clases.find((c) => cmd.includes(normalizar(c.nombre)))
    );
  }

  function maybeIa(ia, intencion, mensajes) {
    if (!ia || !mensajes.length) return mensajes;
    const linea = IA_LINEA[intencion];
    if (!linea) return mensajes;
    const mix = `${linea}\n${mensajes[0].texto}`;
    if (mix.split('\n').length <= 6 && mix.length <= 400) {
      mensajes[0] = botMsg(mix, mensajes[0].opciones, true, { legal: mensajes[0].legal });
    } else {
      mensajes[0] = { ...mensajes[0], ia: true };
    }
    return mensajes;
  }

  function matchSede(cmd) {
    const lista = sedes();
    const t = tenant();
    for (const s of lista) {
      const n = normalizar(s.nombre);
      if (cmd === n || cmd.includes(n) || n.split(' ').some((p) => p.length > 3 && cmd.includes(p))) {
        return s;
      }
      for (const alias of s.alias || []) {
        const a = normalizar(alias);
        if (a && (cmd === a || cmd.includes(a))) return s;
      }
      if (cmd === normalizar(s.id)) return s;
    }
    // Coincidencia por fragmentos de aliases históricos de la config
    const hist = (t.aliasHistoricos && t.aliasHistoricos.sedes) || {};
    for (const [nombreHist, sedeId] of Object.entries(hist)) {
      const n = normalizar(nombreHist);
      if (n && (cmd.includes(n) || n.split(' ').some((p) => p.length > 3 && cmd.includes(p)))) {
        return lista.find((s) => s.id === sedeId) || null;
      }
    }
    return null;
  }

  return {
    tenantId: tid,
    iniciar,
    procesar,
    listarClases: (sede) => memoria.listarClases(tid, sede),
    listarPlanes: () => memoria.listarPlanes(tid),
    listarReservas: () => memoria.listarReservas(tid),
    listarLeads: () => memoria.listarLeads(tid),
    listarConversaciones: () => memoria.listarConversaciones(tid),
    listarSedes: () => memoria.listarSedes(tid),
    listarSocios: () => memoria.listarSocios(tid),
    listarMembresias: (fecha) => memoria.listarMembresias(tid, fecha),
    listarPagos: () => memoria.listarPagos(tid),
    filtrarSocios: (f, fecha) => memoria.filtrarSocios(tid, f, fecha),
    fichaSocio: (id, fecha) => memoria.fichaSocio(tid, id, fecha),
    altaSocio: (datos, fecha) => memoria.altaSocio(tid, datos, fecha),
    editarSocio: (id, datos) => memoria.editarSocio(tid, id, datos),
    bajaSocio: (id, motivo, fecha) => memoria.bajaSocio(tid, id, motivo, fecha),
    reactivarSocio: (id) => memoria.reactivarSocio(tid, id),
    importarSociosCsv: (csv, fecha) => memoria.importarSociosCsv(tid, csv, fecha),
    marcarPagado: (id, ref, fecha) => memoria.marcarPagado(tid, id, ref, fecha),
    enviarLinkPago: (id, opts) => memoria.enviarLinkPago(tid, id, opts),
    pagarDemo: (ref, fecha) => memoria.pagarDemo(tid, ref, fecha),
    conciliacionMes: (fecha) => memoria.conciliacionMes(tid, fecha),
    exportarPagosCsv: (fecha) => memoria.exportarPagosCsv(tid, fecha),
    datosBancarios: () => memoria.datosBancarios(tid),
    getTenant: () => tenant(),
    reset() {
      if (memoria.hidratarTenant) memoria.hidratarTenant(tid, clonarDemo(tid, fechaRef));
      else memoria.hidratar({ tenants: memoria.listarTenants(), byTenant: { [tid]: clonarDemo(tid, fechaRef) } });
    },
    exportar() { return memoria.sliceExport(tid); },
    /** Compat: slice → hidratarTenant; mundo con byTenant → hidratar mundo. */
    hidratar(datos) {
      if (datos && datos.byTenant) memoria.hidratar(datos);
      else if (memoria.hidratarTenant) memoria.hidratarTenant(tid, datos);
      else memoria.hidratar(datos);
    },
    setFechaRef,
    fecha,
    cancelarReserva: (codigo) => memoria.cancelarReserva(tid, codigo),
    memoria,
    intent,
  };
}

function publicConv(conv) {
  return clonar({
    id: conv.id,
    tenantId: conv.tenantId,
    sede: conv.sede,
    status: conv.status,
    paso: conv.paso,
    usuario: conv.usuario,
    telefono: conv.telefono,
    motivo: conv.motivo,
  });
}

function sedesOps(lista) {
  return lista.map((s) => ({ etiqueta: `📍 ${s.nombre}`, valor: s.nombre }));
}

function menuNumero(cmd, texto) {
  const t = String(texto || '').trim();
  if (/^[1-6]$/.test(t) || /^[1-6]$/.test(cmd)) return Number(t || cmd);
  return null;
}

function extraerHora(cmd) {
  const s = String(cmd || '');
  const m = s.match(/\b(\d{1,2}):(\d{2})\b/) || s.match(/\b(\d{1,2})\s+(\d{2})\b/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function esKine(cmd) {
  return cmd.includes('kinesiolog');
}

function esMusculacion(cmd) {
  return cmd.includes('musculacion') || cmd.includes('musculación');
}

function esConsultaCupos(cmd) {
  return cmd.includes('cuantos cupos') || cmd.includes('cupos me quedan') || cmd.includes('mis cupos') || cmd.includes('cupos del plan');
}

function esConsultaMembresia(cmd) {
  return cmd.includes('mi membresia') || cmd.includes('mi plan') || cmd.includes('estado de mi plan');
}

function esConsultaPagar(cmd) {
  return cmd === 'pagar' || cmd.includes('quiero pagar') || cmd.includes('link de pago') || cmd.includes('datos de transferencia');
}

function lineaPlan(p) {
  const bits = [p.nombre, p.precio];
  if (p.cuposMes) bits.push(`${p.cuposMes} cupos/mes`);
  return `• ${bits.join(' · ')}`;
}
