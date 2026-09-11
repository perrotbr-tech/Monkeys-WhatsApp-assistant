'use strict';

const { INTENTS } = require('../ai/intents');
const { createAIIntentService } = require('../ai/createAIIntentService');
const { sanitizeInterpretation } = require('../ai/sanitizeInterpretation');
const { MemorySessionStore } = require('./MemorySessionStore');
const { createGymServices } = require('../gym/services');

const MENU_TEXT = [
  '🐒 *Monkeys* — asistente',
  '',
  'Puedo ayudarte a:',
  '1. Ver clases y horarios',
  '2. Reservar una clase',
  '3. Pedir una clase de prueba',
  '4. Ver planes y precios',
  '5. Hablar con una persona del equipo',
  '',
  'Escribí el número o pedímelo en lenguaje natural.',
  'Ejemplo: "quiero entrenar mañana"',
].join('\n');

const MENU_BY_DIGIT = {
  1: INTENTS.CONSULT_CLASSES,
  2: INTENTS.RESERVE,
  3: INTENTS.TRIAL_CLASS,
  4: INTENTS.PLANS,
  5: INTENTS.HUMAN_HANDOFF,
};

function normalizeCommand(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function isGreeting(t) {
  return /^(hola|hello|hi|hey|buen dia|buenas|buenas tardes|buenas noches|menu|ayuda|help|\?)$/.test(t);
}

function isCancel(t) {
  return /^(cancelar|cancel|volver|salir|reset)$/.test(t);
}

function isAffirmative(t) {
  return /^(si|sí|ok|dale|confirmo|confirmar|yes|de una)$/.test(t);
}

function isNegative(t) {
  return /^(no|nop|nel|cancelar)$/.test(t);
}

/**
 * Routes detected intents to deterministic flows.
 * The AI layer never confirms bookings, quotes prices, or mutates cupos.
 */
function createConversationEngine(deps = {}) {
  const intentService = deps.intentService || createAIIntentService({ aiProvider: 'demo' });
  const sessions = deps.sessions || new MemorySessionStore();
  const gym = deps.gym || createGymServices({ now: deps.now });
  const now = deps.now || (() => new Date());

  async function handleMessage({ userId, channel = 'http', text }) {
    const session = sessions.get(userId, channel);
    const raw = String(text || '').trim();
    const cmd = normalizeCommand(raw);

    if (!raw) {
      return respond({
        reply: 'No recibí texto. Escribí *menu* para ver opciones.',
        source: 'deterministic',
        session,
      });
    }

    if (isCancel(cmd) || (session.handoff && isGreeting(cmd))) {
      sessions.reset(session);
      return respond({
        reply: `Listo, volvemos al inicio.\n\n${MENU_TEXT}`,
        source: 'deterministic',
        session,
      });
    }

    if (session.handoff) {
      return respond({
        reply: 'Tu consulta ya está con el equipo. Escribí *menu* para volver al asistente.',
        source: 'deterministic',
        session,
        flow: 'human_handoff',
        handoff: true,
      });
    }

    if (isGreeting(cmd)) {
      sessions.reset(session);
      return respond({ reply: MENU_TEXT, source: 'deterministic', session });
    }

    if (session.activeFlow) {
      const continued = await continueFlow(session, raw, cmd);
      if (continued) return continued;
    }

    if (/^[1-5]$/.test(cmd) && !session.activeFlow) {
      const intent = MENU_BY_DIGIT[cmd];
      return startFromIntent(session, {
        intent,
        confidence: 1,
        entities: {},
        provider: 'deterministic-menu',
      }, raw, 'deterministic');
    }

    const interpretation = sanitizeInterpretation(await intentService.interpret(raw, { session }));
    return startFromIntent(session, interpretation, raw, 'ai');
  }

  async function continueFlow(session, raw, cmd) {
    if (session.activeFlow === 'reserve' || session.activeFlow === 'trial_class') {
      return continueReserve(session, raw, cmd);
    }
    return null;
  }

  async function startFromIntent(session, interpretation, raw, source) {
    const intent = interpretation.intent;

    if (intent === INTENTS.UNKNOWN) {
      return respond({
        reply: `No estoy seguro de lo que necesitás.\n\n${MENU_TEXT}`,
        source,
        interpretation,
        session,
      });
    }

    if (intent === INTENTS.CONSULT_CLASSES) {
      return consultClasses(session, interpretation, source);
    }
    if (intent === INTENTS.RESERVE) {
      return startReserve(session, interpretation, source, { trial: false });
    }
    if (intent === INTENTS.TRIAL_CLASS) {
      return startReserve(session, interpretation, source, { trial: true });
    }
    if (intent === INTENTS.PLANS) {
      return showPlans(session, interpretation, source);
    }
    if (intent === INTENTS.HUMAN_HANDOFF) {
      return handoff(session, interpretation, source, raw);
    }
    if (intent === INTENTS.GENERAL_QUESTION) {
      return generalQuestion(session, interpretation, source);
    }

    return respond({
      reply: MENU_TEXT,
      source,
      interpretation,
      session,
    });
  }

  function consultClasses(session, interpretation, source) {
    sessions.reset(session);
    const activityId = interpretation.entities.activity || null;
    const dateHint = interpretation.entities.dateHint || 'today';
    const date = gym.resolveDateHint(dateHint);
    const slots = gym.listSlots({ activityId, fromDate: date });

    let reply;
    if (slots.length === 0) {
      const when = gym.formatDateEs(date);
      const activity = activityId && gym.ACTIVITIES[activityId]
        ? gym.ACTIVITIES[activityId].name
        : 'clases';
      reply = `No hay ${activity} cargadas para ${when}. El domingo no hay grilla. Probá otro día o escribí *menu*.`;
    } else {
      reply = formatSlotList(slots, {
        heading: activityId
          ? `📅 ${gym.ACTIVITIES[activityId].name} — ${gym.formatDateEs(date)}`
          : `📅 Clases — ${gym.formatDateEs(date)}`,
        footer: 'Si querés reservar, escribí por ejemplo "reservar spinning" o el número 2 del menú.',
      });
    }

    return respond({
      reply,
      source,
      interpretation,
      session,
      flow: 'consult_classes',
    });
  }

  function showPlans(session, interpretation, source) {
    sessions.reset(session);
    const lines = ['💳 Planes Monkeys (catálogo, no inventados por la IA):', ''];
    for (const plan of gym.listPlans()) {
      lines.push(`• *${plan.name}* — ${plan.priceLabel}`);
      lines.push(`  ${plan.detail}`);
    }
    lines.push('', 'Las reservas se confirman solo con el servicio de cupos, no con la IA.');
    return respond({
      reply: lines.join('\n'),
      source,
      interpretation,
      session,
      flow: 'plans',
    });
  }

  function generalQuestion(session, interpretation, source) {
    sessions.reset(session);
    const topic = interpretation.entities.topic;
    const answer = topic ? gym.answer(topic) : null;
    const reply = answer
      || 'Puedo contar ubicación, horarios de atención, estacionamiento o planes. Si no alcanza, escribí "hablar con alguien".';
    return respond({
      reply,
      source,
      interpretation,
      session,
      flow: 'general',
    });
  }

  function handoff(session, interpretation, source, raw) {
    const ticket = gym.openHandoff({ userId: session.userId, lastMessage: raw });
    session.activeFlow = null;
    session.step = null;
    session.data = { ticketId: ticket.id };
    session.handoff = true;
    const reply = [
      'Te derivo con una persona del equipo de Monkeys.',
      `Ticket *${ticket.id}* registrado.`,
      '',
      'En esta demo no hay un operador real conectado: el bot deja de resolver operaciones críticas hasta que escribas *menu*.',
    ].join('\n');
    return respond({
      reply,
      source,
      interpretation,
      session,
      flow: 'human_handoff',
      handoff: true,
    });
  }

  function startReserve(session, interpretation, source, { trial }) {
    session.activeFlow = trial ? 'trial_class' : 'reserve';
    session.data = {
      trial,
      activityId: interpretation.entities.activity || null,
      dateHint: interpretation.entities.dateHint || null,
      timeHint: interpretation.entities.timeHint || null,
    };

    const intro = trial
      ? 'La clase de prueba es *gratis (1 por persona)* y se reserva con cupo real, no lo confirma la IA.\n\n'
      : '';

    if (!session.data.activityId) {
      session.step = 'pick_activity';
      const names = gym.listActivities().map((a) => a.name).join(', ');
      return respond({
        reply: `${intro}¿Qué clase querés ${trial ? 'probar' : 'reservar'}? Tenemos: ${names}.`,
        source,
        interpretation,
        session,
        flow: session.activeFlow,
      });
    }

    return presentSlots(session, interpretation, source, intro);
  }

  function presentSlots(session, interpretation, source, intro = '') {
    const { activityId, dateHint, timeHint } = session.data;
    const date = gym.resolveDateHint(dateHint || 'today');
    let slots = gym.listSlots({ activityId, fromDate: date });

    if (timeHint) {
      const filtered = slots.filter((s) => s.time === timeHint);
      if (filtered.length) slots = filtered;
    }

    if (slots.length === 0) {
      const activityName = gym.ACTIVITIES[activityId]?.name || activityId;
      session.step = 'pick_activity';
      return respond({
        reply: `${intro}No hay cupos de ${activityName} para ${gym.formatDateEs(date)}. Elegí otra clase o día (hoy / mañana / un día de la semana).`,
        source,
        interpretation,
        session,
        flow: session.activeFlow,
      });
    }

    session.data.candidates = slots;
    session.step = 'pick_slot';
    const heading = `${intro}Cupos reales de ${gym.ACTIVITIES[activityId].name} — ${gym.formatDateEs(date)}:`;
    return respond({
      reply: formatSlotList(slots, {
        heading,
        numbered: true,
        footer: 'Respondé con el número. Escribí *cancelar* para salir.',
      }),
      source,
      interpretation,
      session,
      flow: session.activeFlow,
    });
  }

  async function continueReserve(session, raw, cmd) {
    if (session.step === 'pick_activity') {
      const interpretation = sanitizeInterpretation(await intentService.interpret(raw, { session }));
      const activityId = interpretation.entities.activity;
      if (!activityId || !gym.ACTIVITIES[activityId]) {
        const names = gym.listActivities().map((a) => a.name).join(', ');
        return respond({
          reply: `No reconocí esa clase. Opciones: ${names}.`,
          source: 'deterministic',
          session,
          flow: session.activeFlow,
        });
      }
      session.data.activityId = activityId;
      if (interpretation.entities.dateHint) session.data.dateHint = interpretation.entities.dateHint;
      if (interpretation.entities.timeHint) session.data.timeHint = interpretation.entities.timeHint;
      return presentSlots(session, interpretation, 'deterministic');
    }

    if (session.step === 'pick_slot') {
      const candidates = session.data.candidates || [];
      const index = parseChoice(cmd, candidates.length);
      if (index == null) {
        // Strong new intent? Switch. Otherwise ask again.
        const interpretation = sanitizeInterpretation(await intentService.interpret(raw, { session }));
        if (
          interpretation.confidence >= 0.85
          && interpretation.intent !== INTENTS.RESERVE
          && interpretation.intent !== INTENTS.TRIAL_CLASS
          && interpretation.intent !== INTENTS.UNKNOWN
        ) {
          sessions.reset(session);
          return startFromIntent(session, interpretation, raw, 'ai');
        }
        return respond({
          reply: `Elegí un número del 1 al ${candidates.length}, o *cancelar*.`,
          source: 'deterministic',
          session,
          flow: session.activeFlow,
        });
      }
      const chosen = candidates[index];
      const live = gym.findSlot(chosen.id, chosen.date);
      if (!live || !live.available) {
        session.step = 'pick_activity';
        return respond({
          reply: 'Ese horario se quedó sin cupo. Pedime otra clase o día.',
          source: 'deterministic',
          session,
          flow: session.activeFlow,
        });
      }
      session.data.chosen = live;
      session.step = 'confirm';
      const trialNote = session.data.trial ? ' (clase de prueba)' : '';
      return respond({
        reply: [
          `Para confirmar${trialNote}:`,
          `• ${live.activityName} — ${gym.formatDateEs(live.date)} ${live.time}`,
          `• Cupo restante: ${live.remaining}/${live.capacity}`,
          '',
          'Escribí *sí* para confirmar o *no* para cancelar.',
          'La IA no confirma reservas: esto pasa por el servicio de cupos.',
        ].join('\n'),
        source: 'deterministic',
        session,
        flow: session.activeFlow,
      });
    }

    if (session.step === 'confirm') {
      if (isNegative(cmd)) {
        sessions.reset(session);
        return respond({
          reply: `Cancelé la reserva.\n\n${MENU_TEXT}`,
          source: 'deterministic',
          session,
        });
      }
      if (!isAffirmative(cmd)) {
        return respond({
          reply: 'Respondé *sí* para confirmar o *no* para cancelar.',
          source: 'deterministic',
          session,
          flow: session.activeFlow,
        });
      }

      try {
        const flowName = session.activeFlow;
        const booking = gym.confirmBooking({
          userId: session.userId,
          slot: session.data.chosen,
          trial: Boolean(session.data.trial),
        });
        sessions.reset(session);
        return respond({
          reply: [
            '✅ Reserva confirmada por el servicio de cupos.',
            `Código *${booking.id}*`,
            `• ${booking.activityName} — ${booking.dateKey} ${booking.time}`,
            booking.trial ? '• Tipo: clase de prueba' : null,
          ].filter(Boolean).join('\n'),
          source: 'deterministic',
          session,
          flow: flowName,
          booking,
        });
      } catch (err) {
        sessions.reset(session);
        return respond({
          reply: `No pude confirmar: ${err.message} Escribí *menu* para empezar de nuevo.`,
          source: 'deterministic',
          session,
        });
      }
    }

    return null;
  }

  function respond({ reply, source, session, interpretation = null, flow = null, booking = null, handoff = false }) {
    const resolvedFlow = flow || session.activeFlow;
    const interpreted = interpretation && interpretation.intent;
    const intent = interpreted && interpreted !== INTENTS.UNKNOWN
      ? interpreted
      : (FLOW_INTENT[resolvedFlow] || interpreted || null);
    return {
      reply,
      source,
      intent,
      flow: resolvedFlow,
      interpretation,
      booking,
      handoff: handoff || Boolean(session.handoff),
    };
  }

  return {
    handleMessage,
    intentService,
    gym,
    sessions,
    now,
  };
}

const FLOW_INTENT = {
  consult_classes: INTENTS.CONSULT_CLASSES,
  reserve: INTENTS.RESERVE,
  trial_class: INTENTS.TRIAL_CLASS,
  plans: INTENTS.PLANS,
  human_handoff: INTENTS.HUMAN_HANDOFF,
  general: INTENTS.GENERAL_QUESTION,
};

function parseChoice(cmd, length) {
  const n = Number.parseInt(cmd, 10);
  if (!Number.isInteger(n) || n < 1 || n > length) return null;
  return n - 1;
}

function formatSlotList(slots, { heading, numbered = false, footer = '' }) {
  const lines = [heading, ''];
  slots.forEach((slot, i) => {
    const cupo = `${slot.remaining}/${slot.capacity} lugares`;
    const prefix = numbered ? `${i + 1}. ` : '• ';
    lines.push(`${prefix}${slot.time} ${slot.activityName} — ${cupo}`);
  });
  if (footer) {
    lines.push('', footer);
  }
  return lines.join('\n');
}

module.exports = { createConversationEngine, MENU_TEXT };
