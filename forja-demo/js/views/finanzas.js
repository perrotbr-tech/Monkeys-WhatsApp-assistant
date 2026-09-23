import { el } from '../util.js';
import {
  obtenerEstado,
  mutar,
  grupoPorId,
  esEstadoCorrupto,
  restablecerDemo,
} from '../state.js';
import {
  ESTADO_CARGO_ES,
  MEDIOS_PAGO,
  formatearClp,
  filtrarPorActor,
  calcularIndicadores,
  alertasFinancieras,
  registrarPago,
  marcarTransferenciaRecibida,
  generarLinkPago,
  fichaFinancieraAlumno,
  sincronizarEstadosCargos,
} from '../finanzas/modelo.js';
import { FECHA_REF_FINANZAS, WORKSPACE_DEMO, COACH_DEMO } from '../finanzas/seed.js';

function actorCoach(st) {
  return {
    rol: 'coach',
    workspaceId: st.finanzas?.workspaceActivoId || WORKSPACE_DEMO.id,
    coachId: st.finanzas?.coachActivoId || COACH_DEMO.id,
  };
}

function fechaRef(st) {
  return st.finanzas?.fechaRef || FECHA_REF_FINANZAS;
}

function nombreAlumno(st, id) {
  return st.alumnos.find((a) => a.id === id)?.nombre || id;
}

function badgeEstado(estado) {
  const label = ESTADO_CARGO_ES[estado] || estado || '—';
  return el('span', {
    className: `badge fin-estado fin-${estado || 'pending'}`,
    textContent: label,
  });
}

function bannerFicticio() {
  return el('p', {
    className: 'fin-disclaimer',
    textContent: 'Datos financieros ficticios para validación del prototipo',
  });
}

function aplicarFiltros(filas, filtro, st) {
  return filas.filter((row) => {
    if (filtro.estado && row.cargo.estado !== filtro.estado) return false;
    if (filtro.grupoId) {
      const alu = st.alumnos.find((a) => a.id === row.cargo.alumnoId);
      if (!alu || alu.grupoId !== filtro.grupoId) return false;
    }
    if (filtro.modalidad) {
      const mods = row.cargo.modalidadIds || [];
      const nombres = mods.map((id) => {
        const m = (st.finanzas.modalidades || []).find((x) => x.id === id);
        return m?.nombre || id;
      });
      if (
        !mods.includes(filtro.modalidad) &&
        !nombres.some((n) => n === filtro.modalidad)
      ) {
        return false;
      }
    }
    if (filtro.coachId && row.cargo.coachId !== filtro.coachId) return false;
    if (filtro.texto) {
      const q = filtro.texto.trim().toLowerCase();
      if (!row.nombre.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function construirFilas(st, vista) {
  const actor = actorCoach(st);
  const fin = sincronizarEstadosCargos(st.finanzas, fechaRef(st));
  const visible = filtrarPorActor(fin, actor);
  const periodo = st.finanzas.periodo || '2026-09';
  const cargosPeriodo = visible.cargos.filter((c) => c.periodo === periodo);

  return cargosPeriodo.map((cargo) => {
    const alu = st.alumnos.find((a) => a.id === cargo.alumnoId);
    const plan = visible.planes.find((p) => p.id === cargo.planId);
    const asig = visible.asignaciones.find((a) => a.alumnoId === cargo.alumnoId);
    const g = alu ? grupoPorId(alu.grupoId) : null;
    const coach = (st.finanzas.coaches || []).find((c) => c.id === cargo.coachId);
    const pago = visible.pagos.find((p) => p.cargoId === cargo.id);
    const modalidadTxt = (cargo.modalidadIds || [])
      .map((id) => (st.finanzas.modalidades || []).find((m) => m.id === id)?.nombre || id)
      .join(', ');
    return {
      cargo,
      nombre: alu?.nombre || cargo.alumnoId,
      grupo: g?.nombre || '—',
      modalidad: modalidadTxt || '—',
      plan: plan?.nombre || '—',
      valor: cargo.monto,
      vencimiento: cargo.vencimiento,
      estado: cargo.estado,
      medio: pago ? MEDIOS_PAGO[pago.medio] || pago.medio : (asig?.medioPreferido
        ? MEDIOS_PAGO[asig.medioPreferido] || asig.medioPreferido
        : '—'),
      entrenador: coach?.nombre || cargo.coachId,
      pago,
    };
  });
}

function renderKpis(ind) {
  const items = [
    ['Ingresos proyectados', formatearClp(ind.ingresosProyectados)],
    ['Total cobrado', formatearClp(ind.totalCobrado)],
    ['Total pendiente', formatearClp(ind.totalPendiente)],
    ['Total vencido', formatearClp(ind.totalVencido)],
    ['Recaudación', `${ind.porcentajeRecaudacion}%`],
    ['Alumnos con plan activo', String(ind.alumnosConPlanActivo)],
  ];
  return el(
    'div',
    { className: 'grid metrics fin-kpis' },
    items.map(([label, val]) =>
      el('div', { className: 'metric' }, [
        el('span', { className: 'metric-label', textContent: label }),
        el('strong', { textContent: val }),
      ]),
    ),
  );
}

function renderAlertas(alertas, st) {
  if (!alertas.length) {
    return el('aside', { className: 'alert-box ok' }, [
      el('strong', { textContent: 'Sin alertas financieras críticas' }),
    ]);
  }
  return el('aside', { className: 'alert-box danger' }, [
    el('strong', { textContent: 'Alertas financieras' }),
    el(
      'ul',
      { className: 'list alert danger' },
      alertas.slice(0, 8).map((a) =>
        el('li', {
          textContent: a.alumnoId
            ? `${a.mensaje}: ${nombreAlumno(st, a.alumnoId)}`
            : a.mensaje,
        }),
      ),
    ),
  ]);
}

function setMensaje(texto, tipo = 'ok') {
  mutar((st) => {
    st.ui.mensajeFinanzas = { texto, tipo };
  });
}

function setMensajeYPintar(texto, tipo, navegar) {
  setMensaje(texto, tipo);
  navegar(obtenerEstado().ui.vista || 'finanzas');
}

function ejecutarPago(cargoId, medio, navegar, modo) {
  mutar((st) => {
    const actor = actorCoach(st);
    const fn = modo === 'transferencia'
      ? marcarTransferenciaRecibida
      : registrarPago;
    const res = fn(st.finanzas, {
      cargoId,
      medio,
      actor,
      fechaIso: fechaRef(st),
      refs: {
        workspacesConocidos: (st.finanzas.workspaces || []).map((w) => w.id),
        coachesConocidos: (st.finanzas.coaches || []).map((c) => c.id),
        alumnoIdsConocidos: [
          ...st.alumnos.map((a) => a.id),
          'alu-alt-01',
        ],
      },
    });
    if (!res.ok) {
      st.ui.mensajeFinanzas = {
        texto:
          res.error === 'cargo_ya_pagado'
            ? 'Esta deuda ya está pagada. No se puede registrar dos veces.'
            : res.error === 'monto_negativo_o_invalido'
              ? 'No se aceptan montos negativos o inválidos.'
              : res.error === 'monto_no_coincide_plan'
                ? 'El monto debe coincidir con el plan/cargo.'
                : `No se pudo registrar el pago (${res.error}).`,
        tipo: 'error',
      };
      return;
    }
    st.finanzas = res.finanzas;
    st.ui.mensajeFinanzas = {
      texto: `Pago registrado: ${formatearClp(res.pago.monto)}`,
      tipo: 'ok',
    };
  });
  navegar(obtenerEstado().ui.vista === 'finanza-alumno' ? 'finanza-alumno' : 'finanzas');
}

function ejecutarLink(cargoId, navegar) {
  mutar((st) => {
    const actor = actorCoach(st);
    const res = generarLinkPago(st.finanzas, {
      cargoId,
      actor,
      refs: {
        workspacesConocidos: (st.finanzas.workspaces || []).map((w) => w.id),
        coachesConocidos: (st.finanzas.coaches || []).map((c) => c.id),
      },
    });
    if (!res.ok) {
      st.ui.mensajeFinanzas = {
        texto: `No se pudo generar el link (${res.error}).`,
        tipo: 'error',
      };
      return;
    }
    st.finanzas = res.finanzas;
    st.ui.mensajeFinanzas = {
      texto: `Link ficticio: ${res.link.url}`,
      tipo: 'ok',
    };
  });
  navegar('finanzas');
}

function renderTabla(filas, navegar) {
  const desktop = el('div', { className: 'fin-table-wrap' });
  const table = el('table', { className: 'fin-table' });
  table.appendChild(
    el('thead', {}, [
      el('tr', {}, [
        'Nombre',
        'Grupo',
        'Modalidad',
        'Plan',
        'Valor',
        'Vencimiento',
        'Estado',
        'Medio',
        'Entrenador',
        'Acciones',
      ].map((t) => el('th', { textContent: t }))),
    ]),
  );
  const tbody = el('tbody');
  for (const row of filas) {
    const acciones = el('td', { className: 'fin-acciones' });
    acciones.append(
      el('button', {
        type: 'button',
        className: 'btn ghost compact',
        textContent: 'Ficha',
        onClick: () => {
          mutar((st) => {
            st.ui.alumnoId = row.cargo.alumnoId;
            st.ui.cargoId = row.cargo.id;
          });
          navegar('finanza-alumno');
        },
      }),
    );
    if (row.estado === 'pending' || row.estado === 'overdue') {
      acciones.append(
        el('button', {
          type: 'button',
          className: 'btn primary compact',
          textContent: 'Registrar pago',
          onClick: () => ejecutarPago(row.cargo.id, 'transferencia', navegar),
        }),
        el('button', {
          type: 'button',
          className: 'btn ghost compact',
          textContent: 'Link demo',
          onClick: () => ejecutarLink(row.cargo.id, navegar),
        }),
      );
    } else if (row.estado === 'paid' && row.pago) {
      acciones.append(
        el('button', {
          type: 'button',
          className: 'btn ghost compact',
          textContent: 'Comprobante',
          onClick: () =>
            setMensajeYPintar(
              `Comprobante demo ${row.pago.comprobanteId} · ${formatearClp(row.pago.monto)} · ${row.pago.fecha}`,
              'ok',
              navegar,
            ),
        }),
      );
    }
    tbody.appendChild(
      el('tr', {}, [
        el('td', { textContent: row.nombre }),
        el('td', { textContent: row.grupo }),
        el('td', { textContent: row.modalidad }),
        el('td', { textContent: row.plan }),
        el('td', { className: 'fin-monto', textContent: formatearClp(row.valor) }),
        el('td', { textContent: row.vencimiento }),
        el('td', {}, [badgeEstado(row.estado)]),
        el('td', { textContent: row.medio }),
        el('td', { textContent: row.entrenador }),
        acciones,
      ]),
    );
  }
  table.appendChild(tbody);
  desktop.appendChild(table);

  const mobile = el('div', { className: 'fin-cards-mobile' });
  for (const row of filas) {
    const card = el('article', { className: 'card fin-row-card' });
    card.append(
      el('header', { className: 'ex-head' }, [
        el('h3', { textContent: row.nombre }),
        badgeEstado(row.estado),
      ]),
      el('dl', { className: 'kv compact' }, [
        el('dt', { textContent: 'Grupo' }),
        el('dd', { textContent: row.grupo }),
        el('dt', { textContent: 'Modalidad' }),
        el('dd', { textContent: row.modalidad }),
        el('dt', { textContent: 'Plan' }),
        el('dd', { textContent: row.plan }),
        el('dt', { textContent: 'Valor' }),
        el('dd', { className: 'fin-monto', textContent: formatearClp(row.valor) }),
        el('dt', { textContent: 'Vence' }),
        el('dd', { textContent: row.vencimiento }),
        el('dt', { textContent: 'Medio' }),
        el('dd', { textContent: row.medio }),
        el('dt', { textContent: 'Entrenador' }),
        el('dd', { textContent: row.entrenador }),
      ]),
    );
    const rowAct = el('div', { className: 'actions-row' });
    rowAct.append(
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Ficha financiera',
        onClick: () => {
          mutar((st) => {
            st.ui.alumnoId = row.cargo.alumnoId;
            st.ui.cargoId = row.cargo.id;
          });
          navegar('finanza-alumno');
        },
      }),
    );
    if (row.estado === 'pending' || row.estado === 'overdue') {
      rowAct.append(
        el('button', {
          type: 'button',
          className: 'btn primary',
          textContent: 'Registrar pago',
          onClick: () => ejecutarPago(row.cargo.id, 'transferencia', navegar),
        }),
        el('button', {
          type: 'button',
          className: 'btn ghost',
          textContent: 'Link demo',
          onClick: () => ejecutarLink(row.cargo.id, navegar),
        }),
      );
    }
    card.appendChild(rowAct);
    mobile.appendChild(card);
  }

  return el('div', { className: 'fin-lista' }, [desktop, mobile]);
}

function renderFiltros(st, navegar) {
  const f = st.ui.filtroFinanzas || {};
  const wrap = el('div', { className: 'toolbar fin-filtros' });

  const mkSelect = (key, label, options) => {
    const sel = el('select', {
      className: 'field-input',
      'aria-label': label,
      onChange: (ev) => {
        mutar((s) => {
          s.ui.filtroFinanzas = { ...s.ui.filtroFinanzas, [key]: ev.target.value };
        });
        navegar('finanzas');
      },
    });
    sel.appendChild(el('option', { value: '', textContent: label }));
    for (const [val, txt] of options) {
      const opt = el('option', { value: val, textContent: txt });
      if (f[key] === val) opt.selected = true;
      sel.appendChild(opt);
    }
    return sel;
  };

  const input = el('input', {
    className: 'field-input grow',
    type: 'search',
    placeholder: 'Buscar por nombre',
    value: f.texto || '',
    'aria-label': 'Buscar por nombre',
    onInput: (ev) => {
      mutar((s) => {
        s.ui.filtroFinanzas = { ...s.ui.filtroFinanzas, texto: ev.target.value };
      });
      navegar('finanzas');
    },
  });

  wrap.append(
    input,
    mkSelect('estado', 'Estado del pago', [
      ['paid', 'pagado'],
      ['pending', 'pendiente'],
      ['overdue', 'vencido'],
      ['exempt', 'exento/becado'],
    ]),
    mkSelect(
      'grupoId',
      'Grupo',
      st.grupos.map((g) => [g.id, g.nombre]),
    ),
    mkSelect(
      'modalidad',
      'Modalidad',
      (st.finanzas.modalidades || [])
        .filter((m) => m.workspaceId === WORKSPACE_DEMO.id)
        .map((m) => [m.id, m.nombre]),
    ),
    mkSelect(
      'coachId',
      'Entrenador',
      (st.finanzas.coaches || [])
        .filter((c) => c.workspaceId === WORKSPACE_DEMO.id)
        .map((c) => [c.id, c.nombre]),
    ),
  );
  return wrap;
}

export function renderFinanzas(root, navegar) {
  if (esEstadoCorrupto()) {
    root.append(
      el('header', { className: 'view-head' }, [
        el('h1', { textContent: 'Estado corrupto' }),
        el('p', {
          className: 'lead',
          textContent:
            'El documento local de forja-demo está dañado. Restablece la demo de forma explícita (no se sobrescribe solo).',
        }),
      ]),
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: 'Restablecer demo',
        onClick: () => {
          restablecerDemo();
          navegar('finanzas');
        },
      }),
    );
    return;
  }

  const st = obtenerEstado();
  const actor = actorCoach(st);
  const finSync = sincronizarEstadosCargos(st.finanzas, fechaRef(st));
  const visible = filtrarPorActor(finSync, actor);
  const periodo = st.finanzas.periodo || '2026-09';
  const cargosPeriodo = visible.cargos.filter((c) => c.periodo === periodo);
  const cargosPrevios = visible.cargos.filter((c) => c.periodo === '2026-08');
  const asignacionesVis = visible.asignaciones.filter(
    (a) => a.workspaceId === actor.workspaceId && a.coachId === actor.coachId,
  );
  const ind = calcularIndicadores(cargosPeriodo, asignacionesVis, fechaRef(st));
  const alertas = alertasFinancieras({
    cargos: cargosPeriodo,
    asignaciones: asignacionesVis,
    alumnos: st.alumnos,
    fechaRef: fechaRef(st),
    cargosPrevios,
  });

  const filas = aplicarFiltros(
    construirFilas(obtenerEstado()),
    obtenerEstado().ui.filtroFinanzas || {},
    obtenerEstado(),
  );

  const msg = obtenerEstado().ui.mensajeFinanzas;

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Finanzas' }),
      el('h1', { textContent: 'Panel financiero' }),
      el('p', {
        className: 'lead',
        textContent:
          'Indicadores y cargos del coach Matías Rojas · workspace FORJA DEMO. Sin pagos reales ni bancos.',
      }),
    ]),
    bannerFicticio(),
    msg
      ? el('aside', {
        className: `alert-box ${msg.tipo === 'error' ? 'danger' : 'ok'}`,
      }, [el('p', { textContent: msg.texto })])
      : null,
    renderKpis(ind),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Próximos vencimientos' }),
      ind.proximosVencimientos.length
        ? el(
          'ul',
          { className: 'list' },
          ind.proximosVencimientos.map((p) =>
            el('li', {
              textContent: `${nombreAlumno(st, p.alumnoId)} · ${p.vencimiento} · ${formatearClp(p.monto)} · ${ESTADO_CARGO_ES[p.estado]}`,
            }),
          ),
        )
        : el('p', { className: 'muted', textContent: 'Sin vencimientos pendientes.' }),
    ]),
    renderAlertas(alertas, st),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Alumnos y pagos' }),
      renderFiltros(obtenerEstado(), navegar),
      renderTabla(filas, navegar),
    ]),
    el('div', { className: 'actions-row' }, [
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Restablecer datos financieros (demo completa)',
        onClick: () => {
          restablecerDemo();
          setMensaje('Demo restablecida (solo forja-demo).');
          navegar('finanzas');
        },
      }),
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Ver sugerencias del asistente',
        onClick: () => navegar('asistente'),
      }),
    ]),
  );
}

export function renderFinanzaAlumno(root, navegar) {
  const st = obtenerEstado();
  const alumnoId = st.ui.alumnoId || st.alumnos[0]?.id;
  const alu = st.alumnos.find((a) => a.id === alumnoId);
  const actor = actorCoach(st);
  const fin = sincronizarEstadosCargos(st.finanzas, fechaRef(st));
  const visible = filtrarPorActor(fin, actor);
  const ficha = fichaFinancieraAlumno(
    { ...fin, ...visible, asignaciones: visible.asignaciones, cargos: visible.cargos, pagos: visible.pagos, planes: visible.planes },
    alumnoId,
    fechaRef(st),
  );
  const coach = (st.finanzas.coaches || []).find((c) => c.id === ficha.coachId);
  const mods = (ficha.modalidadIds || [])
    .map((id) => (st.finanzas.modalidades || []).find((m) => m.id === id)?.nombre || id)
    .join(', ');
  const msg = st.ui.mensajeFinanzas;

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Ficha financiera' }),
      el('h1', { textContent: alu?.nombre || alumnoId }),
      el('p', {
        className: 'lead',
        textContent: 'Observación financiera separada de wellness y notas deportivas.',
      }),
    ]),
    bannerFicticio(),
    msg
      ? el('aside', {
        className: `alert-box ${msg.tipo === 'error' ? 'danger' : 'ok'}`,
      }, [el('p', { textContent: msg.texto })])
      : null,
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Plan actual' }),
      el('dl', { className: 'kv' }, [
        el('dt', { textContent: 'Plan' }),
        el('dd', { textContent: ficha.plan?.nombre || 'Sin plan' }),
        el('dt', { textContent: 'Valor mensual' }),
        el('dd', {
          className: 'fin-monto',
          textContent:
            ficha.valorMensual != null ? formatearClp(ficha.valorMensual) : '—',
        }),
        el('dt', { textContent: 'Último pago' }),
        el('dd', {
          textContent: ficha.ultimoPago
            ? `${formatearClp(ficha.ultimoPago.monto)} · ${ficha.ultimoPago.fecha} · ${MEDIOS_PAGO[ficha.ultimoPago.medio] || ficha.ultimoPago.medio}`
            : 'Sin pagos',
        }),
        el('dt', { textContent: 'Próximo vencimiento' }),
        el('dd', { textContent: ficha.proximoVencimiento || '—' }),
        el('dt', { textContent: 'Estado' }),
        el('dd', {}, [badgeEstado(ficha.estado)]),
        el('dt', { textContent: 'Entrenador responsable' }),
        el('dd', { textContent: coach?.nombre || ficha.coachId || '—' }),
        el('dt', { textContent: 'Modalidades' }),
        el('dd', { textContent: mods || '—' }),
        el('dt', { textContent: 'Observación financiera' }),
        el('dd', {
          textContent: ficha.observacionFinanciera || 'Sin observación financiera',
        }),
      ]),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Historial de pagos' }),
      ficha.historialPagos.length
        ? el(
          'ul',
          { className: 'list' },
          ficha.historialPagos.map((p) =>
            el('li', {
              textContent: `${p.fecha} · ${formatearClp(p.monto)} · ${MEDIOS_PAGO[p.medio] || p.medio} · ${p.comprobanteId}`,
            }),
          ),
        )
        : el('p', { className: 'muted', textContent: 'Sin historial de pagos.' }),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Cargos' }),
      el(
        'ul',
        { className: 'list' },
        ficha.historialCargos.map((c) =>
          el('li', {}, [
            el('span', {
              textContent: `${c.periodo} · vence ${c.vencimiento} · ${formatearClp(c.monto)} · `,
            }),
            badgeEstado(c.estado),
          ]),
        ),
      ),
    ]),
    el('div', { className: 'actions-row sticky-actions' }, [
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Volver a Finanzas',
        onClick: () => navegar('finanzas'),
      }),
      ficha.cargoActual &&
      (ficha.cargoActual.estado === 'pending' ||
        ficha.cargoActual.estado === 'overdue')
        ? el('button', {
          type: 'button',
          className: 'btn primary',
          textContent: 'Registrar pago demo',
          onClick: () =>
            ejecutarPago(ficha.cargoActual.id, 'transferencia', navegar),
        })
        : null,
      ficha.cargoActual &&
      (ficha.cargoActual.estado === 'pending' ||
        ficha.cargoActual.estado === 'overdue')
        ? el('button', {
          type: 'button',
          className: 'btn ghost',
          textContent: 'Marcar transferencia recibida',
          onClick: () =>
            ejecutarPago(ficha.cargoActual.id, 'transferencia', navegar, 'transferencia'),
        })
        : null,
      ficha.cargoActual &&
      (ficha.cargoActual.estado === 'pending' ||
        ficha.cargoActual.estado === 'overdue')
        ? el('button', {
          type: 'button',
          className: 'btn ghost',
          textContent: 'Generar link ficticio',
          onClick: () => ejecutarLink(ficha.cargoActual.id, navegar),
        })
        : null,
      ficha.ultimoPago
        ? el('button', {
          type: 'button',
          className: 'btn ghost',
          textContent: 'Ver comprobante demo',
          onClick: () =>
            setMensajeYPintar(
              `Comprobante ${ficha.ultimoPago.comprobanteId} · ${formatearClp(ficha.ultimoPago.monto)}`,
              'ok',
              navegar,
            ),
        })
        : null,
    ]),
  );
}
