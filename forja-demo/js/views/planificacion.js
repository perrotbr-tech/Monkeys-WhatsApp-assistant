import { el } from '../util.js';
import { obtenerEstado, mutar, ejercicioPorId } from '../state.js';

export function renderPlanificacion(root, navegar) {
  const e = obtenerEstado();
  const { macro, micro, sesion, ui } = e;
  const mesoActivo = macro.mesociclos.find((m) => m.id === (ui.mesoId || micro.mesoId));

  const mesoNav = el('div', { className: 'chip-row' });
  for (const m of macro.mesociclos) {
    mesoNav.appendChild(
      el('button', {
        type: 'button',
        className: `chip${m.id === mesoActivo?.id ? ' is-active' : ''}`,
        textContent: m.nombre,
        onClick: () => {
          mutar((st) => {
            st.ui.mesoId = m.id;
            st.micro.mesoId = m.id;
          });
          navegar('planificacion');
        },
      }),
    );
  }

  const semanaNav = el('div', { className: 'chip-row' });
  const maxSem = mesoActivo?.semanas || 4;
  for (let s = 1; s <= maxSem; s += 1) {
    semanaNav.appendChild(
      el('button', {
        type: 'button',
        className: `chip${micro.semana === s ? ' is-active' : ''}`,
        textContent: `Semana ${s}`,
        onClick: () => {
          mutar((st) => {
            st.micro.semana = s;
          });
          navegar('planificacion');
        },
      }),
    );
  }

  const dias = el('ul', { className: 'list' });
  for (const d of micro.dias) {
    const btn =
      d.id === 'dia-lun'
        ? el('button', {
            type: 'button',
            className: 'linkish',
            textContent: 'Abrir sesión editable',
            onClick: () => navegar('sesion'),
          })
        : el('span', { className: 'muted', textContent: 'Vista de ejemplo' });
    dias.appendChild(
      el('li', { className: 'row-between' }, [
        el('span', { textContent: `${d.nombre}: ${d.foco}` }),
        btn,
      ]),
    );
  }

  const listaItems = el('div', { className: 'session-preview' });
  const sorted = [...sesion.ejercicios].sort((a, b) => a.orden - b.orden);
  for (const item of sorted.slice(0, 4)) {
    const ex = ejercicioPorId(item.ejercicioId);
    listaItems.appendChild(
      el('div', { className: 'session-line' }, [
        el('strong', { textContent: `${item.orden}. ${ex?.nombre || '—'}` }),
        el('span', {
          textContent: `${item.series}×${item.repeticiones} · ${item.peso} kg · RPE ${item.rpeObjetivo}`,
        }),
      ]),
    );
  }

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Planificación' }),
      el('h1', { textContent: macro.nombre }),
      el('p', { className: 'lead', textContent: macro.objetivo }),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Macro ciclo' }),
      el('dl', { className: 'kv' }, [
        el('dt', { textContent: 'Objetivo' }),
        el('dd', { textContent: macro.objetivo }),
        el('dt', { textContent: 'Fechas' }),
        el('dd', { textContent: `${macro.fechaInicio} → ${macro.fechaFin}` }),
        el('dt', { textContent: 'Competencia / test final' }),
        el('dd', { textContent: macro.competencia }),
      ]),
      el('p', { className: 'note-ipf', textContent: macro.notaIpf }),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Mesociclos (criterio del coach)' }),
      mesoNav,
      mesoActivo
        ? el('p', {
            textContent: `${mesoActivo.nombre} · ${mesoActivo.semanas} semanas · ${mesoActivo.objetivo}`,
          })
        : null,
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Microciclo' }),
      semanaNav,
      el('dl', { className: 'kv' }, [
        el('dt', { textContent: 'Objetivo semanal' }),
        el('dd', { textContent: micro.objetivoSemanal }),
        el('dt', { textContent: 'Volumen' }),
        el('dd', { textContent: micro.volumen }),
        el('dt', { textContent: 'Intensidad' }),
        el('dd', { textContent: micro.intensidad }),
      ]),
      el('h3', { textContent: 'Días de entrenamiento' }),
      dias,
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: sesion.titulo }),
      listaItems,
      el('div', { className: 'actions-row' }, [
        el('button', {
          type: 'button',
          className: 'btn primary',
          textContent: 'Editar sesión',
          onClick: () => navegar('sesion'),
        }),
        el('button', {
          type: 'button',
          className: 'btn ghost',
          textContent: 'Wellness previo',
          onClick: () => navegar('wellness'),
        }),
      ]),
    ]),
  );
}

export function renderSesion(root, navegar) {
  const e = obtenerEstado();
  const { sesion } = e;
  const sorted = [...sesion.ejercicios].sort((a, b) => a.orden - b.orden);

  const form = el('div', { className: 'session-editor' });

  for (const item of sorted) {
    const ex = ejercicioPorId(item.ejercicioId);
    const block = el('article', { className: 'ex-card', 'data-id': item.id });

    const field = (label, key, type = 'text') => {
      const input = el('input', {
        type,
        value: item[key] ?? '',
        className: 'field-input',
        'aria-label': label,
      });
      input.addEventListener('change', () => {
        mutar((st) => {
          const it = st.sesion.ejercicios.find((x) => x.id === item.id);
          if (!it) return;
          const raw = input.value;
          it[key] = type === 'number' ? Number(raw) : raw;
        });
      });
      return el('label', { className: 'field' }, [
        el('span', { textContent: label }),
        input,
      ]);
    };

    const video = item.videoPlaceholder
      ? el('div', {
          className: 'video-ph',
          textContent: 'Referencia visual / video (placeholder)',
        })
      : el('div', { className: 'video-ph muted', textContent: 'Sin referencia visual' });

    block.append(
      el('header', { className: 'ex-head' }, [
        el('span', { className: 'orden', textContent: `#${item.orden}` }),
        el('h3', { textContent: ex?.nombre || 'Ejercicio' }),
        el('span', { className: 'badge', textContent: ex?.tipo || '' }),
      ]),
      el('div', { className: 'fields-grid' }, [
        field('Variante', 'variante'),
        field('Series', 'series', 'number'),
        field('Repeticiones', 'repeticiones', 'number'),
        field('Peso (kg)', 'peso', 'number'),
        field('% 1RM', 'pct1rm', 'number'),
        field('RPE objetivo', 'rpeObjetivo', 'number'),
        field('RIR', 'rir', 'number'),
        field('Descanso', 'descanso'),
        field('Notas técnicas', 'notas'),
        field('Orden', 'orden', 'number'),
      ]),
      video,
    );
    form.appendChild(block);
  }

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Sesión editable' }),
      el('h1', { textContent: sesion.titulo }),
      el('p', {
        className: 'lead',
        textContent:
          'Prescripción de ejemplo. IPF solo como referencia técnica de los básicos; la programación es del coach.',
      }),
    ]),
    form,
    el('div', { className: 'actions-row sticky-actions' }, [
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Volver a planificación',
        onClick: () => navegar('planificacion'),
      }),
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: 'Registrar como alumno',
        onClick: () => navegar('wellness'),
      }),
    ]),
  );
}
