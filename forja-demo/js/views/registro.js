import { el } from '../util.js';
import { obtenerEstado, mutar, ejercicioPorId, alumnoPorId } from '../state.js';

const LOGRO = ['Sí', 'Parcialmente', 'No'];
const DOLOR = ['Ninguno', 'Leve', 'Moderado', 'Alto'];
const SERIE = ['Completa', 'Ajustada', 'No realizada'];
const SENSACION = ['Muy fácil', 'Adecuada', 'Exigente', 'Demasiado exigente'];
const CUMPLIMIENTO = ['Completo', 'Parcial', 'No completado'];

function initRegistro(e) {
  if (e.registroSesion) return e.registroSesion;
  return {
    alumnoId: e.sesion.alumnoId,
    items: e.sesion.ejercicios.map((it) => ({
      itemId: it.id,
      pesoRealizado: it.peso,
      repsCompletadas: it.repeticiones,
      logroPct: null,
      rpeReal: it.rpeObjetivo,
      dolor: null,
      serieEstado: null,
    })),
    rpeSesion: null,
    sensacion: null,
    cumplimiento: null,
    observacion: '',
    finalizado: false,
  };
}

export function renderRegistro(root, navegar) {
  const e = obtenerEstado();
  const reg = initRegistro(e);
  if (!e.registroSesion) {
    mutar((st) => {
      st.registroSesion = reg;
    });
  }
  const estado = obtenerEstado();
  const data = estado.registroSesion;
  const alumno = alumnoPorId(data.alumnoId) || estado.alumnos[0];

  const patchItem = (itemId, key, val) => {
    mutar((st) => {
      const it = st.registroSesion.items.find((x) => x.itemId === itemId);
      if (it) it[key] = val;
    });
    navegar('registro');
  };

  const lista = el('div', { className: 'session-editor' });
  for (const item of [...estado.sesion.ejercicios].sort((a, b) => a.orden - b.orden)) {
    const r = data.items.find((x) => x.itemId === item.id);
    const ex = ejercicioPorId(item.ejercicioId);
    const block = el('article', { className: 'ex-card' });

    const chips = (options, current, key) => {
      const row = el('div', { className: 'chip-row' });
      for (const o of options) {
        row.appendChild(
          el('button', {
            type: 'button',
            className: `chip${current === o ? ' is-active' : ''}`,
            textContent: o,
            onClick: () => patchItem(item.id, key, o),
          }),
        );
      }
      return row;
    };

    const peso = el('input', {
      type: 'number',
      className: 'field-input',
      value: r.pesoRealizado,
      'aria-label': 'Peso realizado',
    });
    peso.addEventListener('change', () => patchItem(item.id, 'pesoRealizado', Number(peso.value)));

    const reps = el('input', {
      type: 'number',
      className: 'field-input',
      value: r.repsCompletadas,
      'aria-label': 'Repeticiones',
    });
    reps.addEventListener('change', () =>
      patchItem(item.id, 'repsCompletadas', Number(reps.value)),
    );

    const rpe = el('input', {
      type: 'number',
      className: 'field-input',
      step: '0.5',
      min: '1',
      max: '10',
      value: r.rpeReal,
      'aria-label': 'RPE real',
    });
    rpe.addEventListener('change', () => patchItem(item.id, 'rpeReal', Number(rpe.value)));

    block.append(
      el('header', { className: 'ex-head' }, [
        el('span', { className: 'orden', textContent: `#${item.orden}` }),
        el('h3', { textContent: ex?.nombre || '—' }),
        el('span', {
          className: 'muted',
          textContent: `Prescrito: ${item.series}×${item.repeticiones} @ ${item.peso} kg · RPE ${item.rpeObjetivo}`,
        }),
      ]),
      el('div', { className: 'fields-grid' }, [
        el('label', { className: 'field' }, [el('span', { textContent: 'Peso realizado' }), peso]),
        el('label', { className: 'field' }, [
          el('span', { textContent: 'Repeticiones completadas' }),
          reps,
        ]),
        el('label', { className: 'field' }, [el('span', { textContent: 'RPE real' }), rpe]),
      ]),
      el('p', { className: 'field-label', textContent: '¿Logró el porcentaje indicado?' }),
      chips(LOGRO, r.logroPct, 'logroPct'),
      el('p', { className: 'field-label', textContent: 'Dolor' }),
      chips(DOLOR, r.dolor, 'dolor'),
      el('p', { className: 'field-label', textContent: 'Serie completada' }),
      chips(SERIE, r.serieEstado, 'serieEstado'),
    );
    lista.appendChild(block);
  }

  const setFin = (key, val) => {
    mutar((st) => {
      st.registroSesion[key] = val;
    });
    navegar('registro');
  };

  const rpeSes = el('div', { className: 'chip-row' });
  for (let i = 1; i <= 10; i += 1) {
    rpeSes.appendChild(
      el('button', {
        type: 'button',
        className: `chip${data.rpeSesion === i ? ' is-active' : ''}`,
        textContent: String(i),
        onClick: () => setFin('rpeSesion', i),
      }),
    );
  }

  const sens = el('div', { className: 'chip-row' });
  for (const s of SENSACION) {
    sens.appendChild(
      el('button', {
        type: 'button',
        className: `chip${data.sensacion === s ? ' is-active' : ''}`,
        textContent: s,
        onClick: () => setFin('sensacion', s),
      }),
    );
  }

  const cump = el('div', { className: 'chip-row' });
  for (const c of CUMPLIMIENTO) {
    cump.appendChild(
      el('button', {
        type: 'button',
        className: `chip${data.cumplimiento === c ? ' is-active' : ''}`,
        textContent: c,
        onClick: () => setFin('cumplimiento', c),
      }),
    );
  }

  const obs = el('textarea', {
    className: 'field-input',
    rows: '3',
    placeholder: 'Observación escrita opcional',
    'aria-label': 'Observación',
  });
  obs.value = data.observacion || '';
  obs.addEventListener('change', () => setFin('observacion', obs.value));

  const itemsOk = data.items.every((x) => x.logroPct && x.dolor && x.serieEstado);
  const finOk = data.rpeSesion && data.sensacion && data.cumplimiento;

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Registro del alumno' }),
      el('h1', { textContent: `Sesión de ${alumno.nombre}` }),
      el('p', {
        className: 'lead',
        textContent: 'Vista simulada para registrar la sesión conectada a la prescripción.',
      }),
    ]),
    data.finalizado
      ? el('aside', { className: 'alert-box ok' }, [
          el('strong', { textContent: 'Sesión registrada' }),
          el('p', {
            textContent:
              'El coach puede revisar el resultado en Seguimiento y en el panel de inicio.',
          }),
        ])
      : null,
    lista,
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Cierre de sesión' }),
      el('p', { className: 'field-label', textContent: 'RPE de sesión (1–10)' }),
      rpeSes,
      el('p', { className: 'field-label', textContent: 'Sensación' }),
      sens,
      el('p', { className: 'field-label', textContent: 'Cumplimiento' }),
      cump,
      el('label', { className: 'field' }, [
        el('span', { textContent: 'Observación escrita opcional' }),
        obs,
      ]),
    ]),
    el('div', { className: 'actions-row sticky-actions' }, [
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Volver a wellness',
        onClick: () => navegar('wellness'),
      }),
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: data.finalizado ? 'Ver como coach' : 'Finalizar registro',
        disabled: data.finalizado ? false : !(itemsOk && finOk),
        onClick: () => {
          if (data.finalizado) {
            navegar('seguimiento');
            return;
          }
          if (!(itemsOk && finOk)) return;
          mutar((st) => {
            st.registroSesion.finalizado = true;
            const alu = st.alumnos.find((a) => a.id === st.registroSesion.alumnoId);
            if (alu) alu.estadoHoy = 'completado';
            const rpeAlto = st.registroSesion.items.some((it) => {
              const presc = st.sesion.ejercicios.find((x) => x.id === it.itemId);
              return presc && it.rpeReal > presc.rpeObjetivo + 1;
            });
            if (rpeAlto && !st.sugerencias.some((s) => s.id === 'sug-demo-rpe')) {
              st.sugerencias.unshift({
                id: 'sug-demo-rpe',
                titulo: 'RPE superior al objetivo',
                detalle: `${alumno.nombre} reportó RPE por encima del objetivo en esta sesión demo.`,
                evidencia: `Registro demo · RPE sesión ${st.registroSesion.rpeSesion}`,
                tipo: 'rpe',
                estado: 'pendiente',
              });
            }
            st.seguimiento.rpeReal = st.registroSesion.rpeSesion;
            st.seguimiento.cumplimiento =
              st.registroSesion.cumplimiento === 'Completo'
                ? 100
                : st.registroSesion.cumplimiento === 'Parcial'
                  ? 70
                  : 40;
          });
          navegar('seguimiento');
        },
      }),
    ]),
  );
}
