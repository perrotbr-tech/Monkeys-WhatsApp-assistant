import { el } from '../util.js';
import { obtenerEstado, mutar } from '../state.js';

export function renderAsistente(root, navegar) {
  const e = obtenerEstado();

  const lista = el('div', { className: 'sug-list' });
  for (const sug of e.sugerencias) {
    const card = el('article', {
      className: `card sug-card estado-${sug.estado}`,
    });
    card.append(
      el('header', { className: 'ex-head' }, [
        el('h3', { textContent: sug.titulo }),
        el('span', {
          className: `badge ${sug.estado}`,
          textContent: sug.estado,
        }),
      ]),
      el('p', { textContent: sug.detalle }),
      el('p', { className: 'evidence', textContent: `Evidencia: ${sug.evidencia}` }),
      el('p', {
        className: 'note-ipf',
        textContent:
          'La IA propone. El coach revisa. La IA nunca publica ni modifica planes automáticamente ni diagnostica lesiones.',
      }),
    );

    if (sug.estado === 'pendiente') {
      const modBox = el('div', { className: 'mod-box hidden' });
      const ta = el('textarea', {
        className: 'field-input',
        rows: '2',
        placeholder: 'Ajuste del coach…',
        'aria-label': 'Modificar sugerencia',
      });
      modBox.append(
        ta,
        el('button', {
          type: 'button',
          className: 'btn primary',
          textContent: 'Guardar modificación',
          onClick: () => {
            mutar((st) => {
              const s = st.sugerencias.find((x) => x.id === sug.id);
              if (!s) return;
              s.estado = 'modificada';
              s.detalle = ta.value.trim() || s.detalle;
              s.evidencia = `${s.evidencia} · ajustada por el coach`;
            });
            navegar('asistente');
          },
        }),
      );

      card.append(
        el('div', { className: 'actions-row' }, [
          el('button', {
            type: 'button',
            className: 'btn primary',
            textContent: 'Aprobar',
            onClick: () => {
              mutar((st) => {
                const s = st.sugerencias.find((x) => x.id === sug.id);
                if (s) s.estado = 'aprobada';
              });
              navegar('asistente');
            },
          }),
          el('button', {
            type: 'button',
            className: 'btn ghost',
            textContent: 'Modificar',
            onClick: () => {
              modBox.classList.toggle('hidden');
            },
          }),
          el('button', {
            type: 'button',
            className: 'btn danger',
            textContent: 'Rechazar',
            onClick: () => {
              mutar((st) => {
                const s = st.sugerencias.find((x) => x.id === sug.id);
                if (s) s.estado = 'rechazada';
              });
              navegar('asistente');
            },
          }),
        ]),
        modBox,
      );
    }

    lista.appendChild(card);
  }

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'ASISTENTE FORJA' }),
      el('h1', { textContent: 'Sugerencias demostrativas' }),
      el('p', {
        className: 'lead',
        textContent:
          'Panel demo: la IA propone con evidencia; el coach aprueba, modifica o rechaza.',
      }),
    ]),
    el('aside', { className: 'alert-box' }, [
      el('strong', { textContent: 'Reglas obligatorias' }),
      el('ul', { className: 'list' }, [
        el('li', { textContent: 'La IA propone.' }),
        el('li', { textContent: 'El coach revisa.' }),
        el('li', { textContent: 'El coach aprueba, modifica o rechaza.' }),
        el('li', { textContent: 'La IA nunca publica ni modifica planes automáticamente.' }),
        el('li', { textContent: 'La IA no diagnostica lesiones.' }),
        el('li', { textContent: 'Toda sugerencia muestra su evidencia.' }),
      ]),
    ]),
    lista,
    el('div', { className: 'actions-row' }, [
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Volver al panel',
        onClick: () => navegar('inicio'),
      }),
    ]),
  );
}
