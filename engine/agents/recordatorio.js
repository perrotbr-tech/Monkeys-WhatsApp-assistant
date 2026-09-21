import { parseFecha } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';
import { etiquetaSedeSocio, horarioSugerido } from './sedes.js';

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
        sede: etiquetaSedeSocio(socio),
        horarioSugerido: horarioSugerido(socio, contexto.clases),
      });
      if (!textoValido(texto)) return [];
      return [base('recordatorio', socio, fecha, 'mensaje', 'baja', 'recordatorio', texto)];
    },
    indicadores() { return {}; },
  };
}
