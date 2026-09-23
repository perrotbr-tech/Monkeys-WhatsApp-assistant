import { el, fmtNum } from '../util.js';
import { obtenerEstado, alumnoPorId, grupoPorId, mutar } from '../state.js';

export function renderInicio(root, navegar) {
  const e = obtenerEstado();
  const { panel, coach, alumnos } = e;

  const card = (title, body) =>
    el('section', { className: 'card' }, [
      el('h2', { textContent: title }),
      body,
    ]);

  const listaSesiones = el('ul', { className: 'list' });
  for (const s of panel.sesionesHoy) {
    const a = alumnoPorId(s.alumnoId);
    listaSesiones.appendChild(
      el('li', {}, [
        el('strong', { textContent: s.hora }),
        document.createTextNode(` · ${a?.nombre || '—'} · ${s.sesion}`),
      ]),
    );
  }

  const pendientes = alumnos.filter((a) => a.estadoHoy === 'pendiente');
  const completados = alumnos.filter((a) => a.estadoHoy === 'completado');

  const listNombres = (arr) => {
    const ul = el('ul', { className: 'list' });
    for (const a of arr) {
      const g = grupoPorId(a.grupoId);
      ul.appendChild(
        el('li', {}, [
          el('button', {
            type: 'button',
            className: 'linkish',
            textContent: a.nombre,
            onClick: () => {
              mutar((st) => {
                st.ui.alumnoId = a.id;
                st.ui.vista = 'alumno';
              });
              navegar('alumno');
            },
          }),
          document.createTextNode(` · ${g?.nombre || ''}`),
        ]),
      );
    }
    if (!arr.length) ul.appendChild(el('li', { textContent: 'Ninguno' }));
    return ul;
  };

  const alertasB = el('ul', { className: 'list alert' });
  for (const al of panel.alertasBienestar) {
    const a = alumnoPorId(al.alumnoId);
    alertasB.appendChild(el('li', { textContent: `${a?.nombre}: ${al.detalle}` }));
  }

  const alertasD = el('ul', { className: 'list alert danger' });
  for (const al of panel.alertasDolor) {
    const a = alumnoPorId(al.alumnoId);
    alertasD.appendChild(
      el('li', {
        textContent: `${a?.nombre}: ${al.detalle} (${al.zona})`,
      }),
    );
  }

  const tests = el('ul', { className: 'list' });
  for (const t of panel.proximosTest) {
    const a = alumnoPorId(t.alumnoId);
    tests.appendChild(el('li', { textContent: `${t.fecha} · ${a?.nombre} · ${t.tipo}` }));
  }

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Panel del coach' }),
      el('h1', { textContent: `Hola, ${coach.nombre}` }),
      el('p', {
        className: 'lead',
        textContent: `${coach.modalidad} · ${coach.rol} · Workspace ${coach.workspace}`,
      }),
    ]),
    el('div', { className: 'grid metrics' }, [
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'Adherencia semanal' }),
        el('strong', { textContent: `${panel.adherenciaSemanal}%` }),
      ]),
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'RPE promedio sesión' }),
        el('strong', { textContent: String(panel.rpePromedio) }),
      ]),
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'Pendientes hoy' }),
        el('strong', { textContent: String(pendientes.length) }),
      ]),
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: 'Completados hoy' }),
        el('strong', { textContent: String(completados.length) }),
      ]),
    ]),
    el('div', { className: 'grid two' }, [
      card('Sesiones programadas hoy', listaSesiones),
      card('Alumnos con entrenamiento pendiente', listNombres(pendientes)),
      card('Alumnos que completaron la sesión', listNombres(completados)),
      card('Alertas de bienestar', alertasB),
      card('Alertas de dolor', alertasD),
      card('Próximos test de fuerza', tests),
    ]),
    el('div', { className: 'actions-row' }, [
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: 'Crear planificación',
        onClick: () => navegar('planificacion'),
      }),
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Ver alumnos',
        onClick: () => navegar('alumnos'),
      }),
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Asistente IA',
        onClick: () => navegar('asistente'),
      }),
    ]),
    el('p', {
      className: 'footnote',
      textContent: `Datos ficticios · ${fmtNum(alumnos.length)} alumnos en workspace FORJA DEMO`,
    }),
  );
}
