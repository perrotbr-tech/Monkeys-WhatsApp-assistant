import { el } from '../util.js';
import { obtenerEstado, mutar, alumnoPorId } from '../state.js';
import {
  ESCALA_DIR,
  DIMENSIONES,
  CLAVES_DIMENSION,
  descripcionDimension,
  requiereAlertaWellness,
} from '../wellness-scale.js';

const ESCALA = [1, 2, 3, 4, 5];
const DOLOR = [
  { v: 'no', l: 'No' },
  { v: 'leve', l: 'Leve' },
  { v: 'moderado', l: 'Moderado' },
  { v: 'alto', l: 'Alto' },
];
const ZONAS = [
  'Ninguna',
  'Hombro derecho',
  'Hombro izquierdo',
  'Lumbar',
  'Rodilla derecha',
  'Rodilla izquierda',
  'Cadera',
  'Otra',
];

function escala(clave, valor, onPick) {
  const dim = DIMENSIONES[clave];
  const row = el('div', { className: 'scale-row' });
  const labelCol = el('div', { className: 'scale-label-col' }, [
    el('span', { className: 'scale-label', textContent: dim.nombre }),
    valor
      ? el('span', {
          className: 'scale-desc',
          textContent: descripcionDimension(clave, valor),
        })
      : el('span', {
          className: 'scale-desc muted',
          textContent: 'Selecciona un valor',
        }),
  ]);
  row.appendChild(labelCol);
  const opts = el('div', {
    className: 'scale-opts',
    role: 'group',
    'aria-label': dim.nombre,
  });
  for (const n of ESCALA) {
    const desc = descripcionDimension(clave, n);
    opts.appendChild(
      el('button', {
        type: 'button',
        className: `scale-btn${valor === n ? ' is-active' : ''}`,
        textContent: String(n),
        title: `${n}: ${desc}`,
        'aria-label': `${dim.nombre}: ${n} — ${desc}`,
        onClick: () => onPick(n),
      }),
    );
  }
  row.appendChild(opts);
  return row;
}

export function renderWellness(root, navegar) {
  const e = obtenerEstado();
  const alumno = alumnoPorId(e.sesion.alumnoId) || e.alumnos[0];
  const w = e.wellness || {
    fatiga: null,
    sueno: null,
    dolorMuscular: null,
    estres: null,
    animo: null,
    dolorActual: null,
    zonaDolor: 'Ninguna',
    observacion: '',
  };

  const set = (key, val) => {
    mutar((st) => {
      st.wellness = { ...(st.wellness || w), [key]: val };
    });
    navegar('wellness');
  };

  const critico = requiereAlertaWellness(w);

  const alerta = critico
    ? el('aside', { className: 'alert-box danger', id: 'alerta-wellness' }, [
        el('strong', { textContent: 'Alerta para el coach' }),
        el('p', {
          textContent:
            'Se detectó dolor alto o bienestar crítico (1 = peor / 5 = mejor). La plataforma no diagnostica lesiones ni modifica automáticamente el entrenamiento. Revisa con el alumno.',
        }),
      ])
    : null;

  const dolorOpts = el('div', { className: 'chip-row' });
  for (const d of DOLOR) {
    dolorOpts.appendChild(
      el('button', {
        type: 'button',
        className: `chip${w.dolorActual === d.v ? ' is-active' : ''}`,
        textContent: d.l,
        onClick: () => set('dolorActual', d.v),
      }),
    );
  }

  const zona = el(
    'select',
    { className: 'field-input', 'aria-label': 'Zona del dolor' },
    ZONAS.map((z) => el('option', { value: z, textContent: z })),
  );
  zona.value = w.zonaDolor || 'Ninguna';
  zona.addEventListener('change', () => set('zonaDolor', zona.value));

  const obs = el('textarea', {
    className: 'field-input',
    rows: '2',
    placeholder: 'Observación opcional',
    'aria-label': 'Observación opcional',
  });
  obs.value = w.observacion || '';
  obs.addEventListener('change', () => set('observacion', obs.value));

  const completo =
    w.fatiga &&
    w.sueno &&
    w.dolorMuscular &&
    w.estres &&
    w.animo &&
    w.dolorActual;

  const escalas = el('section', { className: 'card' }, [
    el('p', {
      className: 'scale-legend',
      textContent: ESCALA_DIR,
    }),
    ...CLAVES_DIMENSION.map((clave) => escala(clave, w[clave], (n) => set(clave, n))),
  ]);

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Test de bienestar' }),
      el('h1', { textContent: 'Antes de iniciar la sesión' }),
      el('p', {
        className: 'lead',
        textContent: `Alumno: ${alumno.nombre} · evaluación rápida 1–5 (opciones, no texto libre). ${ESCALA_DIR}.`,
      }),
    ]),
    alerta,
    escalas,
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Dolor actual' }),
      dolorOpts,
      el('label', { className: 'field' }, [
        el('span', { textContent: 'Zona del dolor' }),
        zona,
      ]),
      el('label', { className: 'field' }, [
        el('span', { textContent: 'Observación opcional' }),
        obs,
      ]),
    ]),
    el('div', { className: 'actions-row' }, [
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Volver',
        onClick: () => navegar('sesion'),
      }),
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: 'Continuar a registro',
        disabled: !completo,
        onClick: () => {
          if (!completo) return;
          if (critico) {
            mutar((st) => {
              if (w.dolorActual === 'alto') {
                const ya = st.panel.alertasDolor.some(
                  (x) => x.alumnoId === alumno.id && x.nivel === 'alto',
                );
                if (!ya) {
                  st.panel.alertasDolor.push({
                    alumnoId: alumno.id,
                    detalle: 'Dolor alto en wellness previo a sesión',
                    zona: w.zonaDolor,
                    nivel: 'alto',
                  });
                }
              }
              const dimsBajas = CLAVES_DIMENSION.filter(
                (k) => typeof w[k] === 'number' && w[k] <= 2,
              );
              if (
                dimsBajas.length &&
                !st.panel.alertasBienestar.some((x) => x.alumnoId === alumno.id)
              ) {
                st.panel.alertasBienestar.push({
                  alumnoId: alumno.id,
                  detalle: `Bienestar crítico (escala 1=peor/5=mejor): ${dimsBajas
                    .map((k) => `${DIMENSIONES[k].nombre} ${w[k]}/5`)
                    .join(', ')}`,
                });
              }
            });
          }
          navegar('registro');
        },
      }),
    ]),
  );
}
