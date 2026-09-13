import { parseFecha } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';

export function crearAgenteCobranza() {
  return {
    id: 'cobranza',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const socio = (contexto.socios || []).find((s) => s.estado !== 'baja');
      if (!socio) return [];
      const plan = (contexto.planes || []).find((p) => p.id === socio.planId);
      const texto = aplicarPlantilla(plantillas.cobranza_aviso, {
        nombre: socio.nombre,
        plan: plan ? plan.nombre : 'plan',
        sede: socio.sedeId,
      });
      if (!textoValido(texto, { allowDollar: true })) return [];
      return [base('cobranza', socio, fecha, 'mensaje', 'media', 'cobranza', texto)];
    },
    indicadores() { return {}; },
  };
}
