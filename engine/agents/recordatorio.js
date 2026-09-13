import { parseFecha } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';

function horarioSugerido(socio, clases) {
  const c = (clases || []).find((x) => x.nombre === socio.claseFavorita && x.sede === socio.sedeId);
  if (!c) return `${socio.claseFavorita} en ${socio.sedeId}`;
  return `${c.dia} ${c.hora}`;
}

export function crearAgenteRecordatorio() {
  return {
    id: 'recordatorio',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const socio = (contexto.socios || []).find((s) => s.estado !== 'baja' && s.id.endsWith('02'));
      if (!socio) return [];
      const texto = aplicarPlantilla(plantillas.recordatorio_clase, {
        nombre: socio.nombre,
        claseFavorita: socio.claseFavorita,
        sede: socio.sedeId,
        horarioSugerido: horarioSugerido(socio, contexto.clases),
      });
      if (!textoValido(texto)) return [];
      return [base('recordatorio', socio, fecha, 'mensaje', 'baja', 'recordatorio', texto)];
    },
    indicadores() { return {}; },
  };
}
