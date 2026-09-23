import { clear, el } from './util.js';
import {
  cargarEstado,
  mutar,
  restablecerDemo,
  obtenerEstado,
  hayDocumentoCorrupto,
} from './state.js';
import { renderInicio } from './views/inicio.js';
import { renderPlanificacion, renderSesion } from './views/planificacion.js';
import { renderAlumnos, renderAlumno } from './views/alumnos.js';
import { renderBanco } from './views/banco.js';
import { renderWellness } from './views/wellness.js';
import { renderRegistro } from './views/registro.js';
import { renderSeguimiento } from './views/seguimiento.js';
import { renderAsistente } from './views/asistente.js';
import { renderFinanzas, renderFichaFinanciera } from './views/finanzas.js';

const VISTAS = {
  inicio: renderInicio,
  planificacion: renderPlanificacion,
  sesion: renderSesion,
  alumnos: renderAlumnos,
  alumno: renderAlumno,
  banco: renderBanco,
  wellness: renderWellness,
  registro: renderRegistro,
  seguimiento: renderSeguimiento,
  asistente: renderAsistente,
  finanzas: renderFinanzas,
  'finanzas-ficha': renderFichaFinanciera,
};

const NAV_PRINCIPAL = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'planificacion', label: 'Planificación' },
  { id: 'alumnos', label: 'Alumnos' },
  { id: 'banco', label: 'Banco de ejercicios' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'asistente', label: 'Asistente IA' },
];

function hashVista() {
  const h = (location.hash || '#inicio').replace(/^#/, '');
  return VISTAS[h] ? h : 'inicio';
}

export function navegar(vista) {
  const id = VISTAS[vista] ? vista : 'inicio';
  if (location.hash !== `#${id}`) {
    location.hash = id;
  } else {
    pintar();
  }
}

function syncNav(vista) {
  const nav = document.getElementById('nav-principal');
  const mobile = document.getElementById('nav-mobile');
  for (const container of [nav, mobile]) {
    if (!container) continue;
    for (const btn of container.querySelectorAll('[data-vista]')) {
      const active =
        btn.getAttribute('data-vista') === vista ||
        (vista === 'alumno' && btn.getAttribute('data-vista') === 'alumnos') ||
        (vista === 'sesion' && btn.getAttribute('data-vista') === 'planificacion') ||
        ((vista === 'wellness' || vista === 'registro') &&
          btn.getAttribute('data-vista') === 'planificacion') ||
        (vista === 'finanzas-ficha' &&
          btn.getAttribute('data-vista') === 'finanzas');
      btn.classList.toggle('is-active', active);
    }
  }
}

function pintarCorrupto(root) {
  clear(root);
  root.append(
    el('section', { className: 'card' }, [
      el('h1', { textContent: 'Estado local corrupto' }),
      el('p', {
        textContent:
          'El documento de forja-demo está dañado y no se reescribió automáticamente. Usa «Restablecer demo» para recuperar solo esta demo.',
      }),
      el('button', {
        type: 'button',
        className: 'btn primary',
        textContent: 'Restablecer demo',
        onClick: () => {
          restablecerDemo();
          navegar('inicio');
        },
      }),
    ]),
  );
}

function pintar() {
  const root = document.getElementById('app-root');
  if (!root) return;
  if (hayDocumentoCorrupto() || !obtenerEstado()) {
    pintarCorrupto(root);
    syncNav('inicio');
    return;
  }
  const vista = hashVista();
  mutar((st) => {
    st.ui.vista = vista;
  });
  clear(root);
  const render = VISTAS[vista];
  render(root, navegar);
  syncNav(vista);
  window.scrollTo(0, 0);
}

function montarNav() {
  const nav = document.getElementById('nav-principal');
  const mobile = document.getElementById('nav-mobile');
  clear(nav);
  clear(mobile);

  for (const item of NAV_PRINCIPAL) {
    const mk = (container, className) => {
      container.appendChild(
        elBtn(item.id, item.label, className),
      );
    };
    mk(nav, 'nav-link');
    mk(mobile, 'nav-mobile-link');
  }
}

function elBtn(id, label, className) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.dataset.vista = id;
  b.textContent = label;
  b.addEventListener('click', () => navegar(id));
  return b;
}

function cablearChrome() {
  const reset = document.getElementById('btn-reset');
  if (reset) {
    reset.addEventListener('click', () => {
      restablecerDemo();
      navegar('inicio');
    });
  }
  const toggle = document.getElementById('btn-nav-toggle');
  const drawer = document.getElementById('nav-mobile');
  if (toggle && drawer) {
    toggle.addEventListener('click', () => {
      drawer.classList.toggle('is-open');
      toggle.setAttribute(
        'aria-expanded',
        drawer.classList.contains('is-open') ? 'true' : 'false',
      );
    });
    drawer.addEventListener('click', (ev) => {
      if (ev.target.matches('button')) drawer.classList.remove('is-open');
    });
  }
}

function main() {
  cargarEstado();
  montarNav();
  cablearChrome();
  const st = obtenerEstado();
  if (st.ui?.vista && VISTAS[st.ui.vista] && !location.hash) {
    location.hash = st.ui.vista;
  }
  window.addEventListener('hashchange', pintar);
  pintar();
}

main();
