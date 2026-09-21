import { parseFecha } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';
import { etiquetaSedeSocio } from './sedes.js';

export function crearAgenteReferidos() {
  return {
    id: 'referidos',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const socio = (contexto.socios || []).find((s) => s.estado !== 'baja' && s.id.endsWith('03'));
      if (!socio) return [];
      const texto = aplicarPlantilla(plantillas.referidos_invita, {
        nombre: socio.nombre,
        claseFavorita: socio.claseFavorita,
        sede: etiquetaSedeSocio(socio),
      });
      if (!textoValido(texto)) return [];
      return [base('referidos', socio, fecha, 'mensaje', 'baja', 'referidos', texto)];
    },
    indicadores() { return {}; },
  };
}
