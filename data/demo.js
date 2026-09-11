/** Datos demostrativos. Horarios, cupos y precios son ficticios. */

import { crearDatosRetencion } from './socios.js';

const retencion = crearDatosRetencion();

export const demo = {
  nextBookingSeq: 3,
  nextLeadSeq: 3,
  nextConvSeq: 3,
  classes: [
    {
      id: 'fg-spinning',
      sede: 'Félix García',
      nombre: 'Spinning',
      dia: 'Lunes',
      hora: '19:00',
      entrenador: 'Camila',
      capacity: 15,
      reserved: 8,
    },
    {
      id: 'fg-funcional',
      sede: 'Félix García',
      nombre: 'Funcional',
      dia: 'Martes',
      hora: '18:00',
      entrenador: 'Diego',
      capacity: 12,
      reserved: 5,
    },
    {
      id: 'av-yoga',
      sede: 'Alta Vista',
      nombre: 'Yoga',
      dia: 'Miércoles',
      hora: '20:00',
      entrenador: 'Valentina',
      capacity: 15,
      reserved: 12,
    },
    {
      id: 'av-cross',
      sede: 'Alta Vista',
      nombre: 'Cross Training',
      dia: 'Jueves',
      hora: '19:30',
      entrenador: 'Felipe',
      capacity: 10,
      reserved: 10,
    },
  ],
  plans: [
    { id: 'mensual', nombre: 'PLAN MENSUAL', precio: '$69.990 CLP' },
    { id: 'trimestral', nombre: 'PLAN TRIMESTRAL', precio: '$189.990 CLP' },
    { id: 'anual', nombre: 'PLAN ANUAL', precio: '$649.990 CLP' },
  ],
  bookings: [
    {
      codigo: 'GYM-2026-0001',
      cliente: 'Ana Soto',
      telefono: '+56911111111',
      claseId: 'fg-funcional',
      clase: 'Funcional',
      sede: 'Félix García',
      dia: 'Martes',
      hora: '18:00',
      estado: 'confirmada',
    },
    {
      codigo: 'GYM-2026-0002',
      cliente: 'Luis Pérez',
      telefono: '+56922222222',
      claseId: 'av-yoga',
      clase: 'Yoga',
      sede: 'Alta Vista',
      dia: 'Miércoles',
      hora: '20:00',
      estado: 'confirmada',
    },
  ],
  leads: [
    {
      id: 'lead-1',
      nombre: 'Carla Ríos',
      telefono: '+56933333333',
      objetivo: 'Bajar de peso',
      clase: 'Spinning',
      dia: 'Lunes',
      sede: 'Félix García',
      estado: 'nuevo',
    },
    {
      id: 'lead-2',
      nombre: 'Matías Díaz',
      telefono: '+56944444444',
      objetivo: 'Ganar fuerza',
      clase: 'Cross Training',
      dia: 'Jueves',
      sede: 'Alta Vista',
      estado: 'nuevo',
    },
  ],
  conversations: [
    {
      id: 'conv-1',
      sede: 'Félix García',
      status: 'waiting_human',
      paso: 'done',
      data: {},
      usuario: 'Patricia Gómez',
      telefono: '+56955555555',
      motivo: 'Consulta por horarios de spinning',
      messages: [],
    },
    {
      id: 'conv-2',
      sede: 'Alta Vista',
      status: 'active',
      paso: 'menu',
      data: {},
      usuario: null,
      telefono: null,
      motivo: null,
      messages: [],
    },
  ],
  ...retencion,
};

export function clonarDemo() {
  return JSON.parse(JSON.stringify(demo));
}
