import { parseFecha } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';
import { vencidaMasDe, refrescarMembresia } from '../membresias.js';
import { etiquetaSedeSocio } from './sedes.js';

export function crearAgenteReactivacion() {
  return {
    id: 'reactivacion',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const socios = contexto.socios || [];
      const membresias = (contexto.membresias || []).map((m) => refrescarMembresia(m, fecha));
      const ids = new Set();
      const acciones = [];

      function push(socio, motivo) {
        if (!socio || ids.has(socio.id)) return;
        ids.add(socio.id);
        const textoMotivo = aplicarPlantilla(plantillas.reactivacion_tarea, {
          nombre: socio.nombre,
          sede: etiquetaSedeSocio(socio),
          claseFavorita: socio.claseFavorita,
        });
        if (!textoValido(textoMotivo)) return;
        acciones.push(base('reactivacion', socio, fecha, 'tarea_equipo', 'alta', motivo || textoMotivo, null));
      }

      for (const m of membresias) {
        if (!vencidaMasDe(m, fecha, 15)) continue;
        const socio = socios.find((s) => s.id === m.socioId);
        if (socio) push(socio);
      }
      for (const socio of socios.filter((s) => s.estado === 'baja')) {
        push(socio);
      }
      return acciones;
    },
    indicadores(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const n = (contexto.membresias || []).filter((m) => vencidaMasDe(refrescarMembresia(m, fecha), fecha, 15)).length;
      return { vencidas15: n };
    },
  };
}
