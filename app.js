// ============================================
// INSUMOS BODEGA — v4.0
// ============================================

let stock    = JSON.parse(localStorage.getItem('stock'))    || {};
let historial = JSON.parse(localStorage.getItem('historial')) || [];

// Autocomplete state
let acSelected = -1;
let acItems    = [];
let acInsumoSeleccionado = null; // nombre seleccionado del stock

function guardar() {
  localStorage.setItem('stock',    JSON.stringify(stock));
  localStorage.setItem('historial', JSON.stringify(historial));
}

function fechaHora() {
  const n = new Date();
  return n.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' })
    + ' ' + n.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// ── CLOCK ──────────────────────────────────
function tickClock() {
  const el = document.getElementById('clockEl');
  if (el) el.textContent = fechaHora();
}
tickClock();
setInterval(tickClock, 1000);

// ── TOAST ──────────────────────────────────
function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  const color = tipo === 'ok' ? 'var(--green)' : 'var(--red)';
  const icon  = tipo === 'ok' ? '✓' : '✕';
  const bdr   = tipo === 'ok' ? 'rgba(29,255,143,0.2)' : 'rgba(255,69,69,0.2)';
  el.innerHTML = `<span style="color:${color};font-weight:700;font-size:.9rem;">${icon}</span><span style="color:var(--text-2);font-family:'IBM Plex Mono',monospace;">${msg}</span>`;
  el.style.display       = 'flex';
  el.style.borderColor   = bdr;
  el.style.animation     = 'none';
  void el.offsetWidth;
  el.style.animation     = '';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3200);
}

// ── AUTOCOMPLETE ───────────────────────────
function onInsumoSearch(val) {
  acInsumoSeleccionado = null;
  acSelected = -1;
  actualizarHint('');

  const list = document.getElementById('acList');
  const q = val.trim().toLowerCase();

  const matches = Object.keys(stock)
    .filter(k => stock[k] > 0 && (q === '' || k.toLowerCase().includes(q)))
    .slice(0, 10);

  acItems = matches;

  if (!q && matches.length === 0) { list.classList.remove('open'); return; }

  list.innerHTML = '';

  if (matches.length === 0) {
    list.innerHTML = `<div class="ac-empty">Sin resultados para "${val}"</div>`;
    list.classList.add('open');
    return;
  }

  matches.forEach((nombre, i) => {
    const div = document.createElement('div');
    div.className = 'ac-item';
    div.dataset.idx = i;
    const qty = stock[nombre];
    const qtyClass = qty <= 5 ? 'ac-qty' : 'ac-qty';
    div.innerHTML = `<span class="ac-name">${highlight(nombre, q)}</span><span class="${qtyClass}" style="${qty<=5?'color:var(--red);background:var(--red-bg);border-color:var(--red-line);':''}">${qty} uds.</span>`;
    div.addEventListener('mousedown', e => { e.preventDefault(); selectAcItem(nombre, qty); });
    list.appendChild(div);
  });

  list.classList.add('open');
}

function highlight(text, q) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return text.slice(0, idx)
    + `<strong style="color:var(--white)">${text.slice(idx, idx + q.length)}</strong>`
    + text.slice(idx + q.length);
}

function selectAcItem(nombre, qty) {
  acInsumoSeleccionado = nombre;
  document.getElementById('retiroInsumo').value = nombre;
  document.getElementById('acList').classList.remove('open');
  actualizarHint(nombre, qty);
}

function actualizarHint(nombre, qty) {
  const hint = document.getElementById('stockHint');
  if (!hint) return;
  if (!nombre) { hint.className = 'stock-hint'; hint.textContent = ''; return; }
  const q = qty !== undefined ? qty : stock[nombre] || 0;
  if (q <= 0) {
    hint.className = 'stock-hint err visible';
    hint.textContent = `✕ Sin stock disponible`;
  } else if (q <= 5) {
    hint.className = 'stock-hint warn visible';
    hint.textContent = `⚠ Stock bajo — ${q} unidades disponibles`;
  } else {
    hint.className = 'stock-hint visible';
    hint.textContent = `✓ ${q} unidades disponibles`;
  }
}

function onInsumoKey(e) {
  const list = document.getElementById('acList');
  const items = list.querySelectorAll('.ac-item');
  if (!list.classList.contains('open') || items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    acSelected = Math.min(acSelected + 1, items.length - 1);
    highlightAcItems(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    acSelected = Math.max(acSelected - 1, -1);
    highlightAcItems(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (acSelected >= 0 && acItems[acSelected]) {
      selectAcItem(acItems[acSelected], stock[acItems[acSelected]]);
    }
  } else if (e.key === 'Escape') {
    list.classList.remove('open');
  }
}

function highlightAcItems(items) {
  items.forEach((el, i) => {
    el.classList.toggle('active', i === acSelected);
  });
}

// Cerrar dropdown al clic fuera
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    const list = document.getElementById('acList');
    if (list) list.classList.remove('open');
  }
});

// ── AGREGAR ────────────────────────────────
function agregar() {
  const nombre   = document.getElementById('nombre').value.trim();
  const cantidad = parseInt(document.getElementById('cantidad').value);

  if (!nombre)           { toast('Ingrese el nombre del componente', 'err'); return; }
  if (!cantidad || cantidad <= 0) { toast('Ingrese una cantidad válida', 'err'); return; }

  if (!stock[nombre]) stock[nombre] = 0;
  stock[nombre] += cantidad;

  historial.push({ tipo:'agregar', componente:nombre, cantidad, fecha:fechaHora() });
  guardar();
  render();

  document.getElementById('nombre').value   = '';
  document.getElementById('cantidad').value = '';
  toast(`${cantidad} uds. de "${nombre}" agregadas`);
}

// ── RETIRAR ────────────────────────────────
function retirar() {
  // El insumo debe provenir del autocomplete O escribirse manualmente si existe en stock
  const nombreInput = document.getElementById('retiroInsumo').value.trim();
  const nombre      = acInsumoSeleccionado || nombreInput;
  const cantidad    = parseInt(document.getElementById('cantidadRetiro').value);
  const equipo      = document.getElementById('equipo').value.trim();
  const quienRetira = document.getElementById('quienRetira').value.trim();
  const os          = document.getElementById('os').value.trim();
  const cot         = document.getElementById('cot').value.trim();

  if (!nombre)                          { toast('Seleccione o escriba un insumo', 'err'); return; }
  if (!cantidad || cantidad <= 0)        { toast('Ingrese una cantidad válida', 'err'); return; }
  if (!quienRetira)                      { toast('Ingrese el nombre del responsable', 'err'); return; }
  if (!stock[nombre] || stock[nombre] < cantidad) {
    toast(`Stock insuficiente. Disponible: ${stock[nombre] || 0}`, 'err');
    return;
  }

  stock[nombre] -= cantidad;

  historial.push({
    tipo: 'retirar',
    componente: nombre,
    cantidad,
    equipo: equipo || null,
    quienRetira,
    os:  os  || null,
    cot: cot || null,
    fecha: fechaHora()
  });

  guardar();
  render();

  // Limpiar
  document.getElementById('retiroInsumo').value  = '';
  document.getElementById('cantidadRetiro').value = '';
  document.getElementById('equipo').value          = '';
  document.getElementById('quienRetira').value     = '';
  document.getElementById('os').value              = '';
  document.getElementById('cot').value             = '';
  acInsumoSeleccionado = null;
  actualizarHint('');

  toast(`${cantidad} uds. de "${nombre}" retiradas`);
}

// ── RENDER ─────────────────────────────────
function render() {
  const stockItems = Object.keys(stock).filter(k => stock[k] > 0);
  const totalUds   = stockItems.reduce((s, k) => s + stock[k], 0);
  const bajo       = stockItems.filter(k => stock[k] <= 5).length;

  // Stats
  setStat('statTotal',      stockItems.length);
  setStat('statUnidades',   totalUds);
  setStat('statMovimientos', historial.length);
  setStat('statBajo',       bajo);

  // Stock table
  const empty = document.getElementById('stockEmpty');
  const table = document.getElementById('stockTable');
  const tbody = document.getElementById('stockBody');

  if (!tbody) return;
  tbody.innerHTML = '';

  if (stockItems.length === 0) {
    if (empty) empty.style.display = 'flex';
    if (table) table.style.display = 'none';
  } else {
    if (empty) empty.style.display = 'none';
    if (table) table.style.display = 'table';

    stockItems
      .sort((a, b) => a.localeCompare(b))
      .forEach((nombre, i) => {
        const qty  = stock[nombre];
        const low  = qty <= 5;
        const tr   = document.createElement('tr');
        tr.innerHTML = `
          <td style="color:var(--text-3);font-family:'IBM Plex Mono',monospace;font-size:.7rem;">${String(i+1).padStart(2,'0')}</td>
          <td>${nombre}</td>
          <td><span class="qty-badge${low?' low':''}">${qty} uds.</span></td>
        `;
        tbody.appendChild(tr);
      });
  }
}

function setStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── EXPORT PDF ─────────────────────────────
function exportPDF() {
  if (historial.length === 0) { toast('No hay movimientos para exportar', 'err'); return; }

  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF();
  const W    = doc.internal.pageSize.getWidth();
  const H    = doc.internal.pageSize.getHeight();
  const M    = 20;
  let y      = M;

  // Header bar
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15); doc.setFont(undefined, 'bold');
  doc.text('INSUMOS BODEGA', M, 15);
  doc.setFontSize(8); doc.setFont(undefined, 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('Historial de Movimientos', M, 23);
  doc.text(`Generado: ${fechaHora()}`, M, 30);
  y = 48;

  doc.setFontSize(9);

  historial.forEach((r, idx) => {
    if (y > H - 42) { doc.addPage(); y = M; }

    const isAdd = r.tipo === 'agregar';
    doc.setFont(undefined, 'bold');
    doc.setTextColor(isAdd ? 29 : 220, isAdd ? 200 : 50, isAdd ? 100 : 50);
    doc.text(`${isAdd ? '↑ ENTRADA' : '↓ SALIDA'}`, M, y);
    doc.setTextColor(140, 140, 140);
    doc.text(r.fecha, W - M, y, { align: 'right' });
    y += 6;

    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(`Componente: ${r.componente}`, M + 4, y); y += 5;
    doc.text(`Cantidad: ${r.cantidad} unidades`, M + 4, y); y += 5;

    if (!isAdd) {
      if (r.equipo)      { doc.text(`Equipo: ${r.equipo}`,            M + 4, y); y += 5; }
      doc.text(`Responsable: ${r.quienRetira}`,                        M + 4, y); y += 5;
      if (r.os)          { doc.text(`OS: ${r.os}`,                    M + 4, y); y += 5; }
      if (r.cot)         { doc.text(`COT: ${r.cot}`,                  M + 4, y); y += 5; }
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(M, y + 2, W - M, y + 2);
    y += 8;
  });

  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(`Total: ${historial.length} movimientos  ·  INSUMOS BODEGA v4.0`, M, H - 10);

  doc.save(`InsumosBodega_${new Date().toISOString().split('T')[0]}.pdf`);
  toast('PDF exportado correctamente');
}

// ── AUTH ───────────────────────────────────
function logout() {
  if (confirm('¿Cerrar sesión?')) {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  }
}

if (window.location.pathname.includes('dashboard.html')) {
  if (!localStorage.getItem('user')) window.location.href = 'index.html';
}

// Init
render();
