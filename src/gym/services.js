'use strict';

/**
 * Deterministic gym catalog. Source of truth for horarios, cupos and precios.
 * The AI layer must never invent these values.
 */
const ACTIVITIES = Object.freeze({
  spinning: { id: 'spinning', name: 'Spinning', capacity: 12 },
  yoga: { id: 'yoga', name: 'Yoga', capacity: 15 },
  funcional: { id: 'funcional', name: 'Funcional', capacity: 10 },
  box: { id: 'box', name: 'Box', capacity: 8 },
});

const PLANS = Object.freeze([
  {
    id: 'trial',
    name: 'Clase de prueba',
    price: 0,
    priceLabel: 'Gratis (1 clase)',
    detail: 'Una clase para conocer el gimnasio. Se reserva con cupo real.',
  },
  {
    id: 'drop_in',
    name: 'Clase suelta',
    price: 6000,
    priceLabel: '$6.000',
    detail: 'Una clase, sin abono.',
  },
  {
    id: 'pack8',
    name: 'Pack 8 clases',
    price: 28000,
    priceLabel: '$28.000',
    detail: 'Válido 30 días.',
  },
  {
    id: 'monthly',
    name: 'Plan mensual',
    price: 45000,
    priceLabel: '$45.000 / mes',
    detail: 'Clases ilimitadas de la grilla.',
  },
]);

const KNOWLEDGE = Object.freeze({
  location: 'Monkeys queda en Av. Demo 1234, CABA (sede de demostración).',
  parking: 'Hay estacionamiento de conveniencia a una cuadra. No reservamos cochera desde el bot.',
  hours: 'Horario de atención: lunes a viernes 7:00–22:00, sábados 9:00–14:00. Domingos cerrado.',
  about: 'Monkeys es un gimnasio boutique. Este asistente consulta la grilla real y deriva reservas al servicio determinístico.',
  contact: 'En producción el canal será WhatsApp. En esta demo usá /chat o escribí "hablar con alguien" para dejar un ticket.',
});

/** Weekly template. weekday: 0 Sunday … 6 Saturday. */
const WEEKLY_SCHEDULE = Object.freeze([
  { weekday: 1, time: '07:00', activityId: 'spinning' },
  { weekday: 1, time: '09:00', activityId: 'funcional' },
  { weekday: 1, time: '18:00', activityId: 'spinning' },
  { weekday: 1, time: '19:00', activityId: 'yoga' },
  { weekday: 1, time: '19:30', activityId: 'spinning' },
  { weekday: 1, time: '20:00', activityId: 'funcional' },

  { weekday: 2, time: '08:00', activityId: 'yoga' },
  { weekday: 2, time: '18:00', activityId: 'spinning' },
  { weekday: 2, time: '18:30', activityId: 'box' },
  { weekday: 2, time: '19:00', activityId: 'yoga' },

  { weekday: 3, time: '07:00', activityId: 'spinning' },
  { weekday: 3, time: '09:00', activityId: 'funcional' },
  { weekday: 3, time: '18:00', activityId: 'spinning' },
  { weekday: 3, time: '19:30', activityId: 'spinning' },
  { weekday: 3, time: '20:00', activityId: 'funcional' },

  { weekday: 4, time: '08:00', activityId: 'yoga' },
  { weekday: 4, time: '18:00', activityId: 'spinning' },
  { weekday: 4, time: '18:30', activityId: 'box' },
  { weekday: 4, time: '19:00', activityId: 'yoga' },

  { weekday: 5, time: '07:00', activityId: 'spinning' },
  { weekday: 5, time: '09:00', activityId: 'funcional' },
  { weekday: 5, time: '18:00', activityId: 'spinning' },
  { weekday: 5, time: '19:30', activityId: 'spinning' },

  { weekday: 6, time: '10:00', activityId: 'spinning' },
  { weekday: 6, time: '11:00', activityId: 'yoga' },
]);

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateEs(date) {
  const name = WEEKDAY_ES[date.getDay()];
  const day = date.getDate();
  const month = date.toLocaleDateString('es-AR', { month: 'long' });
  return `${name} ${day} de ${month}`;
}

function resolveDateHint(dateHint, now) {
  const today = startOfDay(now);
  if (!dateHint || dateHint === 'today') return today;
  if (dateHint === 'tomorrow') return addDays(today, 1);
  if (dateHint === 'day_after_tomorrow') return addDays(today, 2);

  const target = WEEKDAY_NAMES.indexOf(dateHint);
  if (target >= 0) {
    const delta = (target - today.getDay() + 7) % 7;
    return addDays(today, delta === 0 ? 0 : delta);
  }
  return today;
}

function slotId(activityId, weekday, time) {
  return `${activityId}-${weekday}-${time}`;
}

/**
 * In-memory deterministic gym services. Isolated per engine instance.
 */
function createGymServices(opts = {}) {
  const now = opts.now || (() => new Date());
  const bookings = [];
  const handoffs = [];
  let bookingSeq = 1;
  let handoffSeq = 1;
  const trialUsed = new Set();

  function listSlots({ activityId = null, dateHint = null, fromDate = null } = {}) {
    const date = fromDate || resolveDateHint(dateHint, now());
    const weekday = date.getDay();
    const rows = WEEKLY_SCHEDULE.filter((row) => {
      if (row.weekday !== weekday) return false;
      if (activityId && row.activityId !== activityId) return false;
      return Boolean(ACTIVITIES[row.activityId]);
    });

    return rows.map((row) => {
      const activity = ACTIVITIES[row.activityId];
      const id = slotId(row.activityId, row.weekday, row.time);
      const taken = bookings.filter(
        (b) => b.slotId === id && b.dateKey === dateKey(date) && b.status === 'confirmed',
      ).length;
      const remaining = Math.max(0, activity.capacity - taken);
      return {
        id,
        date,
        dateKey: dateKey(date),
        weekday: row.weekday,
        time: row.time,
        activityId: activity.id,
        activityName: activity.name,
        capacity: activity.capacity,
        remaining,
        available: remaining > 0,
      };
    });
  }

  function findSlot(slotIdValue, date) {
    return listSlots({ fromDate: date }).find((s) => s.id === slotIdValue) || null;
  }

  function confirmBooking({ userId, slot, trial = false }) {
    if (!slot) {
      throw new Error('No se puede confirmar: no hay un horario determinado.');
    }
    const live = findSlot(slot.id, slot.date);
    if (!live) {
      throw new Error('Ese horario no existe en la grilla.');
    }
    if (!live.available) {
      throw new Error('No hay cupo en ese horario.');
    }
    if (trial && trialUsed.has(userId)) {
      throw new Error('Ya usaste tu clase de prueba. Pedí un plan o una clase suelta.');
    }

    const booking = {
      id: `BKG-${String(bookingSeq).padStart(4, '0')}`,
      userId,
      slotId: live.id,
      activityId: live.activityId,
      activityName: live.activityName,
      dateKey: live.dateKey,
      time: live.time,
      trial,
      status: 'confirmed',
      createdAt: now().toISOString(),
    };
    bookingSeq += 1;
    bookings.push(booking);
    if (trial) trialUsed.add(userId);
    return booking;
  }

  function listPlans() {
    return PLANS.map((p) => ({ ...p }));
  }

  function answer(topic) {
    return KNOWLEDGE[topic] || null;
  }

  function openHandoff({ userId, lastMessage }) {
    const ticket = {
      id: `HND-${String(handoffSeq).padStart(3, '0')}`,
      userId,
      lastMessage: lastMessage || '',
      status: 'open',
      openedAt: now().toISOString(),
    };
    handoffSeq += 1;
    handoffs.push(ticket);
    return ticket;
  }

  function listActivities() {
    return Object.values(ACTIVITIES).map((a) => ({ ...a }));
  }

  return {
    listSlots,
    findSlot,
    confirmBooking,
    listPlans,
    listActivities,
    answer,
    openHandoff,
    resolveDateHint: (hint) => resolveDateHint(hint, now()),
    formatDateEs,
    ACTIVITIES,
    _bookings: bookings,
    _handoffs: handoffs,
  };
}

module.exports = {
  createGymServices,
  ACTIVITIES,
  PLANS,
  KNOWLEDGE,
  WEEKLY_SCHEDULE,
  resolveDateHint,
  formatDateEs,
};
