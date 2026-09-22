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
import { relojActivo } from './clock.js';
import { crearAgenteRetencion, clasificarSocios } from './agents/retencion.js';
import { crearAgenteCobranza } from './agents/cobranza.js';
import { crearAgenteReactivacion } from './agents/reactivacion.js';
import { crearAgenteRecordatorio } from './agents/recordatorio.js';
import { crearAgenteReferidos } from './agents/referidos.js';
import { textoValido } from '../data/templates.js';
import { TENANT_DEFAULT, buscarTenant, mismaSede, nombreSede, resolverSedeId } from '../data/tenants.js';

const AGENTES = [
  crearAgenteRetencion(),
  crearAgenteCobranza(),
  crearAgenteReactivacion(),
  crearAgenteRecordatorio(),
  crearAgenteReferidos(),
];

export function crearAutomation(datosIniciales, tenantId = TENANT_DEFAULT, opts = {}) {
  const clock = opts.clock || relojActivo();
  const hoy = () => fechaHoy(undefined, clock);
  let state = extraer(datosIniciales != null ? datosIniciales : clonarDemo(tenantId), tenantId);

  function contexto() {
    return {
      tenantId: state.tenantId,
      socios: state.socios,
      asistencias: state.asistencias,
      clases: state.classes,
      campanias: state.automation.campanias,
      referidos: state.referidos || [],
      planes: state.plans,
      membresias: state.membresias || [],
      pagos: state.pagos || [],
    };
  }

  function resolverFecha(fechaRef) {
    if (fechaRef && typeof fechaRef === 'object' && !(fechaRef instanceof Date) && fechaRef.fechaRef) {
      return parseFecha(fechaRef.fechaRef);
    }
    return parseFecha(fechaRef || hoy());
  }

  function ejecutarCiclo(fechaRef = hoy(), agentesFiltro = null) {
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
        acc.workspaceId = state.workspaceId || state.tenantId;
        acc.tenantId = acc.workspaceId;
        const tenantCfg = buscarTenant(state.tenantId);
        const sedeEstable = resolverSedeId(tenantCfg, acc.sedeId);
        if (sedeEstable) acc.sedeId = sedeEstable;
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

    const ws = state.workspaceId || state.tenantId;
    const campania = {
      id: `camp-${dia}`,
      workspaceId: ws,
      tenantId: ws,
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

  function summary(fechaRef = hoy()) {
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
    const tenant = buscarTenant(state.tenantId);
    return state.automation.acciones
      .filter((a) => !agente || a.agente === agente)
      .filter((a) => !sede || mismaSede(tenant, a.sedeId, sede))
      .filter((a) => !estado || a.estado === estado)
      .map((a) => enriquecer(a));
  }

  function enriquecer(a) {
    const socio = state.socios.find((s) => s.id === a.socioId);
    const tenant = buscarTenant(state.tenantId);
    return {
      ...clonar(a),
      socioNombre: socio ? socio.nombre : a.socioId,
      claseFavorita: socio ? socio.claseFavorita : null,
      sedeNombre: nombreSede(tenant, a.sedeId),
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

  function clasificar(fechaRef = hoy()) {
    return clasificarSocios(state.socios, state.asistencias, resolverFecha(fechaRef));
  }

  function resumen(fechaRef = hoy()) {
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
      const ws = state.workspaceId || state.tenantId;
      return {
        workspaceId: ws,
        tenantId: ws,
        socios: clonar(state.socios),
        asistencias: clonar(state.asistencias),
        classes: clonar(state.classes),
        plans: clonar(state.plans),
        membresias: clonar(state.membresias || []),
        pagos: clonar(state.pagos || []),
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

/**
 * Extrae el estado de automatización sin rellenar desde demo.
 * Los datos persistidos (o el seed explícito del caller) son la fuente de verdad.
 * Campos de array ausentes → [] ; automation ausente → bloque vacío.
 */
function extraer(datos, tenantId = TENANT_DEFAULT) {
  if (!datos) {
    throw new Error('automation_extraer_requires_data');
  }
  let src = (datos.byTenant && datos.byTenant[tenantId]) ? datos.byTenant[tenantId] : datos;
  if (src && src.schemaVersion === 1 && src.data) src = src.data;
  const auto = src.automation && typeof src.automation === 'object'
    ? src.automation
    : { nextActionSeq: 0, agentesActivos: {}, campanias: [], acciones: [] };
  const ws = src.workspaceId || src.tenantId || tenantId;
  return {
    workspaceId: ws,
    tenantId: ws,
    socios: clonar(Array.isArray(src.socios) ? src.socios : []),
    asistencias: clonar(Array.isArray(src.asistencias) ? src.asistencias : []),
    classes: clonar(Array.isArray(src.classes) ? src.classes : []),
    plans: clonar(Array.isArray(src.plans) ? src.plans : []),
    membresias: clonar(Array.isArray(src.membresias) ? src.membresias : []),
    pagos: clonar(Array.isArray(src.pagos) ? src.pagos : []),
    referidos: clonar(Array.isArray(src.referidos) ? src.referidos : []),
    automation: clonar({
      nextActionSeq: auto.nextActionSeq || 0,
      agentesActivos: auto.agentesActivos || {},
      campanias: Array.isArray(auto.campanias) ? auto.campanias : [],
      acciones: Array.isArray(auto.acciones) ? auto.acciones : [],
    }),
  };
}

export { AGENTES, fechaHoy };
