/**
 * Motor de automatizaciones. Recorre agentes con firma evaluar(contexto, fechaRef) → acciones[].
 *
 * @typedef {Object} AttendanceSource
 * Fuente de asistencias. Hoy: datos demo. En producción: API o exportación del software de control de acceso.
 *
 * @typedef {Object} Accion
 * @property {string} id
 * @property {"retencion"|"cobranza"|"reactivacion"|"recordatorio"|"referidos"} agente
 * @property {"mensaje"|"tarea_equipo"} tipo
 * @property {string} socioId
 * @property {"simulado"} canal
 * @property {string|null} [texto]
 * @property {string|null} [motivo]
 * @property {"alta"|"media"|"baja"} prioridad
 * @property {"pendiente"|"enviado"|"hecho"} estado
 * @property {string} fechaISO
 * @property {string} sedeId
 */

import { clonar } from './store.js';
import { clonarDemo } from '../data/demo.js';
import { FECHA_DEMO, dayKey, parseFecha } from './dates.js';
import { crearAgenteRetencion, clasificarSocios } from './agents/retencion.js';
import { textoValido } from '../data/templates.js';

const AGENTES = [crearAgenteRetencion()];

export function crearAutomation(datosIniciales) {
  let state = extraer(datosIniciales || clonarDemo());

  function contexto() {
    const demo = clonarDemo();
    return {
      socios: state.socios,
      asistencias: state.asistencias,
      clases: demo.classes,
      campanias: state.automation.campanias,
      referidos: state.referidos || [],
      planes: demo.plans,
    };
  }

  function resolverFecha(fechaRef) {
    if (fechaRef && typeof fechaRef === 'object' && !(fechaRef instanceof Date) && fechaRef.fechaRef) {
      return parseFecha(fechaRef.fechaRef);
    }
    return parseFecha(fechaRef || FECHA_DEMO);
  }

  function ejecutarCiclo(fechaRef = FECHA_DEMO, agentesFiltro = null) {
    const fecha = resolverFecha(fechaRef);
    const dia = dayKey(fecha);
    const ctx = contexto();
    const activos = state.automation.agentesActivos || {};
    const lista = AGENTES.filter((a) => {
      if (agentesFiltro && !agentesFiltro.includes(a.id)) return false;
      return activos[a.id] !== false;
    });

    const existed = state.automation.campanias.some((c) => c.fecha === dia);
    const acciones = [];
    for (const ag of lista) {
      const produced = ag.evaluar(ctx, fecha) || [];
      for (const acc of produced) {
        if (acc.texto && !textoValido(acc.texto, { allowDollar: acc.agente === 'cobranza' })) {
          continue;
        }
        state.automation.nextActionSeq += 1;
        acc.id = `act-${state.automation.nextActionSeq}`;
        acc.estado = acc.tipo === 'mensaje' ? 'enviado' : 'pendiente';
        acciones.push(acc);
      }
    }

    const clasificacion = clasificarSocios(state.socios, state.asistencias, fecha).map((r) => ({
      socioId: r.socioId,
      segmento: r.segmento,
    }));

    const campania = {
      id: `camp-${dia}`,
      fecha: dia,
      fechaISO: fecha.toISOString(),
      clasificacion,
      acciones: clonar(acciones),
      replaced: existed,
    };

    state.automation.campanias = state.automation.campanias.filter((c) => c.fecha !== dia);
    state.automation.campanias.push(campania);
    state.automation.acciones = [
      ...state.automation.acciones.filter((a) => dayKey(a.fechaISO) !== dia),
      ...acciones,
    ];
    return clonar(campania);
  }

  function summary(fechaRef = FECHA_DEMO) {
    const porAgente = {};
    const porTipo = { mensaje: 0, tarea_equipo: 0 };
    const porEstado = { pendiente: 0, enviado: 0, hecho: 0 };
    for (const a of state.automation.acciones) {
      porAgente[a.agente] = (porAgente[a.agente] || 0) + 1;
      porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1;
      porEstado[a.estado] = (porEstado[a.estado] || 0) + 1;
    }
    const indicadores = {};
    const ctx = contexto();
    const fecha = resolverFecha(fechaRef);
    for (const ag of AGENTES) {
      indicadores[ag.id] = ag.indicadores ? ag.indicadores(ctx, fecha) : {};
    }
    return {
      porAgente,
      porTipo,
      porEstado,
      indicadores,
      agentesActivos: clonar(state.automation.agentesActivos),
      campanias: state.automation.campanias.length,
    };
  }

  function listarAcciones({ agente, sede, estado } = {}) {
    return state.automation.acciones
      .filter((a) => !agente || a.agente === agente)
      .filter((a) => !sede || a.sedeId === sede)
      .filter((a) => !estado || a.estado === estado)
      .map((a) => enriquecer(a));
  }

  function enriquecer(a) {
    const socio = state.socios.find((s) => s.id === a.socioId);
    return {
      ...clonar(a),
      socioNombre: socio ? socio.nombre : a.socioId,
      claseFavorita: socio ? socio.claseFavorita : null,
    };
  }

  function setEstado(id, estado) {
    const acc = state.automation.acciones.find((a) => a.id === id);
    if (!acc) return null;
    if (!['pendiente', 'enviado', 'hecho'].includes(estado)) return acc;
    acc.estado = estado;
    return enriquecer(acc);
  }

  function setAgenteActivo(id, activo) {
    state.automation.agentesActivos[id] = Boolean(activo);
    return clonar(state.automation.agentesActivos);
  }

  function socioPorId(id) {
    return state.socios.find((s) => s.id === id) || null;
  }

  function clasificar(fechaRef = FECHA_DEMO) {
    return clasificarSocios(state.socios, state.asistencias, resolverFecha(fechaRef));
  }

  function resumen(fechaRef = FECHA_DEMO) {
    const s = summary(fechaRef);
    return {
      ...s,
      agentes: AGENTES.map((ag) => {
        const ind = s.indicadores[ag.id] || {};
        return {
          id: ag.id,
          activo: s.agentesActivos[ag.id] !== false,
          kpis: [
            { label: 'Socios en riesgo', valor: ind.sociosEnRiesgo || 0 },
            { label: 'Recuperados este mes', valor: ind.recuperadosEsteMes || 0 },
          ],
        };
      }),
    };
  }

  return {
    ejecutarCiclo,
    summary,
    resumen,
    clasificarSocios: clasificar,
    listarAcciones,
    setEstado,
    setAgenteActivo,
    socioPorId,
    exportar() {
      return {
        socios: clonar(state.socios),
        asistencias: clonar(state.asistencias),
        automation: clonar(state.automation),
      };
    },
    hidratar(datos) {
      state = extraer(datos);
    },
    reset() {
      state = extraer(clonarDemo());
    },
    agentes() {
      return AGENTES.map((a) => a.id);
    },
  };
}

function extraer(datos) {
  const seed = clonarDemo();
  return {
    socios: clonar(datos.socios || seed.socios),
    asistencias: clonar(datos.asistencias || seed.asistencias),
    referidos: clonar(datos.referidos || []),
    automation: clonar(datos.automation || seed.automation),
  };
}

export { AGENTES, FECHA_DEMO };
