/** Datos demostrativos. Horarios, cupos y precios son ficticios salvo planes publicados de SOMA. */

import { crearDatosRetencion } from './socios.js';
import { listarTenants } from './tenants.js';
import { PLANES_SOMA } from './planes-soma.js';
import { fechaHoy } from '../engine/dates.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function clase({ id, tenantId, sede, nombre, dia, hora, entrenador, capacity, reserved = 0, reservable = true, accesoLibre = false, conHora = false, nota = null }) {
  return {
    id, tenantId, sede, nombre, dia, hora, entrenador, capacity, reserved, reservable, accesoLibre, conHora, nota,
  };
}

function clasesSoma() {
  const sede = 'SOMA Antofagasta';
  const tenantId = 'soma';
  const out = [];
  for (const dia of DIAS) {
    const key = dia.slice(0, 3).toLowerCase();
    out.push(clase({ id: `so-ct-${key}-07`, tenantId, sede, nombre: 'Crosstraining', dia, hora: '07:00', entrenador: 'Lorena', capacity: 16, reserved: 4 }));
    out.push(clase({ id: `so-ct-${key}-18`, tenantId, sede, nombre: 'Crosstraining', dia, hora: '18:00', entrenador: 'Lorena', capacity: 16, reserved: dia === 'Lunes' ? 5 : 3 }));
    out.push(clase({ id: `so-ct-${key}-19`, tenantId, sede, nombre: 'Crosstraining', dia, hora: '19:00', entrenador: 'Marcelo', capacity: 16, reserved: 2 }));
    out.push(clase({ id: `so-hx-${key}-08`, tenantId, sede, nombre: 'Hyrox', dia, hora: '08:00', entrenador: 'Marcelo', capacity: 14, reserved: 6 }));
    out.push(clase({ id: `so-hx-${key}-20`, tenantId, sede, nombre: 'Hyrox', dia, hora: '20:00', entrenador: 'Marcelo', capacity: 14, reserved: 4 }));
    out.push(clase({ id: `so-pl-${key}-09`, tenantId, sede, nombre: 'Pilates', dia, hora: '09:00', entrenador: 'Pilar', capacity: 10, reserved: 3 }));
    out.push(clase({ id: `so-pl-${key}-17`, tenantId, sede, nombre: 'Pilates', dia, hora: '17:00', entrenador: 'Pilar', capacity: 10, reserved: 2 }));
  }
  out.push(clase({
    id: 'so-fk-mar-1630', tenantId, sede, nombre: 'Functional Kids', dia: 'Martes', hora: '16:30',
    entrenador: 'Tamara', capacity: 12, reserved: 4, nota: '6 a 12 años',
  }));
  out.push(clase({
    id: 'so-fk-jue-1630', tenantId, sede, nombre: 'Functional Kids', dia: 'Jueves', hora: '16:30',
    entrenador: 'Tamara', capacity: 12, reserved: 3, nota: '6 a 12 años',
  }));
  out.push(clase({
    id: 'so-musculacion', tenantId, sede, nombre: 'Musculación', dia: 'Lunes a sábado', hora: '06:30–22:00',
    entrenador: 'Sala', capacity: 0, reserved: 0, reservable: false, accesoLibre: true,
    nota: 'Acceso libre, sin reserva',
  }));
  out.push(clase({
    id: 'so-kine', tenantId, sede, nombre: 'Kinesiología', dia: 'Con hora', hora: '—',
    entrenador: 'Equipo clínico', capacity: 0, reserved: 0, reservable: false, conHora: true,
    nota: 'Se atiende con hora',
  }));
  return out;
}

function armarMonkeys(fechaRef) {
  return {
    tenantId: 'monkeys',
    nextBookingSeq: 3,
    nextLeadSeq: 3,
    nextConvSeq: 3,
    classes: [
      {
        id: 'fg-spinning', tenantId: 'monkeys', sede: 'Félix García', nombre: 'Spinning',
        dia: 'Lunes', hora: '19:00', entrenador: 'Camila', capacity: 15, reserved: 8, reservable: true,
      },
      {
        id: 'fg-funcional', tenantId: 'monkeys', sede: 'Félix García', nombre: 'Funcional',
        dia: 'Martes', hora: '18:00', entrenador: 'Diego', capacity: 12, reserved: 5, reservable: true,
      },
      {
        id: 'av-yoga', tenantId: 'monkeys', sede: 'Alta Vista', nombre: 'Yoga',
        dia: 'Miércoles', hora: '20:00', entrenador: 'Valentina', capacity: 15, reserved: 12, reservable: true,
      },
      {
        id: 'av-cross', tenantId: 'monkeys', sede: 'Alta Vista', nombre: 'Cross Training',
        dia: 'Jueves', hora: '19:30', entrenador: 'Felipe', capacity: 10, reserved: 10, reservable: true,
      },
    ],
    plans: [
      { id: 'mensual', tenantId: 'monkeys', nombre: 'PLAN MENSUAL', precio: '$69.990 CLP', monto: 69990, periodo: 'mensual' },
      { id: 'trimestral', tenantId: 'monkeys', nombre: 'PLAN TRIMESTRAL', precio: '$189.990 CLP', monto: 189990, periodo: 'trimestral' },
      { id: 'anual', tenantId: 'monkeys', nombre: 'PLAN ANUAL', precio: '$649.990 CLP', monto: 649990, periodo: 'anual' },
    ],
    bookings: [
      {
        codigo: 'GYM-2026-0001', tenantId: 'monkeys', cliente: 'Ana Soto', telefono: '+56911111111',
        claseId: 'fg-funcional', clase: 'Funcional', sede: 'Félix García', dia: 'Martes', hora: '18:00', estado: 'confirmada',
      },
      {
        codigo: 'GYM-2026-0002', tenantId: 'monkeys', cliente: 'Luis Pérez', telefono: '+56922222222',
        claseId: 'av-yoga', clase: 'Yoga', sede: 'Alta Vista', dia: 'Miércoles', hora: '20:00', estado: 'confirmada',
      },
    ],
    leads: [
      {
        id: 'lead-1', tenantId: 'monkeys', nombre: 'Carla Ríos', telefono: '+56933333333',
        objetivo: 'Bajar de peso', clase: 'Spinning', dia: 'Lunes', sede: 'Félix García', estado: 'nuevo',
      },
      {
        id: 'lead-2', tenantId: 'monkeys', nombre: 'Matías Díaz', telefono: '+56944444444',
        objetivo: 'Ganar fuerza', clase: 'Cross Training', dia: 'Jueves', sede: 'Alta Vista', estado: 'nuevo',
      },
    ],
    conversations: [
      {
        id: 'conv-1', tenantId: 'monkeys', sede: 'Félix García', status: 'waiting_human', paso: 'done', data: {},
        usuario: 'Patricia Gómez', telefono: '+56955555555', motivo: 'Consulta por horarios de spinning', messages: [],
      },
      {
        id: 'conv-2', tenantId: 'monkeys', sede: 'Alta Vista', status: 'active', paso: 'menu', data: {},
        usuario: null, telefono: null, motivo: null, messages: [],
      },
    ],
    referidos: [],
    ...crearDatosRetencion(fechaRef, { tenantId: 'monkeys' }),
  };
}

function armarSoma(fechaRef) {
  return {
    tenantId: 'soma',
    nextBookingSeq: 1,
    nextLeadSeq: 7,
    nextConvSeq: 4,
    classes: clasesSoma(),
    plans: clonar(PLANES_SOMA),
    bookings: [],
    leads: [
      { id: 'so-lead-1', tenantId: 'soma', nombre: 'Rocio Salinas', telefono: '+56963000001', objetivo: 'Condición', clase: 'Crosstraining', dia: 'Lunes', sede: 'SOMA Antofagasta', estado: 'nuevo' },
      { id: 'so-lead-2', tenantId: 'soma', nombre: 'Pedro Nuñez', telefono: '+56963000002', objetivo: 'Hyrox', clase: 'Hyrox', dia: 'Martes', sede: 'SOMA Antofagasta', estado: 'nuevo' },
      { id: 'so-lead-3', tenantId: 'soma', nombre: 'Belen Arias', telefono: '+56963000003', objetivo: 'Movilidad', clase: 'Pilates', dia: 'Miércoles', sede: 'SOMA Antofagasta', estado: 'nuevo' },
      { id: 'so-lead-4', tenantId: 'soma', nombre: 'Gonzalo Mendez', telefono: '+56963000004', objetivo: 'Fuerza', clase: 'Crosstraining', dia: 'Jueves', sede: 'SOMA Antofagasta', estado: 'nuevo' },
      { id: 'so-lead-5', tenantId: 'soma', nombre: 'Ximena Palacios', telefono: '+56963000005', objetivo: 'Kids', clase: 'Functional Kids', dia: 'Martes', sede: 'SOMA Antofagasta', estado: 'nuevo' },
      { id: 'so-lead-6', tenantId: 'soma', nombre: 'Hugo Beltran', telefono: '+56963000006', objetivo: 'Información de planes', clase: '—', dia: '—', sede: 'SOMA Antofagasta', estado: 'nuevo' },
    ],
    conversations: [
      {
        id: 'so-conv-1', tenantId: 'soma', sede: 'SOMA Antofagasta', status: 'waiting_human', paso: 'done', data: {},
        usuario: 'Elisa Navarro', telefono: '+56964000001', motivo: 'Consulta de Kinesiología con hora', messages: [],
      },
      {
        id: 'so-conv-2', tenantId: 'soma', sede: 'SOMA Antofagasta', status: 'active', paso: 'menu', data: {},
        usuario: 'Pablo Ibanez', telefono: '+56964000002', motivo: null, messages: [],
      },
      {
        id: 'so-conv-3', tenantId: 'soma', sede: 'SOMA Antofagasta', status: 'active', paso: 'menu', data: {},
        usuario: null, telefono: null, motivo: null, messages: [],
      },
    ],
    referidos: [],
    ...crearDatosRetencion(fechaRef, { tenantId: 'soma' }),
  };
}

export function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function clonarDemo(tenantId = 'monkeys', fechaRef = fechaHoy()) {
  if (tenantId === 'soma') return clonar(armarSoma(fechaRef));
  return clonar(armarMonkeys(fechaRef));
}

export function clonarMundo(fechaRef = fechaHoy()) {
  return {
    tenants: listarTenants(),
    byTenant: {
      monkeys: clonar(armarMonkeys(fechaRef)),
      soma: clonar(armarSoma(fechaRef)),
    },
  };
}

export const demo = clonarDemo('monkeys');
export const monkeysSlice = demo;
export const somaSlice = clonarDemo('soma');
