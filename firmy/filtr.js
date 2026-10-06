// Filtrovani, razeni a strankovani seznamu. Konfigurace v window.FILTR:
//   data    URL JSON pole zaznamu        sort    [klic, vzestupne]
//   search  klice pro fulltext            filters [{id, type: from|to|select|multi|bool, key}]
//   row     funkce zaznam -> HTML bunek radku
(function () {
  const C = window.FILTR;
  const PAGE = 50;
  const $ = id => document.getElementById(id);
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  window.esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  window.fmtDate = s => {
    if (!s) return '–';
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${+d}. ${+m}. ${y}`;
  };

  let all = [], rows = [], [sortKey, asc] = C.sort, page = 1;

  function fillSelects() {
    for (const f of C.filters) {
      if (f.type !== 'select' && f.type !== 'multi') continue;
      const vals = new Set();
      for (const r of all) [].concat(r[f.key] ?? []).forEach(v => v && vals.add(v));
      const sel = $(f.id);
      [...vals].sort((a, b) => a.localeCompare(b, 'cs')).forEach(v => sel.add(new Option(v, v)));
    }
  }

  function matches(r, f, v) {
    const x = r[f.key];
    switch (f.type) {
      case 'from': return (x || '') >= v;
      case 'to': return (x || '') <= v;
      case 'select': return x === v;
      case 'multi': return (x || []).includes(v);
      case 'bool': return String(!!x) === v;
    }
    return true;
  }

  function apply() {
    const q = norm($('f-q').value.trim());
    const active = C.filters.map(f => [f, $(f.id).value]).filter(([, v]) => v);
    rows = all.filter(r => active.every(([f, v]) => matches(r, f, v)) &&
                           (!q || C.search.some(k => norm(r[k]).includes(q))));
    page = 1;
    render();
  }

  function render() {
    const data = [...rows].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb
              : String(va ?? '').localeCompare(String(vb ?? ''), 'cs');
      return asc ? c : -c;
    });
    const pages = Math.max(1, Math.ceil(data.length / PAGE));
    $('count').textContent = data.length.toLocaleString('cs') + ' záznamů';
    const cols = document.querySelectorAll('thead th').length;
    $('tbody').innerHTML = data.slice((page - 1) * PAGE, page * PAGE).map(r => `<tr>${C.row(r)}</tr>`).join('')
      || `<tr><td colspan="${cols}" class="empty">Nic nenalezeno.</td></tr>`;
    pager(pages);
  }

  function pager(pages) {
    const el = $('pagination');
    el.innerHTML = '';
    if (pages <= 1) return;
    const btn = (label, p) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (p === page && label === String(p)) b.classList.add('active');
      b.onclick = () => { page = p; render(); window.scrollTo({top: $('tbody').closest('.card').offsetTop - 10}); };
      el.appendChild(b);
    };
    if (page > 1) btn('‹', page - 1);
    const lo = Math.max(1, page - 2), hi = Math.min(pages, page + 2);
    if (lo > 1) btn('1', 1);
    for (let i = lo; i <= hi; i++) btn(String(i), i);
    if (hi < pages) btn(String(pages), pages);
    if (page < pages) btn('›', page + 1);
  }

  document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.sort;
    if (k === sortKey) asc = !asc; else { sortKey = k; asc = true; }
    document.querySelectorAll('th').forEach(t => t.classList.toggle('active', t === th));
    render();
  }));
  $('f-q').addEventListener('input', apply);
  C.filters.forEach(f => $(f.id).addEventListener('change', apply));
  $('f-reset').addEventListener('click', () => {
    $('f-q').value = '';
    C.filters.forEach(f => { $(f.id).value = ''; });
    apply();
  });

  fetch(C.data)
    .then(r => r.json())
    .then(d => { all = d; fillSelects(); apply(); })
    .catch(() => {
      $('tbody').innerHTML = '<tr><td colspan="20" class="empty">Data se nepodařilo načíst. Stránku je potřeba otevřít přes web server.</td></tr>';
    });
})();
