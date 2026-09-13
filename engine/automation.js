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
import { fechaHoy, dayKey, parseFecha } from './dates.js';
import { crearAgenteRetencion, clasificarSocios } from './agents/retencion.js';
import { crearAgenteCobranza } from './agents/cobranza.js';
import { crearAgenteReactivacion } from './agents/reactivacion.js';
import { crearAgenteRecordatorio } from './agents/recordatorio.js';
import { crearAgenteReferidos } from './agents/referidos.js';
import { textoValido } from '../data/templates.js';
import { TENANT_DEFAULT } from '../data/tenants.js';

const AGENTES = [
  crearAgenteRetencion(),
  crearAgenteCobranza(),
  crearAgenteReactivacion(),
  crearAgenteRecordatorio(),
  crearAgenteReferidos(),
];

export function crearAutomation(datosIniciales, tenantId = TENANT_DEFAULT) {
  let state = extraer(datosIniciales || clonarDemo(tenantId), tenantId);

  function contexto() {
    return {
      tenantId: state.tenantId,
      socios: state.socios,
      asistencias: state.asistencias,
      clases: state.classes,
      campanias: state.automation.campanias,
      referidos: state.referidos || [],
      planes: state.plans,
    };
  }

  function resolverFecha(fechaRef) {
    if (fechaRef && typeof fechaRef === 'object' && !(fechaRef instanceof Date) && fechaRef.fechaRef) {
      return parseFecha(fechaRef.fechaRef);
    }
    return parseFecha(fechaRef || fechaHoy());
  }

  function ejecutarCiclo(fechaRef = fechaHoy(), agentesFiltro = null) {
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
        const dup = acciones.some((x) => x.agente === acc.agente && x.socioId === acc.socioId && x.tipo === 'mensaje');
        if (acc.tipo === 'mensaje' && dup) continue;
        acc.tenantId = state.tenantId;
        state.automation.nextActionSeq += 1;
        acc.id = `act-${state.tenantId}-${state.automation.nextActionSeq}`;
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

  function summary(fechaRef = fechaHoy()) {
    const porAgente = {};
    const porTipo = { mensaje: 0, tarea_equipo: 0 };
    const porEstado = { pendiente: 0, enviado: 0, hecho: 0 };
    for (const a of state.automation.acciones) {
      porAgente[a.agente] = (porAgente[a.agente] || 0) + 1;
      porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1;
      porEstado[a.estado] = (porEstado[a.estado] || 0) + 1;
    }
    const ultimo = [...(state.automation.campanias || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
    const delCiclo = (ultimo && ultimo.acciones) || [];
    const indicadores = {};
    const ctx = contexto();
    const fecha = resolverFecha(fechaRef);
    for (const ag of AGENTES) {
      const deAg = delCiclo.filter((x) => x.agente === ag.id);
      const avisoAcc = deAg.find((x) => x.texto) || deAg.find((x) => x.motivo);
      indicadores[ag.id] = {
        ...(ag.indicadores ? ag.indicadores(ctx, fecha) : {}),
        accionesUltimoCiclo: deAg.length,
        aviso: avisoAcc ? (avisoAcc.texto || avisoAcc.motivo || '') : '',
      };
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

  function clasificar(fechaRef = fechaHoy()) {
    return clasificarSocios(state.socios, state.asistencias, resolverFecha(fechaRef));
  }

  function resumen(fechaRef = fechaHoy()) {
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
        tenantId: state.tenantId,
        socios: clonar(state.socios),
        asistencias: clonar(state.asistencias),
        classes: clonar(state.classes),
        plans: clonar(state.plans),
        automation: clonar(state.automation),
      };
    },
    hidratar(datos) {
      state = extraer(datos, state.tenantId);
    },
    reset() {
      state = extraer(clonarDemo(state.tenantId), state.tenantId);
    },
    agentes() {
      return AGENTES.map((a) => a.id);
    },
  };
}

function extraer(datos, tenantId = TENANT_DEFAULT) {
  const src = (datos && datos.byTenant && datos.byTenant[tenantId]) ? datos.byTenant[tenantId] : datos;
  const seed = clonarDemo(tenantId);
  return {
    tenantId,
    socios: clonar(src.socios || seed.socios),
    asistencias: clonar(src.asistencias || seed.asistencias),
    classes: clonar(src.classes || seed.classes),
    plans: clonar(src.plans || seed.plans),
    referidos: clonar(src.referidos || []),
    automation: clonar(src.automation || seed.automation),
  };
}

export { AGENTES, fechaHoy };
