import { parseFecha } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';

export function crearAgenteReactivacion() {
  return {
    id: 'reactivacion',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const socio = (contexto.socios || []).find((s) => s.estado === 'baja');
      if (!socio) return [];
      const motivo = aplicarPlantilla(plantillas.reactivacion_tarea, {
        nombre: socio.nombre,
        sede: socio.sedeId,
        claseFavorita: socio.claseFavorita,
      });
      if (!textoValido(motivo)) return [];
      return [base('reactivacion', socio, fecha, 'tarea_equipo', 'alta', motivo, null)];
    },
    indicadores() { return {}; },
  };
}
