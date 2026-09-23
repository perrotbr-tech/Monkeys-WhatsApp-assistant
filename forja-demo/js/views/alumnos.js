import { el } from '../util.js';
import { obtenerEstado, mutar, grupoPorId } from '../state.js';

export function renderAlumnos(root, navegar) {
  const e = obtenerEstado();
  const lista = el('div', { className: 'alumno-grid' });

  for (const a of e.alumnos) {
    const g = grupoPorId(a.grupoId);
    lista.appendChild(
      el('article', { className: `card alumno-card estado-${a.estadoHoy}` }, [
        el('h3', { textContent: a.nombre }),
        el('p', { textContent: g?.nombre || '' }),
        el('p', {
          className: 'muted',
          textContent: `Modalidades: ${a.modalidades.join(', ')}`,
        }),
        el('dl', { className: 'kv compact' }, [
          el('dt', { textContent: '1RM squat' }),
          el('dd', { textContent: `${a.oneRm.squat} kg` }),
          el('dt', { textContent: '1RM banca' }),
          el('dd', { textContent: `${a.oneRm.bench} kg` }),
          el('dt', { textContent: '1RM muerto' }),
          el('dd', { textContent: `${a.oneRm.deadlift} kg` }),
          el('dt', { textContent: 'Adherencia' }),
          el('dd', { textContent: `${a.adherencia}%` }),
        ]),
        el('button', {
          type: 'button',
          className: 'btn primary block',
          textContent: 'Abrir alumno',
          onClick: () => {
            mutar((st) => {
              st.ui.alumnoId = a.id;
            });
            navegar('alumno');
          },
        }),
      ]),
    );
  }

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Alumnos' }),
      el('h1', { textContent: 'Workspace FORJA DEMO' }),
      el('p', {
        className: 'lead',
        textContent: 'Alumnos ficticios de Powerlifting Inicial y Competencia.',
      }),
    ]),
    lista,
  );
}

export function renderAlumno(root, navegar) {
  const e = obtenerEstado();
  const a = e.alumnos.find((x) => x.id === e.ui.alumnoId) || e.alumnos[0];
  const g = grupoPorId(a.grupoId);

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Ficha del alumno' }),
      el('h1', { textContent: a.nombre }),
      el('p', {
        className: 'lead',
        textContent: `${g?.nombre} · ${a.modalidades.join(' / ')} · Workspace FORJA DEMO`,
      }),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Resumen' }),
      el('dl', { className: 'kv' }, [
        el('dt', { textContent: 'Edad' }),
        el('dd', { textContent: String(a.edad) }),
        el('dt', { textContent: 'Peso corporal' }),
        el('dd', { textContent: `${a.pesoCorporal} kg` }),
        el('dt', { textContent: 'Estado hoy' }),
        el('dd', { textContent: a.estadoHoy }),
        el('dt', { textContent: 'Adherencia' }),
        el('dd', { textContent: `${a.adherencia}%` }),
      ]),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Estimados 1RM (ficticios)' }),
      el('div', { className: 'grid metrics' }, [
        el('div', { className: 'metric' }, [
          el('span', { className: 'metric-label', textContent: 'Sentadilla' }),
          el('strong', { textContent: `${a.oneRm.squat} kg` }),
        ]),
        el('div', { className: 'metric' }, [
          el('span', { className: 'metric-label', textContent: 'Press banca' }),
          el('strong', { textContent: `${a.oneRm.bench} kg` }),
        ]),
        el('div', { className: 'metric' }, [
          el('span', { className: 'metric-label', textContent: 'Peso muerto' }),
          el('strong', { textContent: `${a.oneRm.deadlift} kg` }),
        ]),
      ]),
    ]),
    el('div', { className: 'actions-row' }, [
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Volver',
        onClick: () => navegar('alumnos'),
      }),
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: 'Registrar sesión',
        onClick: () => {
          mutar((st) => {
            st.sesion.alumnoId = a.id;
            st.ui.alumnoId = a.id;
          });
          navegar('wellness');
        },
      }),
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Ver seguimiento',
        onClick: () => navegar('seguimiento'),
      }),
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Ficha financiera',
        onClick: () => {
          mutar((st) => {
            st.ui.alumnoId = a.id;
          });
          navegar('finanza-alumno');
        },
      }),
    ]),
  );
}
