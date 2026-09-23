/** Utilidades de UI (sin dependencias). */

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === false || v == null) {
      /* skip */
    } else if (v === true) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function fmtNum(n) {
  return new Intl.NumberFormat('es-CL').format(n);
}

export function esc(s) {
  return String(s ?? '');
}

export function barChart(series, labels, color) {
  const wrap = el('div', { className: 'chart' });
  const max = Math.max(...series, 1);
  series.forEach((v, i) => {
    const col = el('div', { className: 'chart-col' });
    const bar = el('div', {
      className: 'chart-bar',
      style: `height:${Math.round((v / max) * 100)}%;background:${color}`,
      title: String(v),
    });
    const lab = el('span', { className: 'chart-lab', textContent: labels[i] || '' });
    const val = el('span', { className: 'chart-val', textContent: String(v) });
    col.append(val, bar, lab);
    wrap.appendChild(col);
  });
  return wrap;
}
