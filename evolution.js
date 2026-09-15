(() => {
  const brands = {levis:"Levi's Línea", "levis-outlet":"Levi's Outlet", desigual:"Desigual", wiseman:"Wiseman", digital:"Canal Digital"};
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numeric = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (v == null || !String(v).trim() || String(v).trim() === '-') return null;
    const parsed = Number(String(v).replace(/[$\s.]/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const sum = (rows, field) => rows.reduce((total, row) => total + (numeric(row[field]) ?? 0), 0);
  function metrics(runtime, brand) {
    const stores = (runtime.storeData || []).filter(s => s.brand === brand);
    const summary = runtime.summaryData?.brands?.find(s => s.brand === brand);
    const traffic = (runtime.trafficStores || []).filter(s => s.brand === brand);
    const comparable = stores.filter(s => numeric(s.trafficPrev) > 0 && numeric(s.trafficNow) !== null);
    const measured = stores.filter(s => numeric(s.trafficNow) !== null);
    const sales = numeric(summary?.salesWeek) ?? (stores.length ? sum(stores, 'salesNow') : null);
    const previous = numeric(summary?.salesPrevious) ?? sum(stores, 'salesPrev');
    const exterior = sum(traffic, 'exterior');
    return {
      sales: sales !== null && previous > 0 ? sales / previous - 1 : null,
      traffic: measured.length ? sum(measured, 'trafficNow') : null,
      trafficLY: comparable.length ? sum(comparable,'trafficNow') / sum(comparable,'trafficPrev') - 1 : null,
      capture: exterior > 0 ? sum(traffic,'individual') / exterior : null,
      coverage: `${comparable.length} de ${stores.length} tiendas con base LY`
    };
  }
  function render(history, activeId, current, brandFilter = 'all') {
    const hero = document.querySelector('#inicio');
    if (!hero) return;
    hero.classList.add('denim-home');
    const visual = hero.querySelector('.hero-visual');
    if (visual && !visual.dataset.denimVersion) {
      visual.style.backgroundImage = 'url("assets/denim-cover.jpg")';
      visual.dataset.denimVersion = '1';
    }
    const heading = hero.querySelector('h1');
    if (heading) heading.textContent = 'Informe Semanal';
    let section = hero.querySelector('#brandEvolution');
    if (!section) {
      section = document.createElement('section');
      section.id = 'brandEvolution';
      section.className = 'brand-evolution';
      hero.append(section);
    }
    // Use the live imported week while retaining only earlier snapshots.
    const liveLabel = current.summaryData?.week;
    const livePeriod = current.summaryData?.period;
    const entries = [...history];
    let end = entries.findIndex(e => e.id === activeId);
    if (liveLabel) {
      const match = entries.findIndex(e => e.label === liveLabel && e.period === livePeriod);
      const live = {label:liveLabel, period:livePeriod, payload:{runtime:current}};
      if (match >= 0) { entries[match] = live; end = match; }
      else { entries.push(live); end = entries.length - 1; }
    }
    if (end < 0) end = entries.length - 1;
    const weeks = entries.slice(Math.max(0, end - 3), end + 1);
    const rows = [
      ['sales','Ventas vs LY','sales'], ['traffic','Tráfico interior','traffic'],
      ['trafficLY','Tráfico vs LY','traffic'], ['capture','Tasa de captura','capture']
    ];
    const format = (value, key) => value === null ? (key === 'capture' ? 'Sin medición' : 'Sin base')
      : key === 'traffic' ? value.toLocaleString('es-CO')
      : `${value > 0 && key !== 'capture' ? '+' : ''}${(value*100).toLocaleString('es-CO',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
    section.innerHTML = `<div class="evolution-heading"><div><p>Evolución por marca</p><h2>Últimas ${weeks.length} semanas</h2></div><span>${escape(weeks[0]?.label || '')} / ${escape(weeks.at(-1)?.label || '')}</span></div>
      <div class="evolution-brands">${Object.entries(brands).filter(([brand]) => brandFilter === 'all' || brand === brandFilter).map(([brand,label]) => {
        const points = weeks.map(w => metrics(w.payload?.runtime || {},brand));
        return `<article class="evolution-brand" data-brand="${brand}"><h3>${escape(label)}</h3><div class="evolution-table-wrap"><table><thead><tr><th scope="col">Indicador</th>${weeks.map(w=>`<th scope="col" title="${escape(w.period)}">${escape(w.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(([key,label,tone])=> {
          const max = Math.max(...points.map(p=>Math.abs(p[key] ?? 0)),0.01);
          return `<tr class="evolution-${tone}"><th scope="row">${label}</th>${points.map(p=>`<td title="${escape(key==='trafficLY' ? p.coverage : label)}"><strong class="${p[key] < 0 ? 'negative' : ''}">${format(p[key],key)}</strong><span class="evolution-track" aria-hidden="true"><i class="${p[key] < 0 ? 'negative' : ''}" style="width:${Math.abs(p[key] ?? 0)/max*100}%"></i></span></td>`).join('')}</tr>`;
        }).join('')}</tbody></table></div><p class="evolution-coverage">${escape(points.at(-1)?.coverage || '')}${brand==='digital' ? ' · Captura física no aplica' : ''}</p></article>`;
      }).join('')}</div><p class="evolution-note">LY: año anterior. Tráfico vs LY: tiendas con base comparable en cada semana. Captura: entradas / tráfico exterior medido.</p>`;
  }
  window.ReportEvolution = {render, metrics};
})();
