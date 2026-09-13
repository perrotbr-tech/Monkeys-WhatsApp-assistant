/**
 * Agente de retención. Misma firma: evaluar(contexto, fechaRef) → acciones[].
 * Sin DOM, sin fetch, sin IA.
 */
import { enVentana, daysAgo, parseFecha, addDays, dayKey } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';

export function crearAgenteRetencion() {
  return {
    id: 'retencion',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const rows = clasificarSocios(contexto.socios || [], contexto.asistencias || [], fecha);
      const acciones = [];
      for (const row of rows) {
        const socio = (contexto.socios || []).find((s) => s.id === row.socioId);
        if (!socio || socio.estado === 'baja') continue;
        if (row.segmento === 'regular') continue;
        if (row.segmento === 'silencioso') {
          acciones.push(tareaSilencioso(socio, fecha));
          continue;
        }
        if (row.segmento === 'constante') {
          acciones.push(mensajeConstante(socio, row, contexto, fecha));
          continue;
        }
        if (row.segmento === 'riesgo') {
          acciones.push(mensajeRiesgo(socio, contexto, fecha));
        }
      }
      return acciones.filter((a) => textoValido(a.texto) && textoValido(a.motivo));
    },
    indicadores(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const rows = clasificarSocios(contexto.socios || [], contexto.asistencias || [], fecha);
      const enRiesgo = rows.filter((r) => r.segmento === 'riesgo').length;
      const prev = campaniaAnterior(contexto.campanias, dayKey(fecha));
      const riesgoPrev = new Set(
        (prev?.clasificacion || []).filter((c) => c.segmento === 'riesgo').map((c) => c.socioId),
      );
      const recuperados = rows.filter((r) => riesgoPrev.has(r.socioId) && r.visitas30d >= 4).length;
      return {
        sociosEnRiesgo: enRiesgo,
        recuperadosEsteMes: recuperados,
      };
    },
  };
}

export function clasificarSocios(socios, asistencias, fechaRef) {
  const fecha = parseFecha(fechaRef);
  return (socios || [])
    .filter((s) => s.estado !== 'baja')
    .map((s) => clasificarUno(s, asistencias, fecha));
}

export function clasificarUno(socio, asistencias, fechaRef) {
  const fecha = parseFecha(fechaRef);
  const visits = (asistencias || []).filter((a) => a.socioId === socio.id);
  const visitas30d = visits.filter((a) => enVentana(a.fechaISO, fecha, 30)).length;
  const visitas21d = visits.filter((a) => enVentana(a.fechaISO, fecha, 21)).length;
  const visitasMesAnterior = visits.filter((a) => {
    const ago = daysAgo(a.fechaISO, fecha);
    return ago >= 30 && ago < 60;
  }).length;

  let variacionPct = null;
  if (visitasMesAnterior === 0 && visitas30d > 0) variacionPct = null;
  else if (visitasMesAnterior > 0) {
    variacionPct = ((visitas30d - visitasMesAnterior) / visitasMesAnterior) * 100;
  }

  const antiguedadDias = daysAgo(socio.fechaIngreso, fecha);
  const soloVisitas = antiguedadDias < 30;

  let segmento = 'regular';
  if (visitas21d === 0) segmento = 'silencioso';
  else if (!soloVisitas && (visitas30d <= 3 || (variacionPct != null && variacionPct <= -50))) segmento = 'riesgo';
  else if (soloVisitas && visitas30d <= 3) segmento = 'riesgo';
  else if (visitas30d >= 8) segmento = 'constante';
  else segmento = 'regular';

  const rachaSemanas = calcularRacha(visits, fecha);
  const ultima = visits
    .map((a) => parseFecha(a.fechaISO))
    .sort((a, b) => b - a)[0];

  return {
    socioId: socio.id,
    id: socio.id,
    segmento,
    visitas30d,
    visitasMesAnterior,
    visitasPrev: visitasMesAnterior,
    variacionPct,
    rachaSemanas,
    antiguedadDias,
    ultimaVisitaISO: ultima ? ultima.toISOString() : null,
  };
}

function calcularRacha(visits, fechaRef) {
  let racha = 0;
  for (let w = 0; w < 12; w += 1) {
    const end = addDays(fechaRef, -7 * w);
    const count = visits.filter((a) => enVentana(a.fechaISO, end, 7)).length;
    if (count === 0) break;
    racha += 1;
  }
  return racha;
}

function horarioSugerido(socio, clases) {
  const c = (clases || []).find(
    (x) => x.nombre === socio.claseFavorita && x.sede === socio.sedeId,
  );
  if (!c) return `${socio.claseFavorita} en ${socio.sedeId}`;
  return `${c.dia} ${c.hora}`;
}

function codigoReferido(socio, contexto) {
  const rows = contexto.referidos || [];
  const hit = rows.find((r) => r.socioReferidorId === socio.id && r.codigo);
  return hit ? hit.codigo : null;
}

function mensajeConstante(socio, row, contexto, fecha) {
  const codigo = codigoReferido(socio, contexto);
  const tpl = codigo ? plantillas.retencion_constante_codigo : plantillas.retencion_constante;
  const texto = aplicarPlantilla(tpl, {
    nombre: socio.nombre,
    racha: String(row.rachaSemanas || 1),
    claseFavorita: socio.claseFavorita,
    sede: socio.sedeId,
    codigoReferido: codigo || '',
  });
  return baseAccion({
    socio,
    fecha,
    tipo: 'mensaje',
    prioridad: 'baja',
    motivo: 'constante',
    texto,
  });
}

function mensajeRiesgo(socio, contexto, fecha) {
  const texto = aplicarPlantilla(plantillas.retencion_riesgo, {
    nombre: socio.nombre,
    claseFavorita: socio.claseFavorita,
    sede: socio.sedeId,
    horarioSugerido: horarioSugerido(socio, contexto.clases),
  });
  return baseAccion({
    socio,
    fecha,
    tipo: 'mensaje',
    prioridad: 'media',
    motivo: 'riesgo',
    texto,
  });
}

function tareaSilencioso(socio, fecha) {
  const motivo = aplicarPlantilla(plantillas.retencion_tarea_silencioso, {
    nombre: socio.nombre,
    sede: socio.sedeId,
    claseFavorita: socio.claseFavorita,
  });
  return baseAccion({
    socio,
    fecha,
    tipo: 'tarea_equipo',
    prioridad: 'alta',
    motivo,
    texto: null,
  });
}

function baseAccion({ socio, fecha, tipo, prioridad, motivo, texto }) {
  return {
    id: null,
    tenantId: socio.tenantId || null,
    agente: 'retencion',
    tipo,
    socioId: socio.id,
    canal: 'simulado',
    texto,
    motivo,
    prioridad,
    estado: 'pendiente',
    fechaISO: parseFecha(fecha).toISOString(),
    sedeId: socio.sedeId,
  };
}

function campaniaAnterior(campanias, hoy) {
  const list = (campanias || [])
    .filter((c) => c.fecha && c.fecha < hoy)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return list[0] || null;
}
