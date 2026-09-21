/** Datos demostrativos. Horarios, cupos y precios son ficticios salvo planes publicados de SOMA. */

import { crearDatosRetencion } from './socios.js';
import { listarTenants, buscarTenant, nombreSede } from './tenants.js';
import { PLANES_SOMA } from './planes-soma.js';
import { fechaHoy } from '../engine/dates.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Builders de slice demo registrados por tenantId (config, no hardcode en el motor). */
const builders = new Map();

function clase({
  id, tenantId, sedeId, nombre, dia, hora, entrenador, capacity, reserved = 0,
  reservable = true, accesoLibre = false, conHora = false, nota = null,
}) {
  const tenant = buscarTenant(tenantId);
  const sid = sedeId;
  return {
    id,
    tenantId,
    sedeId: sid,
    sede: nombreSede(tenant, sid),
    nombre,
    dia,
    hora,
    entrenador,
    capacity,
    reserved,
    reservable,
    accesoLibre,
    conHora,
    nota,
  };
}

function clasesSoma() {
  const sedeId = 'soma-antofagasta';
  const tenantId = 'soma';
  const out = [];
  for (const dia of DIAS) {
    const key = dia.slice(0, 3).toLowerCase();
    out.push(clase({ id: `so-ct-${key}-07`, tenantId, sedeId, nombre: 'Crosstraining', dia, hora: '07:00', entrenador: 'Lorena', capacity: 16, reserved: 4 }));
    out.push(clase({ id: `so-ct-${key}-18`, tenantId, sedeId, nombre: 'Crosstraining', dia, hora: '18:00', entrenador: 'Lorena', capacity: 16, reserved: dia === 'Lunes' ? 5 : 3 }));
    out.push(clase({ id: `so-ct-${key}-19`, tenantId, sedeId, nombre: 'Crosstraining', dia, hora: '19:00', entrenador: 'Marcelo', capacity: 16, reserved: 2 }));
    out.push(clase({ id: `so-hx-${key}-08`, tenantId, sedeId, nombre: 'Hyrox', dia, hora: '08:00', entrenador: 'Marcelo', capacity: 14, reserved: 6 }));
    out.push(clase({ id: `so-hx-${key}-20`, tenantId, sedeId, nombre: 'Hyrox', dia, hora: '20:00', entrenador: 'Marcelo', capacity: 14, reserved: 4 }));
    out.push(clase({ id: `so-pl-${key}-09`, tenantId, sedeId, nombre: 'Pilates', dia, hora: '09:00', entrenador: 'Pilar', capacity: 10, reserved: 3 }));
    out.push(clase({ id: `so-pl-${key}-17`, tenantId, sedeId, nombre: 'Pilates', dia, hora: '17:00', entrenador: 'Pilar', capacity: 10, reserved: 2 }));
  }
  out.push(clase({
    id: 'so-fk-mar-1630', tenantId, sedeId, nombre: 'Functional Kids', dia: 'Martes', hora: '16:30',
    entrenador: 'Tamara', capacity: 12, reserved: 4, nota: '6 a 12 años',
  }));
  out.push(clase({
    id: 'so-fk-jue-1630', tenantId, sedeId, nombre: 'Functional Kids', dia: 'Jueves', hora: '16:30',
    entrenador: 'Tamara', capacity: 12, reserved: 3, nota: '6 a 12 años',
  }));
  out.push(clase({
    id: 'so-musculacion', tenantId, sedeId, nombre: 'Musculación', dia: 'Lunes a sábado', hora: '06:30–22:00',
    entrenador: 'Sala', capacity: 0, reserved: 0, reservable: false, accesoLibre: true,
    nota: 'Acceso libre, sin reserva',
  }));
  out.push(clase({
    id: 'so-kine', tenantId, sedeId, nombre: 'Kinesiología', dia: 'Con hora', hora: '—',
    entrenador: 'Equipo clínico', capacity: 0, reserved: 0, reservable: false, conHora: true,
    nota: 'Se atiende con hora',
  }));
  return out;
}

function armarMonkeys(fechaRef) {
  const tenantId = 'monkeys';
  const tenant = buscarTenant(tenantId);
  const fg = 'felix-garcia';
  const av = 'alta-vista';
  return {
    tenantId,
    nextBookingSeq: 3,
    nextLeadSeq: 3,
    nextConvSeq: 3,
    classes: [
      {
        id: 'fg-spinning', tenantId, sedeId: fg, sede: nombreSede(tenant, fg), nombre: 'Spinning',
        dia: 'Lunes', hora: '19:00', entrenador: 'Camila', capacity: 15, reserved: 8, reservable: true,
      },
      {
        id: 'fg-funcional', tenantId, sedeId: fg, sede: nombreSede(tenant, fg), nombre: 'Funcional',
        dia: 'Martes', hora: '18:00', entrenador: 'Diego', capacity: 12, reserved: 5, reservable: true,
      },
      {
        id: 'av-yoga', tenantId, sedeId: av, sede: nombreSede(tenant, av), nombre: 'Yoga',
        dia: 'Miércoles', hora: '20:00', entrenador: 'Valentina', capacity: 15, reserved: 12, reservable: true,
      },
      {
        id: 'av-cross', tenantId, sedeId: av, sede: nombreSede(tenant, av), nombre: 'Cross Training',
        dia: 'Jueves', hora: '19:30', entrenador: 'Felipe', capacity: 10, reserved: 10, reservable: true,
      },
    ],
    plans: [
      { id: 'mensual', tenantId, nombre: 'PLAN MENSUAL', precio: '$69.990 CLP', monto: 69990, periodo: 'mensual' },
      { id: 'trimestral', tenantId, nombre: 'PLAN TRIMESTRAL', precio: '$189.990 CLP', monto: 189990, periodo: 'trimestral' },
      { id: 'anual', tenantId, nombre: 'PLAN ANUAL', precio: '$649.990 CLP', monto: 649990, periodo: 'anual' },
    ],
    bookings: [
      {
        codigo: 'GYM-2026-0001', tenantId, cliente: 'Ana Soto', telefono: '+56911111111',
        claseId: 'fg-funcional', clase: 'Funcional', sedeId: fg, sede: nombreSede(tenant, fg),
        dia: 'Martes', hora: '18:00', estado: 'confirmada',
      },
      {
        codigo: 'GYM-2026-0002', tenantId, cliente: 'Luis Pérez', telefono: '+56922222222',
        claseId: 'av-yoga', clase: 'Yoga', sedeId: av, sede: nombreSede(tenant, av),
        dia: 'Miércoles', hora: '20:00', estado: 'confirmada',
      },
    ],
    leads: [
      {
        id: 'lead-1', tenantId, nombre: 'Carla Ríos', telefono: '+56933333333',
        objetivo: 'Bajar de peso', clase: 'Spinning', dia: 'Lunes', sedeId: fg, sede: nombreSede(tenant, fg), estado: 'nuevo',
      },
      {
        id: 'lead-2', tenantId, nombre: 'Matías Díaz', telefono: '+56944444444',
        objetivo: 'Ganar fuerza', clase: 'Cross Training', dia: 'Jueves', sedeId: av, sede: nombreSede(tenant, av), estado: 'nuevo',
      },
    ],
    conversations: [
      {
        id: 'conv-1', tenantId, sedeId: fg, sede: nombreSede(tenant, fg), status: 'waiting_human', paso: 'done', data: {},
        usuario: 'Patricia Gómez', telefono: '+56955555555', motivo: 'Consulta por horarios de spinning', messages: [],
      },
      {
        id: 'conv-2', tenantId, sedeId: av, sede: nombreSede(tenant, av), status: 'active', paso: 'menu', data: {},
        usuario: null, telefono: null, motivo: null, messages: [],
      },
    ],
    referidos: [],
    ...crearDatosRetencion(fechaRef, { tenantId }),
  };
}

function armarSoma(fechaRef) {
  const tenantId = 'soma';
  const tenant = buscarTenant(tenantId);
  const sedeId = 'soma-antofagasta';
  const sedeNombre = nombreSede(tenant, sedeId);
  return {
    tenantId,
    nextBookingSeq: 1,
    nextLeadSeq: 7,
    nextConvSeq: 4,
    classes: clasesSoma(),
    plans: clonar(PLANES_SOMA),
    bookings: [],
    leads: [
      { id: 'so-lead-1', tenantId, nombre: 'Rocio Salinas', telefono: '+56963000001', objetivo: 'Condición', clase: 'Crosstraining', dia: 'Lunes', sedeId, sede: sedeNombre, estado: 'nuevo' },
      { id: 'so-lead-2', tenantId, nombre: 'Pedro Nuñez', telefono: '+56963000002', objetivo: 'Hyrox', clase: 'Hyrox', dia: 'Martes', sedeId, sede: sedeNombre, estado: 'nuevo' },
      { id: 'so-lead-3', tenantId, nombre: 'Belen Arias', telefono: '+56963000003', objetivo: 'Movilidad', clase: 'Pilates', dia: 'Miércoles', sedeId, sede: sedeNombre, estado: 'nuevo' },
      { id: 'so-lead-4', tenantId, nombre: 'Gonzalo Mendez', telefono: '+56963000004', objetivo: 'Fuerza', clase: 'Crosstraining', dia: 'Jueves', sedeId, sede: sedeNombre, estado: 'nuevo' },
      { id: 'so-lead-5', tenantId, nombre: 'Ximena Palacios', telefono: '+56963000005', objetivo: 'Kids', clase: 'Functional Kids', dia: 'Martes', sedeId, sede: sedeNombre, estado: 'nuevo' },
      { id: 'so-lead-6', tenantId, nombre: 'Hugo Beltran', telefono: '+56963000006', objetivo: 'Información de planes', clase: '—', dia: '—', sedeId, sede: sedeNombre, estado: 'nuevo' },
    ],
    conversations: [
      {
        id: 'so-conv-1', tenantId, sedeId, sede: sedeNombre, status: 'waiting_human', paso: 'done', data: {},
        usuario: 'Elisa Navarro', telefono: '+56964000001', motivo: 'Consulta de Kinesiología con hora', messages: [],
      },
      {
        id: 'so-conv-2', tenantId, sedeId, sede: sedeNombre, status: 'active', paso: 'menu', data: {},
        usuario: 'Pablo Ibanez', telefono: '+56964000002', motivo: null, messages: [],
      },
      {
        id: 'so-conv-3', tenantId, sedeId, sede: sedeNombre, status: 'active', paso: 'menu', data: {},
        usuario: null, telefono: null, motivo: null, messages: [],
      },
    ],
    referidos: [],
    ...crearDatosRetencion(fechaRef, { tenantId }),
  };
}

builders.set('monkeys', armarMonkeys);
builders.set('soma', armarSoma);

/**
 * Registra un builder de slice demo para un tenant (pruebas / tenants extra).
 * @param {string} tenantId
 * @param {(fechaRef: string) => object} fn
 */
export function registrarBuilderDemo(tenantId, fn) {
  builders.set(tenantId, fn);
}

export function resetBuildersDemo() {
  builders.clear();
  builders.set('monkeys', armarMonkeys);
  builders.set('soma', armarSoma);
}

export function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function clonarDemo(tenantId = 'monkeys', fechaRef = fechaHoy()) {
  const fn = builders.get(tenantId);
  if (fn) return clonar(fn(fechaRef));
  // Tenant registrado sin builder: slice mínimo vacío (no hardcode de marca).
  return clonar({
    tenantId,
    nextBookingSeq: 1,
    nextLeadSeq: 1,
    nextConvSeq: 1,
    classes: [],
    plans: [],
    bookings: [],
    leads: [],
    conversations: [],
    referidos: [],
    socios: [],
    asistencias: [],
    membresias: [],
    pagos: [],
    automation: { nextActionSeq: 0, agentesActivos: {}, campanias: [], acciones: [] },
  });
}

export function clonarMundo(fechaRef = fechaHoy()) {
  const tenants = listarTenants();
  const byTenant = {};
  for (const t of tenants) {
    byTenant[t.id] = clonarDemo(t.id, fechaRef);
  }
  return { tenants, byTenant };
}

export const demo = clonarDemo('monkeys');
export const monkeysSlice = demo;
export const somaSlice = clonarDemo('soma');
