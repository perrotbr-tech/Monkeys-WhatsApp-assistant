import { el } from '../util.js';
import { obtenerEstado, mutar, hayDocumentoCorrupto, restablecerDemo } from '../state.js';
import {
  actorDesdeEstado,
  calcularIndicadores,
  calcularAlertas,
  filasTablaFinanzas,
  fichaFinancieraAlumno,
  registrarPago,
  marcarTransferenciaRecibida,
  generarLinkPagoDemo,
  comprobanteDemo,
  fmtClp,
  etiquetaEstadoCargo,
  etiquetaMedioPago,
} from '../finanzas/modelo.js';

function setMensaje(texto, tipo = 'info') {
  mutar((st) => {
    st.ui.mensajeUi = { texto, tipo };
  });
}

function actor() {
  return actorDesdeEstado(obtenerEstado());
}

function renderKpis(ind) {
  const items = [
    ['Ingresos proyectados', fmtClp(ind.proyectado)],
    ['Total cobrado', fmtClp(ind.cobrado)],
    ['Total pendiente', fmtClp(ind.pendiente)],
    ['Total vencido', fmtClp(ind.vencido)],
    ['Recaudación', `${ind.pctRecaudacion}%`],
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

function badgeEstado(estado) {
  const map = {
    paid: 'pagado',
    pending: 'pendiente',
    overdue: 'vencido',
    exempt: 'exento',
    sin_plan: 'sin-plan',
  };
  const cls = map[estado] || 'pendiente';
  return el('span', {
    className: `badge fin-estado ${cls}`,
    textContent: etiquetaEstadoCargo(estado) || estado,
  });
}

function renderAlertas(alertas) {
  if (!alertas.length) {
    return el('aside', { className: 'alert-box ok' }, [
      el('strong', { textContent: 'Sin alertas financieras críticas' }),
      el('p', {
        className: 'muted',
        textContent: 'No hay vencidos ni vencimientos en 7 días para este coach.',
      }),
    ]);
  }
  return el('aside', { className: 'alert-box danger' }, [
    el('strong', { textContent: 'Alertas financieras' }),
    el(
      'ul',
      { className: 'list alert danger' },
      alertas.map((a) => el('li', { textContent: a.mensaje })),
    ),
  ]);
}

function renderFiltros(e, navegar) {
  const f = e.ui.filtrosFinanzas || {};
  const wrap = el('div', { className: 'toolbar fin-filtros' });

  const texto = el('input', {
    className: 'field-input grow',
    type: 'search',
    placeholder: 'Buscar por nombre',
    value: f.texto || '',
    'aria-label': 'Buscar alumno',
  });
  texto.addEventListener('input', () => {
    mutar((st) => {
      st.ui.filtrosFinanzas.texto = texto.value;
    });
    navegar('finanzas');
  });

  const mkSelect = (key, label, options) => {
    const sel = el('select', {
      className: 'field-input',
      'aria-label': label,
    });
    sel.appendChild(el('option', { value: '', textContent: label }));
    for (const [val, lab] of options) {
      const o = el('option', { value: val, textContent: lab });
      if ((f[key] || '') === val) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      mutar((st) => {
        st.ui.filtrosFinanzas[key] = sel.value;
      });
      navegar('finanzas');
    });
    return sel;
  };

  wrap.append(
    texto,
    mkSelect('estado', 'Estado', [
      ['paid', 'pagado'],
      ['pending', 'pendiente'],
      ['overdue', 'vencido'],
      ['exempt', 'exento/becado'],
    ]),
    mkSelect(
      'grupoId',
      'Grupo',
      e.grupos.map((g) => [g.id, g.nombre]),
    ),
    mkSelect('modalidad', 'Modalidad', [
      ['Powerlifting', 'Powerlifting'],
      ['Fuerza general', 'Fuerza general'],
    ]),
    mkSelect('coachId', 'Entrenador', [
      [e.coach.id, e.coach.nombre],
    ]),
  );
  return wrap;
}

function accionesCargo(fila, navegar) {
  const row = el('div', { className: 'fin-acciones' });
  if (!fila.cargoId) return row;

  const puedePagar =
    fila.estado === 'pending' || fila.estado === 'overdue';

  if (puedePagar) {
    row.append(
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: 'Registrar pago',
        onClick: () => {
          const r = registrarPago(obtenerEstado(), actor(), {
            cargoId: fila.cargoId,
            medio: fila.medio || 'transferencia',
          });
          if (!r.ok) {
            setMensaje(
              r.error === 'ya_pagado'
                ? 'Esta deuda ya está pagada. No se puede pagar dos veces.'
                : `No se pudo registrar: ${r.error}`,
              'danger',
            );
          } else {
            setMensaje(`Pago registrado · ${fmtClp(r.pago.monto)}`, 'ok');
          }
          mutar(() => {});
          navegar('finanzas');
        },
      }),
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Marcar transferencia',
        onClick: () => {
          const r = marcarTransferenciaRecibida(
            obtenerEstado(),
            actor(),
            fila.cargoId,
          );
          setMensaje(
            r.ok
              ? 'Transferencia marcada como recibida'
              : `Rechazado: ${r.error}`,
            r.ok ? 'ok' : 'danger',
          );
          mutar(() => {});
          navegar('finanzas');
        },
      }),
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Link de pago',
        onClick: () => {
          const r = generarLinkPagoDemo(
            obtenerEstado(),
            actor(),
            fila.cargoId,
          );
          if (r.ok) {
            setMensaje(`Link ficticio: ${r.link.url}`, 'ok');
          } else {
            setMensaje(`No se generó link: ${r.error}`, 'danger');
          }
          mutar(() => {});
          navegar('finanzas');
        },
      }),
    );
  } else if (fila.estado === 'paid') {
    const e = obtenerEstado();
    const pago = (e.finanzas.pagos || []).find((p) => p.cargoId === fila.cargoId);
    if (pago) {
      row.append(
        el('button', {
          type: 'button',
          className: 'btn ghost',
          textContent: 'Ver comprobante',
          onClick: () => {
            const r = comprobanteDemo(e, actor(), pago.id);
            if (r.ok) {
              setMensaje(
                `${r.comprobante.codigo} · ${r.comprobante.montoFmt} · ${r.comprobante.nota}`,
                'ok',
              );
            }
            navegar('finanzas');
          },
        }),
        el('button', {
          type: 'button',
          className: 'btn ghost',
          textContent: 'Intentar pagar de nuevo',
          onClick: () => {
            const r = registrarPago(obtenerEstado(), actor(), {
              cargoId: fila.cargoId,
            });
            setMensaje(
              r.ok
                ? 'Pago duplicado inesperado'
                : 'Rechazado: esta deuda no puede pagarse dos veces.',
              r.ok ? 'danger' : 'ok',
            );
            navegar('finanzas');
          },
        }),
      );
    }
  }
  return row;
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
      ].map((h) => el('th', { textContent: h }))),
    ]),
  );
  const tbody = el('tbody');
  for (const fila of filas) {
    const tr = el('tr');
    tr.append(
      el('td', {}, [
        el('button', {
          type: 'button',
          className: 'linkish',
          textContent: fila.nombre,
          onClick: () => {
            mutar((st) => {
              st.ui.fichaFinancieraAlumnoId = fila.alumnoId;
            });
            navegar('finanzas-ficha');
          },
        }),
      ]),
      el('td', { textContent: fila.grupoNombre }),
      el('td', { textContent: (fila.modalidades || []).join(', ') }),
      el('td', { textContent: fila.planNombre }),
      el('td', {
        className: 'fin-monto',
        textContent: fila.valorPlan == null ? '—' : fmtClp(fila.valorPlan),
      }),
      el('td', { textContent: fila.vencimiento || '—' }),
      el('td', {}, [badgeEstado(fila.estado)]),
      el('td', { textContent: etiquetaMedioPago(fila.medio) }),
      el('td', { textContent: fila.coachNombre }),
      el('td', {}, [accionesCargo(fila, navegar)]),
    );
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  desktop.appendChild(table);

  const mobile = el('div', { className: 'fin-cards-mobile' });
  for (const fila of filas) {
    mobile.appendChild(
      el('article', { className: 'card fin-card-mobile' }, [
        el('header', { className: 'ex-head' }, [
          el('h3', { textContent: fila.nombre }),
          badgeEstado(fila.estado),
        ]),
        el('dl', { className: 'kv compact' }, [
          el('dt', { textContent: 'Grupo' }),
          el('dd', { textContent: fila.grupoNombre }),
          el('dt', { textContent: 'Plan' }),
          el('dd', { textContent: fila.planNombre }),
          el('dt', { textContent: 'Valor' }),
          el('dd', {
            className: 'fin-monto',
            textContent: fila.valorPlan == null ? '—' : fmtClp(fila.valorPlan),
          }),
          el('dt', { textContent: 'Vence' }),
          el('dd', { textContent: fila.vencimiento || '—' }),
          el('dt', { textContent: 'Medio' }),
          el('dd', { textContent: etiquetaMedioPago(fila.medio) }),
          el('dt', { textContent: 'Entrenador' }),
          el('dd', { textContent: fila.coachNombre }),
        ]),
        el('div', { className: 'actions-row' }, [
          el('button', {
            type: 'button',
            className: 'btn ghost',
            textContent: 'Ficha financiera',
            onClick: () => {
              mutar((st) => {
                st.ui.fichaFinancieraAlumnoId = fila.alumnoId;
              });
              navegar('finanzas-ficha');
            },
          }),
        ]),
        accionesCargo(fila, navegar),
      ]),
    );
  }

  return el('div', {}, [desktop, mobile]);
}

function renderProximos(ind) {
  const lista = ind.proximosVencimientos.slice(0, 5);
  if (!lista.length) {
    return el('p', { className: 'muted', textContent: 'Sin vencimientos pendientes.' });
  }
  return el(
    'ul',
    { className: 'list' },
    lista.map((c) => {
      const e = obtenerEstado();
      const alu = e.alumnos.find((a) => a.id === c.alumnoId);
      return el('li', {
        textContent: `${alu?.nombre || c.alumnoId} · ${c.vencimiento} · ${fmtClp(c.monto)} · ${etiquetaEstadoCargo(c.estado)}`,
      });
    }),
  );
}

export function renderFinanzas(root, navegar) {
  if (hayDocumentoCorrupto() || !obtenerEstado()) {
    root.append(
      el('section', { className: 'card' }, [
        el('h1', { textContent: 'Estado local corrupto' }),
        el('p', {
          textContent:
            'El documento de forja-demo está dañado. Solo se restablece con una acción explícita.',
        }),
        el('button', {
          type: 'button',
          className: 'btn primary',
          textContent: 'Restablecer demo',
          onClick: () => {
            restablecerDemo();
            navegar('finanzas');
          },
        }),
      ]),
    );
    return;
  }

  const e = obtenerEstado();
  const act = actor();
  const ind = calcularIndicadores(e, act);
  const alertas = calcularAlertas(e, act);
  const filas = filasTablaFinanzas(e, act, e.ui.filtrosFinanzas || {});
  const msg = e.ui.mensajeUi;

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Finanzas' }),
      el('h1', { textContent: 'Panel financiero' }),
      el('p', {
        className: 'lead',
        textContent:
          'Indicadores y cobros del coach Matías Rojas · Powerlifting · workspace FORJA DEMO.',
      }),
      el('p', {
        className: 'fin-disclaimer',
        textContent: 'Datos financieros ficticios para validación del prototipo',
      }),
    ]),
    msg
      ? el('aside', {
          className: `alert-box ${msg.tipo === 'danger' ? 'danger' : msg.tipo === 'ok' ? 'ok' : ''}`,
        }, [el('p', { textContent: msg.texto })])
      : null,
    renderKpis(ind),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Próximos vencimientos' }),
      renderProximos(ind),
    ]),
    renderAlertas(alertas),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Alumnos y pagos' }),
      renderFiltros(e, navegar),
      renderTabla(filas, navegar),
    ]),
    el('p', {
      className: 'footnote',
      textContent:
        'Sin Mercado Pago, bancos ni pagos reales. Toda acción queda en auditoría demo.',
    }),
  );
}

export function renderFichaFinanciera(root, navegar) {
  const e = obtenerEstado();
  if (!e) {
    renderFinanzas(root, navegar);
    return;
  }
  const act = actor();
  const id = e.ui.fichaFinancieraAlumnoId;
  const ficha = fichaFinancieraAlumno(e, act, id);
  if (!ficha.ok) {
    root.append(
      el('section', { className: 'card' }, [
        el('p', { textContent: `No se puede abrir la ficha: ${ficha.error}` }),
        el('button', {
          type: 'button',
          className: 'btn ghost',
          textContent: 'Volver a Finanzas',
          onClick: () => navegar('finanzas'),
        }),
      ]),
    );
    return;
  }

  const { alumno, plan, cargo, ultimoPago, historial } = ficha;

  root.append(
    el('header', { className: 'view-head' }, [
      el('p', { className: 'eyebrow', textContent: 'Ficha financiera' }),
      el('h1', { textContent: alumno.nombre }),
      el('p', {
        className: 'fin-disclaimer',
        textContent: 'Datos financieros ficticios para validación del prototipo',
      }),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Plan y estado' }),
      el('dl', { className: 'kv' }, [
        el('dt', { textContent: 'Plan actual' }),
        el('dd', { textContent: plan?.nombre || 'Sin plan' }),
        el('dt', { textContent: 'Valor mensual' }),
        el('dd', {
          className: 'fin-monto',
          textContent: plan ? fmtClp(plan.valorMensual) : '—',
        }),
        el('dt', { textContent: 'Último pago' }),
        el('dd', {
          textContent: ultimoPago
            ? `${fmtClp(ultimoPago.monto)} · ${ultimoPago.fecha}`
            : '—',
        }),
        el('dt', { textContent: 'Próximo vencimiento' }),
        el('dd', { textContent: ficha.proximoVencimiento || '—' }),
        el('dt', { textContent: 'Estado' }),
        el('dd', {}, [badgeEstado(ficha.estado || 'sin_plan')]),
        el('dt', { textContent: 'Entrenador responsable' }),
        el('dd', { textContent: e.coach?.nombre || ficha.entrenadorId }),
        el('dt', { textContent: 'Modalidades' }),
        el('dd', { textContent: (ficha.modalidades || []).join(', ') }),
      ]),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Observación financiera' }),
      el('p', {
        className: 'note',
        textContent:
          'Separada de observaciones deportivas y del wellness.',
      }),
      (() => {
        const ta = el('textarea', {
          className: 'field-input',
          rows: '3',
          'aria-label': 'Observación financiera',
        });
        ta.value = ficha.observacionFinanciera || '';
        return el('div', {}, [
          ta,
          el('button', {
            type: 'button',
            className: 'btn primary',
            textContent: 'Guardar observación',
            onClick: () => {
              mutar((st) => {
                const a = st.alumnos.find((x) => x.id === alumno.id);
                if (a) a.observacionFinanciera = ta.value.trim();
                st.finanzas.auditoria.push({
                  id: `aud-obs-${Date.now()}`,
                  workspaceId: act.workspaceId,
                  coachId: act.coachId,
                  actorId: act.coachId,
                  accion: 'observacion_financiera',
                  detalle: `Actualizó observación de ${alumno.id}`,
                  fecha: new Date().toISOString(),
                });
              });
              setMensaje('Observación financiera guardada', 'ok');
              navegar('finanzas-ficha');
            },
          }),
        ]);
      })(),
    ]),
    el('section', { className: 'card' }, [
      el('h2', { textContent: 'Historial de pagos' }),
      historial.length
        ? el(
            'ul',
            { className: 'list' },
            historial.map((p) =>
              el('li', {
                textContent: `${p.fecha} · ${fmtClp(p.monto)} · ${etiquetaMedioPago(p.medio)} · ${p.comprobanteDemo}`,
              }),
            ),
          )
        : el('p', { className: 'muted', textContent: 'Sin pagos registrados.' }),
    ]),
    cargo && (cargo.estado === 'pending' || cargo.estado === 'overdue')
      ? el('div', { className: 'actions-row' }, [
          el('button', {
            type: 'button',
            className: 'btn primary',
            textContent: 'Registrar pago demo',
            onClick: () => {
              const r = registrarPago(obtenerEstado(), actor(), {
                cargoId: cargo.id,
              });
              setMensaje(
                r.ok
                  ? `Pago OK · ${fmtClp(r.pago.monto)}`
                  : `Rechazado: ${r.error}`,
                r.ok ? 'ok' : 'danger',
              );
              navegar('finanzas-ficha');
            },
          }),
        ])
      : null,
    el('div', { className: 'actions-row' }, [
      el('button', {
        type: 'button',
        className: 'btn ghost',
        textContent: 'Volver a Finanzas',
        onClick: () => navegar('finanzas'),
      }),
    ]),
  );
}
