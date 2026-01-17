(function () {
  const themeSelect = document.getElementById('theme');
  const themeLink = document.getElementById('theme-css');
  const uiSelect = document.getElementById('ui');

  // Sidebar (mobile)
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.getElementById('btn-sidebar');
  let sidebarBackdrop = document.querySelector('.sidebar-backdrop');

  function isMobileNav() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 991px)').matches);
  }

  function openSidebar() {
    if (!sidebar) return;
    document.body.classList.add('sidebar-open');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
  }

  if (!sidebarBackdrop) {
    sidebarBackdrop = document.createElement('div');
    sidebarBackdrop.className = 'sidebar-backdrop';
    sidebarBackdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sidebarBackdrop);
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      if (document.body.classList.contains('sidebar-open')) closeSidebar();
      else openSidebar();
    });
  }

  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);
  window.addEventListener('resize', () => {
    if (!isMobileNav()) closeSidebar();
  });

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (_) {
      return null;
    }
  }

  function getMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute('content') : null;
  }

  function isFixedThemePage() {
    return document.body && document.body.hasAttribute('data-fixed-theme');
  }

  function isFixedUiPage() {
    return document.body && document.body.hasAttribute('data-fixed-ui');
  }

  function getInitialTheme() {
    const queryTheme = getQueryParam('theme');
    if (queryTheme) return queryTheme;

    if (isFixedThemePage()) return document.body.getAttribute('data-fixed-theme');

    try {
      const saved = localStorage.getItem('demo.theme');
      if (saved) return saved;
    } catch (_) {}

    if (themeSelect && themeSelect.value) return themeSelect.value;

    return 'aurora';
  }

  function getInitialUi() {
    const queryUi = getQueryParam('ui');
    if (queryUi) return queryUi;

    if (isFixedUiPage()) return document.body.getAttribute('data-fixed-ui');

    const meta = getMeta('demo-ui');
    if (meta) return meta;

    try {
      const saved = localStorage.getItem('demo.ui');
      if (saved) return saved;
    } catch (_) {}

    if (uiSelect && uiSelect.value) return uiSelect.value;

    return 'fluid';
  }

  function setTheme(themeId, options) {
    const opts = options || {};
    if (themeLink) themeLink.setAttribute('href', new URL(`assets/css/${themeId}.css`, document.baseURI).toString());
    document.documentElement.setAttribute('data-theme', themeId);

    if (themeSelect) {
      themeSelect.value = themeId;
      if (opts.locked) themeSelect.setAttribute('disabled', 'disabled');
    }

    if (!opts.skipPersist) {
      try {
        localStorage.setItem('demo.theme', themeId);
      } catch (_) {}
    }
  }

  function setUi(uiId, options) {
    const opts = options || {};
    const next = (uiId || '').toString().trim();

    if (next) document.documentElement.setAttribute('data-ui', next);
    else document.documentElement.removeAttribute('data-ui');

    if (uiSelect) {
      uiSelect.value = next;
      if (opts.locked) uiSelect.setAttribute('disabled', 'disabled');
    }

    if (!opts.skipPersist) {
      try {
        localStorage.setItem('demo.ui', next);
      } catch (_) {}
    }
  }

  const initialTheme = getInitialTheme();
  setTheme(initialTheme, { locked: isFixedThemePage() });

  const initialUi = getInitialUi();
  setUi(initialUi, { locked: isFixedUiPage() });

  if (themeSelect && !isFixedThemePage()) {
    themeSelect.addEventListener('change', (e) => setTheme(e.target.value));
  }

  if (uiSelect && !isFixedUiPage()) {
    uiSelect.addEventListener('change', (e) => setUi(e.target.value));
  }

  // Select2
  if (window.jQuery && jQuery.fn.select2) {
    jQuery('.js-select2').select2({
      width: '100%',
      minimumResultsForSearch: 8
    });
  }

  // DataTables
  function initDataTables() {
    if (!window.jQuery || !jQuery.fn || !jQuery.fn.DataTable) return;

    jQuery('.js-datatable').each(function () {
      const table = this;
      const $table = jQuery(table);
      const mode = ($table.data('dt') || 'standard').toString();

      if (jQuery.fn.dataTable.isDataTable(table)) {
        $table.DataTable().destroy();
      }

      const base = {
        searching: false,
        lengthChange: false,
        language: {
          emptyTable: '',
          zeroRecords: '',
          info: 'Mostrando _START_–_END_ de _TOTAL_',
          infoEmpty: 'Sem dados',
          paginate: { previous: 'Anterior', next: 'Próximo' }
        }
      };

      const opts =
        mode === 'summary'
          ? {
              ...base,
              paging: false,
              info: false,
              ordering: false
            }
          : {
              ...base,
              paging: true,
              pageLength: 6,
              info: true,
              ordering: true,
              order: []
            };

      $table.DataTable(opts);
    });
  }

  // Flatpickr
  if (window.flatpickr) {
    flatpickr('.js-datetime', {
      mode: 'range',
      dateFormat: 'd/m/Y',
      allowInput: true
    });
  }

  // Modal (lightweight Bootstrap-like)
  function openModal(selector) {
    const modal = document.querySelector(selector);
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-modal]');
    if (openBtn) {
      e.preventDefault();
      openModal(openBtn.getAttribute('data-open-modal'));
      return;
    }

    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      e.preventDefault();
      closeModal(closeBtn.closest('.modal'));
      return;
    }

    const modal = e.target.classList && e.target.classList.contains('modal') ? e.target : null;
    if (modal) {
      closeModal(modal);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.querySelector('.modal.show');
    if (modal) {
      closeModal(modal);
      return;
    }
    if (document.body.classList.contains('sidebar-open')) closeSidebar();
  });

  // -------------------------
  // Dashboard (dados simulados)
  // -------------------------
  const els = {
    mapSelected: document.getElementById('map-selected'),
    badgeOnline: document.getElementById('badge-online'),
    badgeAttention: document.getElementById('badge-attention'),
    badgeCritical: document.getElementById('badge-critical'),

    vehiclesTbody: document.getElementById('vehicles-tbody'),
    vehiclesEmpty: document.getElementById('vehicles-empty'),

    eventsTbody: document.getElementById('events-tbody'),
    eventsEmpty: document.getElementById('events-empty'),
    eventsFullTbody: document.getElementById('events-full-tbody'),
    eventsFullEmpty: document.getElementById('events-full-empty'),

    routesTbody: document.getElementById('routes-tbody'),
    routesEmpty: document.getElementById('routes-empty'),

    kpiDistance: document.getElementById('kpi-distance'),
    kpiFuel: document.getElementById('kpi-fuel'),
    kpiIdle: document.getElementById('kpi-idle'),
    kpiAlerts: document.getElementById('kpi-alerts'),
    kpiDistanceTrend: document.getElementById('kpi-distance-trend'),
    kpiFuelTrend: document.getElementById('kpi-fuel-trend'),
    kpiIdleTrend: document.getElementById('kpi-idle-trend'),
    kpiAlertsTrend: document.getElementById('kpi-alerts-trend'),

    fleet: document.getElementById('fleet'),
    search: document.getElementById('search'),
    period: document.getElementById('period'),
    btnApply: document.getElementById('btn-apply'),
    btnClear: document.getElementById('btn-clear'),
    btnExport: document.getElementById('btn-export'),
    btnReport: document.getElementById('btn-report'),
    btnQuickFilter: document.getElementById('btn-quick-filter'),
    btnCreateAlert: document.getElementById('btn-create-alert'),
    btnSaveAlert: document.getElementById('btn-save-alert'),

    vehicleModalTitle: document.getElementById('vehicleModalTitle'),
    vehicleModalBody: document.getElementById('vehicleModalBody'),
    vehicleModalAction: document.getElementById('vehicleModalAction'),

    alertVehicle: document.getElementById('alert-vehicle'),
    alertType: document.getElementById('alert-type'),
    alertThreshold: document.getElementById('alert-threshold'),
    alertChannel: document.getElementById('alert-channel'),
    alertNotes: document.getElementById('alert-notes'),

    reportsLog: document.getElementById('reports-log'),
    settingDensity: document.getElementById('setting-density'),
    settingAutorefresh: document.getElementById('setting-autorefresh')
  };

  const VEHICLES = [
    { id: 'v1', plate: 'ABC-1234', kind: 'Caminhão', group: 'Grupo Norte', fleet: 'Operação SP', driver: 'Marcos Lima', status: 'online', state: 'Em rota', speedKmh: 62, lastSignalSec: 15, distanceTodayKm: 182, fuelTodayL: 48, idleMin: 22 },
    { id: 'v2', plate: 'KLM-7788', kind: 'Van', group: 'Filial Sul', fleet: 'Filial Sul', driver: 'Renata Alves', status: 'attention', state: 'Parado', speedKmh: 0, lastSignalSec: 180, distanceTodayKm: 74, fuelTodayL: 22, idleMin: 96 },
    { id: 'v3', plate: 'XYZ-9090', kind: 'Carro', group: 'Operação SP', fleet: 'Operação SP', driver: 'João Pedro', status: 'critical', state: 'Alerta', speedKmh: 88, lastSignalSec: 8, distanceTodayKm: 126, fuelTodayL: 18, idleMin: 8 },
    { id: 'v4', plate: 'QWE-2020', kind: 'Caminhão', group: 'Operação RJ', fleet: 'Operação RJ', driver: 'Carla Souza', status: 'online', state: 'Em rota', speedKmh: 54, lastSignalSec: 42, distanceTodayKm: 210, fuelTodayL: 63, idleMin: 18 },
    { id: 'v5', plate: 'RTY-4411', kind: 'Van', group: 'Grupo Norte', fleet: 'Operação SP', driver: 'Paulo Reis', status: 'online', state: 'Em rota', speedKmh: 71, lastSignalSec: 22, distanceTodayKm: 96, fuelTodayL: 28, idleMin: 12 },
    { id: 'v6', plate: 'HJK-5500', kind: 'Carro', group: 'Operação RJ', fleet: 'Operação RJ', driver: 'Bianca Moraes', status: 'attention', state: 'Sem sinal', speedKmh: 0, lastSignalSec: 680, distanceTodayKm: 52, fuelTodayL: 10, idleMin: 140 }
  ];

  const ROUTES = [
    { id: 'r1', name: 'SP → Santos', vehicleId: 'v1', durationMin: 128 },
    { id: 'r2', name: 'RJ Centro → Duque de Caxias', vehicleId: 'v4', durationMin: 74 },
    { id: 'r3', name: 'Curitiba → Joinville', vehicleId: 'v2', durationMin: 156 }
  ];

  const EVENTS = [
    { id: 'e1', whenMinAgo: 3, vehicleId: 'v3', kind: 'Excesso de velocidade', severity: 'danger' },
    { id: 'e2', whenMinAgo: 14, vehicleId: 'v6', kind: 'Perda de sinal', severity: 'warning' },
    { id: 'e3', whenMinAgo: 26, vehicleId: 'v2', kind: 'Parada prolongada', severity: 'warning' },
    { id: 'e4', whenMinAgo: 47, vehicleId: 'v1', kind: 'Entrada em área', severity: 'success' }
  ];

  function formatAgo(seconds) {
    if (seconds < 60) return `há ${seconds}s`;
    const min = Math.round(seconds / 60);
    if (min < 60) return `há ${min}min`;
    const h = Math.round(min / 60);
    return `há ${h}h`;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function badgeForStatus(vehicle) {
    if (vehicle.status === 'critical') return { cls: 'badge-danger', label: vehicle.state };
    if (vehicle.status === 'attention') return { cls: 'badge-warning', label: vehicle.state };
    return { cls: 'badge-success', label: vehicle.state };
  }

  function getFilters() {
    const fleet = els.fleet ? (els.fleet.value || '').trim() : '';
    const search = els.search ? (els.search.value || '').trim().toLowerCase() : '';
    const period = els.period ? (els.period.value || '').trim() : '';
    return { fleet, search, period };
  }

  function applyFilters(vehicles, filters) {
    return vehicles.filter((v) => {
      if (filters.fleet && v.fleet !== filters.fleet) return false;
      if (filters.search) {
        const hay = `${v.plate} ${v.driver} ${v.group} ${v.kind} ${v.fleet}`.toLowerCase();
        if (!hay.includes(filters.search)) return false;
      }
      return true;
    });
  }

  function updateBadges(allVehicles) {
    if (!els.badgeOnline) return;
    const online = allVehicles.filter((v) => v.status === 'online').length;
    const attention = allVehicles.filter((v) => v.status === 'attention').length;
    const critical = allVehicles.filter((v) => v.status === 'critical').length;

    els.badgeOnline.textContent = `Online ${online}`;
    els.badgeAttention.textContent = `Atenção ${attention}`;
    els.badgeCritical.textContent = `Crítico ${critical}`;
  }

  function updateKpis(vehicles) {
    if (!els.kpiDistance) return;
    const totalKm = vehicles.reduce((sum, v) => sum + v.distanceTodayKm, 0);
    const totalFuel = vehicles.reduce((sum, v) => sum + v.fuelTodayL, 0);
    const totalIdle = vehicles.reduce((sum, v) => sum + v.idleMin, 0);
    const alerts = vehicles.filter((v) => v.status === 'critical').length + vehicles.filter((v) => v.status === 'attention').length;

    els.kpiDistance.textContent = `${totalKm.toLocaleString('pt-BR')} km`;
    els.kpiFuel.textContent = `${totalFuel.toLocaleString('pt-BR')} L`;
    els.kpiIdle.textContent = `${Math.floor(totalIdle / 60)}h ${totalIdle % 60}m`;
    els.kpiAlerts.textContent = `${alerts}`;

    els.kpiDistanceTrend.textContent = '+6,2%';
    els.kpiFuelTrend.textContent = '+1,1%';
    els.kpiIdleTrend.textContent = '+18%';
    els.kpiAlertsTrend.textContent = 'últ. 24h';
  }

  function renderVehicles(vehicles) {
    if (!els.vehiclesTbody) return;
    if (!vehicles.length) {
      els.vehiclesTbody.innerHTML = '';
      if (els.vehiclesEmpty) els.vehiclesEmpty.style.display = '';
      return;
    }

    if (els.vehiclesEmpty) els.vehiclesEmpty.style.display = 'none';
    els.vehiclesTbody.innerHTML = vehicles
      .map((v) => {
        const badge = badgeForStatus(v);
        return `
<tr data-vehicle-id="${escapeHtml(v.id)}">
  <td>
    <div class="font-weight-semibold">${escapeHtml(v.plate)}</div>
    <div class="text-muted small">${escapeHtml(v.kind)} • ${escapeHtml(v.group)}</div>
  </td>
  <td><span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span></td>
  <td>${escapeHtml(v.speedKmh)} km/h</td>
  <td class="text-muted">${escapeHtml(formatAgo(v.lastSignalSec))}</td>
  <td class="text-right">
    <button class="btn btn-sm btn-outline-secondary" type="button" data-action="details" data-vehicle-id="${escapeHtml(v.id)}">Detalhes</button>
    <button class="btn btn-sm btn-outline-danger" type="button" data-action="block" data-vehicle-id="${escapeHtml(v.id)}">Bloquear</button>
  </td>
</tr>`;
      })
      .join('');
  }

  function vehicleById(id) {
    return VEHICLES.find((v) => v.id === id) || null;
  }

  function renderEventsSummary() {
    if (!els.eventsTbody) return;
    const rows = EVENTS.slice(0, 6);
    if (!rows.length) {
      els.eventsTbody.innerHTML = '';
      if (els.eventsEmpty) els.eventsEmpty.style.display = '';
      return;
    }
    if (els.eventsEmpty) els.eventsEmpty.style.display = 'none';
    els.eventsTbody.innerHTML = rows
      .map((e) => {
        const v = vehicleById(e.vehicleId);
        const when = `há ${e.whenMinAgo}min`;
        const badgeCls = e.severity === 'danger' ? 'badge-danger' : e.severity === 'warning' ? 'badge-warning' : 'badge-success';
        return `
<tr data-event-id="${escapeHtml(e.id)}">
  <td class="text-muted">${escapeHtml(when)}</td>
  <td>
    <div class="font-weight-semibold">${escapeHtml(v ? v.plate : '-') }</div>
    <div class="text-muted small">${escapeHtml(v ? v.fleet : '')}</div>
  </td>
  <td><span class="badge ${badgeCls}">${escapeHtml(e.kind)}</span></td>
  <td class="text-right">
    <button class="btn btn-sm btn-outline-secondary" type="button" data-action="details" data-vehicle-id="${escapeHtml(e.vehicleId)}">Ver</button>
  </td>
</tr>`;
      })
      .join('');
  }

  function renderEventsFull() {
    if (!els.eventsFullTbody) return;
    if (!EVENTS.length) {
      els.eventsFullTbody.innerHTML = '';
      if (els.eventsFullEmpty) els.eventsFullEmpty.style.display = '';
      return;
    }
    if (els.eventsFullEmpty) els.eventsFullEmpty.style.display = 'none';
    els.eventsFullTbody.innerHTML = EVENTS
      .map((e) => {
        const v = vehicleById(e.vehicleId);
        const when = `há ${e.whenMinAgo}min`;
        const badgeCls = e.severity === 'danger' ? 'badge-danger' : e.severity === 'warning' ? 'badge-warning' : 'badge-success';
        return `
<tr>
  <td class="text-muted">${escapeHtml(when)}</td>
  <td>
    <div class="font-weight-semibold">${escapeHtml(v ? v.plate : '-') }</div>
    <div class="text-muted small">${escapeHtml(v ? v.driver : '')}</div>
  </td>
  <td><span class="badge ${badgeCls}">${escapeHtml(e.kind)}</span></td>
  <td class="text-right">
    <button class="btn btn-sm btn-outline-secondary" type="button" data-action="details" data-vehicle-id="${escapeHtml(e.vehicleId)}">Detalhes</button>
  </td>
</tr>`;
      })
      .join('');
  }

  function renderRoutes() {
    if (!els.routesTbody) return;
    if (!ROUTES.length) {
      els.routesTbody.innerHTML = '';
      if (els.routesEmpty) els.routesEmpty.style.display = '';
      return;
    }
    if (els.routesEmpty) els.routesEmpty.style.display = 'none';

    els.routesTbody.innerHTML = ROUTES
      .map((r) => {
        const v = vehicleById(r.vehicleId);
        const duration = `${Math.floor(r.durationMin / 60)}h ${r.durationMin % 60}m`;
        return `
<tr>
  <td>
    <div class="font-weight-semibold">${escapeHtml(r.name)}</div>
    <div class="text-muted small">${escapeHtml(r.id.toUpperCase())}</div>
  </td>
  <td>
    <div class="font-weight-semibold">${escapeHtml(v ? v.plate : '-')}</div>
    <div class="text-muted small">${escapeHtml(v ? v.fleet : '')}</div>
  </td>
  <td>${escapeHtml(duration)}</td>
  <td class="text-right">
    <button class="btn btn-sm btn-outline-secondary" type="button" data-action="route" data-route-id="${escapeHtml(r.id)}">Abrir</button>
  </td>
</tr>`;
      })
      .join('');
  }

  function setMapSelection(vehicle) {
    if (!els.mapSelected) return;
    if (!vehicle) {
      els.mapSelected.textContent = 'Selecione um veículo para ver detalhes.';
      return;
    }
    els.mapSelected.textContent = `${vehicle.plate} • ${vehicle.driver} • ${vehicle.speedKmh} km/h • ${formatAgo(vehicle.lastSignalSec)}`;
  }

  function openVehicleModal(vehicleId, action) {
    const v = vehicleById(vehicleId);
    if (!v || !els.vehicleModalBody) return;

    const badge = badgeForStatus(v);
    if (els.vehicleModalTitle) els.vehicleModalTitle.textContent = `Veículo ${v.plate}`;

    els.vehicleModalBody.innerHTML = `
      <div class="mb-2"><span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span></div>
      <div class="mb-1"><strong>Motorista:</strong> ${escapeHtml(v.driver)}</div>
      <div class="mb-1"><strong>Frota:</strong> ${escapeHtml(v.fleet)}</div>
      <div class="mb-1"><strong>Grupo:</strong> ${escapeHtml(v.group)}</div>
      <div class="mb-1"><strong>Velocidade:</strong> ${escapeHtml(v.speedKmh)} km/h</div>
      <div class="text-muted small">Último sinal ${escapeHtml(formatAgo(v.lastSignalSec))}</div>
    `;

    if (els.vehicleModalAction) {
      const label = action === 'block' ? 'Bloquear' : 'Criar alerta';
      els.vehicleModalAction.textContent = label;
      els.vehicleModalAction.setAttribute('data-vehicle-id', v.id);
      els.vehicleModalAction.setAttribute('data-action', action || 'details');
    }

    setMapSelection(v);
    openModal('#vehicleModal');
  }

  function populateAlertVehicles() {
    if (!els.alertVehicle) return;
    els.alertVehicle.innerHTML = VEHICLES
      .map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.plate)} — ${escapeHtml(v.fleet)}</option>`)
      .join('');
  }

  function downloadText(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportVehiclesCsv(vehicles) {
    const header = ['plate', 'fleet', 'group', 'driver', 'status', 'speedKmh', 'lastSignalSec'];
    const lines = [header.join(',')];
    for (const v of vehicles) {
      const row = [v.plate, v.fleet, v.group, v.driver, v.state, String(v.speedKmh), String(v.lastSignalSec)]
        .map((x) => `"${String(x).replaceAll('"', '""')}"`);
      lines.push(row.join(','));
    }
    downloadText('vehicles.csv', lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function setView(viewId) {
    const view = viewId || 'overview';
    document.querySelectorAll('[data-view]').forEach((el) => {
      const isMatch = el.getAttribute('data-view') === view;
      if (el.classList.contains('nav-link')) {
        if (isMatch) el.classList.add('active');
        else el.classList.remove('active');
        return;
      }
      el.style.display = isMatch ? '' : 'none';
    });
  }

  function getInitialView() {
    const hash = (window.location.hash || '').replace('#', '').trim();
    if (hash) return hash;
    return 'overview';
  }

  function persistSettings() {
    try {
      const density = els.settingDensity ? els.settingDensity.value : 'comfortable';
      const autorefresh = els.settingAutorefresh ? els.settingAutorefresh.value : 'on';
      localStorage.setItem('demo.settings', JSON.stringify({ density, autorefresh }));
    } catch (_) {}
  }

  function restoreSettings() {
    try {
      const raw = localStorage.getItem('demo.settings');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (els.settingDensity && parsed.density) els.settingDensity.value = parsed.density;
      if (els.settingAutorefresh && parsed.autorefresh) els.settingAutorefresh.value = parsed.autorefresh;
    } catch (_) {}
  }

  function renderAll() {
    const filters = getFilters();
    const filtered = applyFilters(VEHICLES, filters);
    updateBadges(VEHICLES);
    updateKpis(filtered);
    renderVehicles(filtered);
    renderEventsSummary();
    renderEventsFull();
    renderRoutes();
    populateAlertVehicles();
    initDataTables();
  }

  // Navegação
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('.nav-link[data-view]');
    if (nav) {
      e.preventDefault();
      const view = nav.getAttribute('data-view');
      if (view) {
        window.location.hash = view;
        setView(view);
        if (isMobileNav()) closeSidebar();
      }
      return;
    }
  });

  window.addEventListener('hashchange', () => setView(getInitialView()));
  setView(getInitialView());

  // Filtros e ações
  function applyAndRender() {
    renderAll();
  }

  if (els.btnApply) els.btnApply.addEventListener('click', applyAndRender);
  if (els.btnQuickFilter) els.btnQuickFilter.addEventListener('click', applyAndRender);
  if (els.search) {
    els.search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyAndRender();
      }
    });
  }

  if (els.btnClear) {
    els.btnClear.addEventListener('click', () => {
      if (els.fleet) els.fleet.value = '';
      if (els.search) els.search.value = '';
      if (els.period) els.period.value = '';
      try {
        if (window.jQuery && jQuery.fn.select2) jQuery(els.fleet).val('').trigger('change');
      } catch (_) {}
      applyAndRender();
    });
  }

  if (els.btnExport) {
    els.btnExport.addEventListener('click', () => {
      const filtered = applyFilters(VEHICLES, getFilters());
      exportVehiclesCsv(filtered);
    });
  }

  if (els.btnReport) {
    els.btnReport.addEventListener('click', () => {
      if (els.reportsLog) {
        els.reportsLog.textContent = `Relatório gerado (simulado) em ${new Date().toLocaleString('pt-BR')}.`;
      }
      window.location.hash = 'reports';
      setView('reports');
    });
  }

  // Ações nas tabelas
  document.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');
    const vehicleId = actionBtn.getAttribute('data-vehicle-id');
    if (vehicleId && (action === 'details' || action === 'block')) {
      openVehicleModal(vehicleId, action);
      return;
    }
  });

  if (els.vehicleModalAction) {
    els.vehicleModalAction.addEventListener('click', () => {
      const vehicleId = els.vehicleModalAction.getAttribute('data-vehicle-id');
      const action = els.vehicleModalAction.getAttribute('data-action');
      if (!vehicleId) return;

      if (action === 'block') {
        const v = vehicleById(vehicleId);
        if (els.vehicleModalBody && v) {
          els.vehicleModalBody.innerHTML += `<div class="mt-2 text-muted small">Bloqueio remoto solicitado (simulado).</div>`;
        }
        return;
      }

      // default: criar alerta
      if (els.alertVehicle) els.alertVehicle.value = vehicleId;
      openModal('#alertModal');
    });
  }

  if (els.btnCreateAlert) {
    els.btnCreateAlert.addEventListener('click', () => {
      populateAlertVehicles();
      openModal('#alertModal');
    });
  }

  if (els.btnSaveAlert) {
    els.btnSaveAlert.addEventListener('click', () => {
      const vehicleId = els.alertVehicle ? els.alertVehicle.value : '';
      const v = vehicleById(vehicleId);
      const type = els.alertType ? els.alertType.value : '';
      const threshold = els.alertThreshold ? els.alertThreshold.value : '';
      const channel = els.alertChannel ? els.alertChannel.value : '';
      const notes = els.alertNotes ? els.alertNotes.value : '';

      const summary = `Alerta salvo (simulado): ${v ? v.plate : '—'} • ${type} • lim=${threshold || '—'} • ${channel}${notes ? ' • obs: ' + notes : ''}`;
      if (els.reportsLog) els.reportsLog.textContent = summary;
      closeModal(document.querySelector('#alertModal'));
      window.location.hash = 'reports';
      setView('reports');
    });
  }

  // Relatórios (links na overview + botões na view)
  document.addEventListener('click', (e) => {
    const reportLink = e.target.closest('[data-report]');
    if (!reportLink) return;
    e.preventDefault();
    const reportId = reportLink.getAttribute('data-report');
    if (els.reportsLog) {
      const map = {
        routes: 'Relatório de Rotas',
        speed: 'Excesso de Velocidade',
        maintenance: 'Manutenção Preventiva'
      };
      els.reportsLog.textContent = `${map[reportId] || 'Relatório'} gerado (simulado) em ${new Date().toLocaleString('pt-BR')}.`;
    }
    window.location.hash = 'reports';
    setView('reports');
  });

  // Settings
  restoreSettings();
  if (els.settingDensity) els.settingDensity.addEventListener('change', persistSettings);
  if (els.settingAutorefresh) els.settingAutorefresh.addEventListener('change', persistSettings);

  renderAll();
})();
