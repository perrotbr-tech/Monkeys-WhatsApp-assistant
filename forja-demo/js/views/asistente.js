import { el } from '../util.js';
import { obtenerEstado, mutar } from '../state.js';
import {
  sugerenciasFinancierasAsistente,
  sincronizarEstadosCargos,
  filtrarPorActor,
} from '../finanzas/modelo.js';
import { FECHA_REF_FINANZAS, WORKSPACE_DEMO, COACH_DEMO } from '../finanzas/seed.js';

function estadoSugFin(st, id, fallback) {
  const map = st.finanzas?.asistenteEstados || {};
  return map[id] || fallback || 'pendiente';
}

export function renderAsistente(root, navegar) {
  const e = obtenerEstado();
  const fin = sincronizarEstadosCargos(
    e.finanzas || { cargos: [], pagos: [], asignaciones: [] },
    e.finanzas?.fechaRef || FECHA_REF_FINANZAS,
  );
  const visible = filtrarPorActor(fin, {
    rol: 'coach',
    workspaceId: e.finanzas?.workspaceActivoId || WORKSPACE_DEMO.id,
    coachId: e.finanzas?.coachActivoId || COACH_DEMO.id,
  });
  const finVis = { ...fin, ...visible };
  const sugFin = (e.finanzas
    ? sugerenciasFinancierasAsistente(
      finVis,
      e.alumnos,
      fin.fechaRef || FECHA_REF_FINANZAS,
    )
    : []
  ).map((s) => ({ ...s, estado: estadoSugFin(e, s.id, s.estado) }));
  const todas = [...sugFin, ...e.sugerencias];

  const lista = el('div', { className: 'sug-list' });
  for (const sug of todas) {
    const esFin = sug.tipo === 'finanzas';
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
      sug.borradorMensaje
        ? el('p', {
          className: 'note',
          textContent: `Borrador (no enviado): ${sug.borradorMensaje}`,
        })
        : null,
      el('p', {
        className: 'note-ipf',
        textContent: esFin
          ? 'La IA resume y sugiere contactar. No cobra, no cambia precios, no bloquea alumnos, no cancela planes, no envía mensajes reales ni marca pagos sin aprobación del coach.'
          : 'La IA propone. El coach revisa. La IA nunca publica ni modifica planes automáticamente ni diagnostica lesiones.',
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
              if (esFin) {
                if (!st.finanzas.asistenteEstados) st.finanzas.asistenteEstados = {};
                st.finanzas.asistenteEstados[sug.id] = 'modificada';
                st.finanzas.auditoria = st.finanzas.auditoria || [];
                st.finanzas.auditoria.push({
                  id: `aud-fin-${Date.now()}`,
                  ts: new Date().toISOString(),
                  workspaceId: st.finanzas.workspaceActivoId,
                  coachId: st.finanzas.coachActivoId,
                  accion: 'aprobar_sugerencia_fin_modificada',
                  sugerenciaId: sug.id,
                  detalle: ta.value.trim() || sug.detalle,
                });
                return;
              }
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
                if (esFin) {
                  if (!st.finanzas.asistenteEstados) st.finanzas.asistenteEstados = {};
                  st.finanzas.asistenteEstados[sug.id] = 'aprobada';
                  st.finanzas.auditoria = st.finanzas.auditoria || [];
                  st.finanzas.auditoria.push({
                    id: `aud-fin-${Date.now()}`,
                    ts: new Date().toISOString(),
                    workspaceId: st.finanzas.workspaceActivoId,
                    coachId: st.finanzas.coachActivoId,
                    accion: 'aprobar_sugerencia_fin',
                    sugerenciaId: sug.id,
                  });
                  return;
                }
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
                if (esFin) {
                  if (!st.finanzas.asistenteEstados) st.finanzas.asistenteEstados = {};
                  st.finanzas.asistenteEstados[sug.id] = 'rechazada';
                  return;
                }
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
          'Panel demo: la IA propone con evidencia; el coach aprueba, modifica o rechaza. Incluye resumen financiero sin cobros automáticos.',
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
        el('li', {
          textContent:
            'En finanzas: no cobra, no cambia precios, no bloquea, no cancela planes, no envía mensajes reales.',
        }),
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
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Ir a Finanzas',
        onClick: () => navegar('finanzas'),
      }),
    ]),
  );
}
