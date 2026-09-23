import { el } from '../util.js';
import { obtenerEstado, mutar } from '../state.js';

function filtrar(ejercicios, filtro) {
  const t = (filtro.texto || '').trim().toLowerCase();
  return ejercicios.filter((ex) => {
    if (filtro.tipo && ex.tipo !== filtro.tipo) return false;
    if (filtro.fuente && ex.fuente !== filtro.fuente) return false;
    if (!t) return true;
    const blob = [
      ex.nombre,
      ex.modalidad,
      ex.patron,
      ex.levantamiento,
      ex.variante,
      ex.grupoMuscular,
      ex.equipamiento,
      ex.nivel,
      ex.objetivo,
      ex.tipo,
      ex.fuente,
      ex.notasCoach,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(t);
  });
}

export function renderBanco(root, navegar) {
  const e = obtenerEstado();
  const filtro = e.ui.filtroBanco || { texto: '', tipo: '', fuente: '' };
  const items = filtrar(e.ejercicios, filtro);

  const toolbar = el('div', { className: 'toolbar' });
  const search = el('input', {
    type: 'search',
    className: 'field-input grow',
    placeholder: 'Buscar ejercicio…',
    value: filtro.texto,
    'aria-label': 'Buscar',
  });
  search.addEventListener('input', () => {
    mutar((st) => {
      st.ui.filtroBanco.texto = search.value;
    });
    navegar('banco');
  });

  const tipo = el(
    'select',
    { className: 'field-input', 'aria-label': 'Tipo' },
    [
      el('option', { value: '', textContent: 'Todos los tipos' }),
      el('option', { value: 'principal', textContent: 'Principal' }),
      el('option', { value: 'variante', textContent: 'Variante' }),
      el('option', { value: 'accesorio', textContent: 'Accesorio' }),
    ],
  );
  tipo.value = filtro.tipo;
  tipo.addEventListener('change', () => {
    mutar((st) => {
      st.ui.filtroBanco.tipo = tipo.value;
    });
    navegar('banco');
  });

  const fuente = el(
    'select',
    { className: 'field-input', 'aria-label': 'Fuente' },
    [
      el('option', { value: '', textContent: 'Todas las fuentes' }),
      el('option', { value: 'sistema', textContent: 'Sistema' }),
      el('option', { value: 'coach', textContent: 'Coach' }),
    ],
  );
  fuente.value = filtro.fuente;
  fuente.addEventListener('change', () => {
    mutar((st) => {
      st.ui.filtroBanco.fuente = fuente.value;
    });
    navegar('banco');
  });

  toolbar.append(
    search,
    tipo,
    fuente,
    el('button', {
      type: 'button',
      className: 'btn primary',
      textContent: 'Crear ejercicio propio',
      onClick: () => {
        mutar((st) => {
          const id = `ex-coach-${Date.now()}`;
          st.ejercicios.push({
            id,
            nombre: 'Nuevo ejercicio del coach',
            tipo: 'accesorio',
            modalidad: 'Powerlifting',
            patron: 'Personalizado',
            levantamiento: null,
            variante: null,
            grupoMuscular: 'A definir',
            equipamiento: 'A definir',
            nivel: 'Personalizado',
            objetivo: 'Demostración',
            fuente: 'coach',
            notasCoach: 'Creado en la demo. La IA no lo modifica sin aprobación.',
            refTecnica: '',
          });
          st.ui.ejercicioEditId = id;
        });
        navegar('banco');
      },
    }),
    el('button', {
      type: 'button',
      className: 'btn ghost',
      textContent: 'Importar plantilla',
      onClick: () => {
        mutar((st) => {
          const id = `ex-tpl-${Date.now()}`;
          st.ejercicios.push({
            id,
            nombre: 'Plantilla: Good Morning',
            tipo: 'accesorio',
            modalidad: 'Powerlifting',
            patron: 'Bisagra de cadera',
            levantamiento: null,
            variante: null,
            grupoMuscular: 'Isquios / lumbar',
            equipamiento: 'Barra',
            nivel: 'Intermedio',
            objetivo: 'Cadena posterior',
            fuente: 'coach',
            notasCoach: 'Importado desde plantilla demo.',
            refTecnica: '',
          });
        });
        navegar('banco');
      },
    }),
  );

  const lista = el('div', { className: 'banco-list' });
  for (const ex of items) {
    const esCoach = ex.fuente === 'coach';
    const editing = e.ui.ejercicioEditId === ex.id;

    const card = el('article', {
      className: `card ex-bank${esCoach ? ' is-coach' : ' is-sistema'}`,
    });

    card.append(
      el('header', { className: 'ex-head' }, [
        el('h3', { textContent: ex.nombre }),
        el('span', {
          className: `badge ${esCoach ? 'coach' : 'sistema'}`,
          textContent: esCoach ? 'Coach' : 'Sistema',
        }),
      ]),
      el('p', {
        className: 'muted',
        textContent: `${ex.tipo} · ${ex.patron} · ${ex.grupoMuscular}`,
      }),
      el('dl', { className: 'kv compact' }, [
        el('dt', { textContent: 'Modalidad' }),
        el('dd', { textContent: ex.modalidad }),
        el('dt', { textContent: 'Levantamiento' }),
        el('dd', { textContent: ex.levantamiento || '—' }),
        el('dt', { textContent: 'Variante' }),
        el('dd', { textContent: ex.variante || '—' }),
        el('dt', { textContent: 'Equipamiento' }),
        el('dd', { textContent: ex.equipamiento }),
        el('dt', { textContent: 'Nivel' }),
        el('dd', { textContent: ex.nivel }),
        el('dt', { textContent: 'Objetivo' }),
        el('dd', { textContent: ex.objetivo }),
      ]),
    );

    if (editing && esCoach) {
      const nombreIn = el('input', {
        className: 'field-input',
        value: ex.nombre,
        'aria-label': 'Nombre',
      });
      const notasIn = el('textarea', {
        className: 'field-input',
        rows: '3',
        'aria-label': 'Notas del coach',
      });
      notasIn.value = ex.notasCoach || '';
      card.append(
        el('div', { className: 'fields-grid' }, [
          el('label', { className: 'field' }, [
            el('span', { textContent: 'Nombre' }),
            nombreIn,
          ]),
          el('label', { className: 'field span-2' }, [
            el('span', { textContent: 'Notas del coach' }),
            notasIn,
          ]),
        ]),
        el('div', { className: 'actions-row' }, [
          el('button', {
            type: 'button',
            className: 'btn primary',
            textContent: 'Guardar',
            onClick: () => {
              mutar((st) => {
                const target = st.ejercicios.find((x) => x.id === ex.id);
                if (!target) return;
                target.nombre = nombreIn.value.trim() || target.nombre;
                target.notasCoach = notasIn.value;
                st.ui.ejercicioEditId = null;
              });
              navegar('banco');
            },
          }),
          el('button', {
            type: 'button',
            className: 'btn ghost',
            textContent: 'Cancelar',
            onClick: () => {
              mutar((st) => {
                st.ui.ejercicioEditId = null;
              });
              navegar('banco');
            },
          }),
        ]),
      );
    } else {
      if (ex.notasCoach) {
        card.append(el('p', { className: 'note', textContent: ex.notasCoach }));
      }
      if (ex.refTecnica) {
        card.append(el('p', { className: 'note-ipf', textContent: ex.refTecnica }));
      }
      if (esCoach) {
        card.append(
          el('button', {
            type: 'button',
            className: 'btn ghost',
            textContent: 'Editar ejercicio propio',
            onClick: () => {
              mutar((st) => {
                st.ui.ejercicioEditId = ex.id;
              });
              navegar('banco');
            },
          }),
        );
      } else {
        card.append(
          el('p', {
            className: 'footnote',
            textContent:
              'Ejercicio base del sistema. La IA puede interpretarlo; no lo modifica sin aprobación del coach.',
          }),
        );
      }
    }

    lista.appendChild(card);
  }

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Banco de ejercicios' }),
      el('h1', { textContent: 'Catálogo Powerlifting' }),
      el('p', {
        className: 'lead',
        textContent:
          'Clasificación por modalidad, patrón, levantamiento, variante, grupo muscular, equipamiento, nivel, objetivo, tipo y fuente.',
      }),
    ]),
    toolbar,
    el('p', {
      className: 'muted',
      textContent: `${items.length} ejercicios · los del coach se distinguen visualmente`,
    }),
    lista,
  );
}
