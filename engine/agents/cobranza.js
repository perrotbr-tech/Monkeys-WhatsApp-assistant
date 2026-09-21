import { parseFecha } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';
import { venceEnDias, refrescarMembresia } from '../membresias.js';
import { etiquetaSedeSocio } from './sedes.js';

export function crearAgenteCobranza() {
  return {
    id: 'cobranza',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const socios = contexto.socios || [];
      const planes = contexto.planes || [];
      const membresias = (contexto.membresias || []).map((m) => refrescarMembresia(m, fecha));
      const porVencer = membresias.filter((m) => venceEnDias(m, fecha, 7));
      const rechazados = (contexto.pagos || []).filter((p) => p.estado === 'rechazada');
      const socioIds = new Set();
      const acciones = [];

      function pushSocio(socio, motivo) {
        if (!socio || socio.estado === 'baja' || socioIds.has(socio.id)) return;
        socioIds.add(socio.id);
        const plan = planes.find((p) => p.id === socio.planId);
        const texto = aplicarPlantilla(plantillas.cobranza_aviso, {
          nombre: socio.nombre,
          plan: plan ? plan.nombre : 'plan',
          sede: etiquetaSedeSocio(socio),
        });
        if (!textoValido(texto, { allowDollar: true })) return;
        acciones.push(base('cobranza', socio, fecha, 'mensaje', 'media', motivo, texto));
      }

      for (const m of porVencer) {
        pushSocio(socios.find((s) => s.id === m.socioId), 'vence en 7 dias');
      }
      for (const p of rechazados) {
        pushSocio(socios.find((s) => s.id === p.socioId), 'pago rechazado');
      }
      return acciones;
    },
    indicadores(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const n = (contexto.membresias || []).filter((m) => venceEnDias(refrescarMembresia(m, fecha), fecha, 7)).length;
      return { porVencer7: n };
    },
  };
}
