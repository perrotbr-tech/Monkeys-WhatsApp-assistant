import { el, fmtNum, barChart } from '../util.js';
import { obtenerEstado, alumnoPorId } from '../state.js';

export function renderSeguimiento(root, navegar) {
  const e = obtenerEstado();
  const s = e.seguimiento;
  const labels = ['S1', 'S2', 'S3', 'S4'];
  const reg = e.registroSesion;

  const historial = el('ul', { className: 'list' });
  for (const h of s.historialDolor) {
    const a = alumnoPorId(h.alumnoId);
    historial.appendChild(
      el('li', {
        textContent: `${h.fecha} · ${a?.nombre || '—'} · ${h.nivel} · ${h.zona}`,
      }),
    );
  }

  const volLift = el('ul', { className: 'list' });
  for (const v of s.volumenPorLevantamiento) {
    volLift.appendChild(el('li', { textContent: `${v.nombre}: ${v.sets} series` }));
  }

  const oneRm = el('ul', { className: 'list' });
  for (const row of s.oneRmEstimado) {
    oneRm.appendChild(
      el('li', {
        textContent: `${row.semana}: SQ ${row.squat} · BP ${row.bench} · DL ${row.deadlift}`,
      }),
    );
  }

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Seguimiento del coach' }),
      el('h1', { textContent: 'Carga, RPE y adherencia' }),
      el('p', {
        className: 'lead',
        textContent:
          'Métricas ficticias de demostración. No constituyen evaluación clínica ni diagnóstico.',
      }),
    ]),
    reg?.finalizado
      ? el('aside', { className: 'alert-box ok' }, [
          el('strong', { textContent: 'Resultado de sesión reciente' }),
          el('p', {
            textContent: `Cumplimiento: ${reg.cumplimiento} · RPE sesión: ${reg.rpeSesion} · Sensación: ${reg.sensacion}`,
          }),
        ])
      : null,
    el('div', { className: 'grid metrics' }, [
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'Tonelaje básicos (día)' }),
        el('strong', { textContent: fmtNum(s.tonelajeBasicosDia) }),
      ]),
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'Tonelaje semanal' }),
        el('strong', { textContent: fmtNum(s.tonelajeSemanal) }),
      ]),
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'Intensidad media' }),
        el('strong', { textContent: `${s.intensidadMedia}%` }),
      ]),
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'Cumplimiento' }),
        el('strong', { textContent: `${s.cumplimiento}%` }),
      ]),
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'Adherencia' }),
        el('strong', { textContent: `${s.adherencia}%` }),
      ]),
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'RPE obj. vs real' }),
        el('strong', { textContent: `${s.rpeObjetivo} / ${s.rpeReal}` }),
      ]),
    ]),
    el('div', { className: 'grid two' }, [
      el('section', { className: 'card' }, [
        el('h2', { textContent: 'Volumen por levantamiento' }),
        volLift,
      ]),
      el('section', { className: 'card' }, [
        el('h2', { textContent: 'Evolución estimada de 1RM' }),
        oneRm,
        el('p', {
          className: 'footnote',
          textContent: 'Estimación ficticia con fines de demo, no evaluación clínica.',
        }),
      ]),
      el('section', { className: 'card' }, [
        el('h2', { textContent: 'Historial de dolor reportado' }),
        historial,
      ]),
      el('section', { className: 'card' }, [
        el('h2', { textContent: 'Bienestar por semana' }),
        el('ul', { className: 'list' }, [
          ...s.bienestarSemanal.map((b) =>
            el('li', { textContent: `${b.semana}: promedio ${b.promedio}/5` }),
          ),
        ]),
      ]),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Volumen (series semanales)' }),
      barChart(s.seriesGrafica.volumen, labels, '#3DD9C0'),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Intensidad media (%)' }),
      barChart(s.seriesGrafica.intensidad, labels, '#1E5BFF'),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'RPE promedio' }),
      barChart(s.seriesGrafica.rpe, labels, '#F0B429'),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Adherencia (%)' }),
      barChart(s.seriesGrafica.adherencia, labels, '#2ecc71'),
    ]),
    el('div', { className: 'actions-row' }, [
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: 'Revisar sugerencias IA',
        onClick: () => navegar('asistente'),
      }),
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Volver al inicio',
        onClick: () => navegar('inicio'),
      }),
    ]),
  );
}
