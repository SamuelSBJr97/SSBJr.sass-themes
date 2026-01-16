import React, { useEffect, useMemo, useState } from 'react';
import DataTable from './components/DataTable.jsx';
import ReportsPage from './components/ReportsPage.jsx';

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

function getQueryParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function getMeta(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? el.getAttribute('content') : null;
}

function getFixedTheme() {
  const t = document.body?.getAttribute('data-fixed-theme');
  return t ? String(t) : null;
}

function getInitialTheme() {
  const queryTheme = getQueryParam('theme');
  if (queryTheme) return queryTheme;

  const fixed = getFixedTheme();
  if (fixed) return fixed;

  const meta = getMeta('demo-theme');
  if (meta) return meta;

  try {
    const saved = localStorage.getItem('demo.theme');
    if (saved) return saved;
  } catch {
    // ignore
  }

  return 'aurora';
}

function applyTheme(themeId, { persist, locked } = {}) {
  const link = document.getElementById('theme-css');
  if (link) link.setAttribute('href', `assets/css/${themeId}.css`);
  document.documentElement.setAttribute('data-theme', themeId);

  if (persist) {
    try {
      localStorage.setItem('demo.theme', themeId);
    } catch {
      // ignore
    }
  }

  if (locked) {
    document.documentElement.setAttribute('data-theme-locked', 'true');
  } else {
    document.documentElement.removeAttribute('data-theme-locked');
  }
}

function isMobileNav() {
  return !!(window.matchMedia && window.matchMedia('(max-width: 991px)').matches);
}

function badgeForStatus(vehicle) {
  if (vehicle.status === 'critical') return { cls: 'badge-danger', label: vehicle.state };
  if (vehicle.status === 'attention') return { cls: 'badge-warning', label: vehicle.state };
  return { cls: 'badge-success', label: vehicle.state };
}

function formatAgo(seconds) {
  if (seconds < 60) return `há ${seconds}s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `há ${min}min`;
  const h = Math.round(min / 60);
  return `há ${h}h`;
}

function durationLabel(min) {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function useHashView(defaultView) {
  const [view, setView] = useState(() => {
    const hash = (window.location.hash || '').replace('#', '').trim();
    return hash || defaultView;
  });

  useEffect(() => {
    const onHash = () => {
      const hash = (window.location.hash || '').replace('#', '').trim();
      setView(hash || defaultView);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [defaultView]);

  return [view, setView];
}

function Modal({ title, open, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal show" role="dialog" aria-modal="true" aria-hidden="false" onMouseDown={(e) => {
      if (e.target?.classList?.contains('modal')) onClose();
    }}>
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="close" aria-label="Fechar" onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer ? <div className="modal-footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

function vehicleSearchText(v) {
  return `${v.plate} ${v.driver} ${v.group} ${v.kind} ${v.fleet}`;
}

export default function App() {
  const fixedTheme = useMemo(() => getFixedTheme(), []);
  const [theme, setTheme] = useState(() => getInitialTheme());

  const [view] = useHashView('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [fleet, setFleet] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleModalId, setVehicleModalId] = useState(null);

  const [helpOpen, setHelpOpen] = useState(false);

  const selectedVehicle = useMemo(() => VEHICLES.find((v) => v.id === vehicleModalId) || null, [vehicleModalId]);

  useEffect(() => {
    applyTheme(theme, { persist: !fixedTheme, locked: !!fixedTheme });
  }, [theme, fixedTheme]);

  useEffect(() => {
    if (!sidebarOpen) return;
    document.body.classList.add('sidebar-open');
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen]);

  useEffect(() => {
    const onResize = () => {
      if (!isMobileNav()) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setHelpOpen(false);
      setVehicleModalOpen(false);
      setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (isMobileNav()) setSidebarOpen(false);
  }, [view]);

  const filteredVehicles = useMemo(() => {
    const term = (search || '').trim().toLowerCase();
    return VEHICLES.filter((v) => {
      if (fleet && v.fleet !== fleet) return false;
      if (term) {
        const hay = vehicleSearchText(v).toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [fleet, search]);

  const badges = useMemo(() => {
    const online = VEHICLES.filter((v) => v.status === 'online').length;
    const attention = VEHICLES.filter((v) => v.status === 'attention').length;
    const critical = VEHICLES.filter((v) => v.status === 'critical').length;
    return { online, attention, critical };
  }, []);

  const kpis = useMemo(() => {
    const totalKm = filteredVehicles.reduce((sum, v) => sum + v.distanceTodayKm, 0);
    const totalFuel = filteredVehicles.reduce((sum, v) => sum + v.fuelTodayL, 0);
    const totalIdle = filteredVehicles.reduce((sum, v) => sum + v.idleMin, 0);
    const alerts = filteredVehicles.filter((v) => v.status === 'critical').length + filteredVehicles.filter((v) => v.status === 'attention').length;

    return {
      totalKm,
      totalFuel,
      totalIdle,
      alerts
    };
  }, [filteredVehicles]);

  function openVehicle(id) {
    setVehicleModalId(id);
    setVehicleModalOpen(true);
  }

  function exportVehiclesCsv() {
    const rows = filteredVehicles.map((v) => ({
      plate: v.plate,
      driver: v.driver,
      fleet: v.fleet,
      group: v.group,
      status: v.status,
      state: v.state,
      speedKmh: v.speedKmh,
      lastSignalSec: v.lastSignalSec
    }));

    const header = Object.keys(rows[0] || { plate: '' });
    const csv = [header.join(';')]
      .concat(rows.map((r) => header.map((k) => String(r[k] ?? '')).join(';')))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'veiculos.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <>
      <a className="sr-only sr-only-focusable" href="#main">Pular para conteúdo</a>

      <div className="app-shell">
        <aside id="app-sidebar" className="sidebar">
          <div className="sidebar-header">
            <div className="brand">
              <div className="brand-mark">STI</div>
              <div className="brand-text">
                <div className="brand-title">Frotas</div>
                <div className="brand-subtitle">Rastreamento e Relatórios</div>
              </div>
            </div>
          </div>

          <nav className="nav flex-column" aria-label="Navegação">
            <a className={`nav-link ${view === 'overview' ? 'active' : ''}`} href="#overview">Visão Geral</a>
            <a className={`nav-link ${view === 'vehicles' ? 'active' : ''}`} href="#vehicles">Veículos</a>
            <a className={`nav-link ${view === 'routes' ? 'active' : ''}`} href="#routes">Rotas</a>
            <a className={`nav-link ${view === 'events' ? 'active' : ''}`} href="#events">Ocorrências</a>
            <a className={`nav-link ${view === 'reports' ? 'active' : ''}`} href="#reports">Relatórios</a>
            <a className={`nav-link ${view === 'settings' ? 'active' : ''}`} href="#settings">Configurações</a>
          </nav>

          <div className="sidebar-footer">
            <div className="small text-muted">Ambiente: Demo</div>
          </div>
        </aside>

        <div className="content">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="btn btn-outline-secondary btn-sm sidebar-toggle"
                type="button"
                aria-label="Abrir menu"
                aria-controls="app-sidebar"
                aria-expanded={sidebarOpen ? 'true' : 'false'}
                onClick={() => setSidebarOpen((v) => !v)}
              >
                &#9776;
              </button>
              <div className="h5 mb-0">Dashboard — Rastreamento</div>
              <div className="text-muted small">Status em tempo real • relatórios • controle de frota</div>
            </div>

            <div className="topbar-right">
              <div className="form-inline">
                <label className="mr-2 text-muted small" htmlFor="theme">Tema</label>
                <select
                  id="theme"
                  className="custom-select custom-select-sm"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  disabled={!!fixedTheme}
                >
                  <option value="aurora">Aurora (claro)</option>
                  <option value="carbon">Carbon (escuro)</option>
                  <option value="atlas">Atlas (claro/tech)</option>
                </select>
              </div>

              <button className="btn btn-outline-secondary btn-sm ml-2" type="button" onClick={() => setHelpOpen(true)}>
                Ajuda
              </button>
              <button className="btn btn-primary btn-sm ml-2" type="button" onClick={() => openVehicle('v1')}>
                Criar alerta
              </button>
            </div>
          </header>

          <main id="main" className="container-fluid">
            {view === 'overview' ? (
              <section>
                <div className="row">
                  <div className="col-lg-8">
                    <div className="card mb-3">
                      <div className="card-header d-flex align-items-center justify-content-between">
                        <div>
                          <div className="card-title">Mapa</div>
                          <div className="card-subtitle text-muted">Última posição + cercas virtuais</div>
                        </div>
                        <div>
                          <span className="badge badge-success">Online {badges.online}</span>
                          <span className="badge badge-warning ml-1">Atenção {badges.attention}</span>
                          <span className="badge badge-danger ml-1">Crítico {badges.critical}</span>
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="map-placeholder">
                          <div className="map-placeholder-inner">
                            <div className="h6 mb-1">Placeholder de mapa</div>
                            <div className="text-muted small">Selecione um veículo para ver detalhes.</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card mb-4">
                      <div className="card-header">
                        <div className="card-title">Atividade recente</div>
                        <div className="card-subtitle text-muted">Ocorrências e eventos nas últimas 2 horas</div>
                      </div>
                      <div className="card-body">
                        <DataTable
                          variant="summary"
                          rowKey={(e) => e.id}
                          rows={EVENTS.slice(0, 6)}
                          columns={[
                            {
                              id: 'when',
                              header: 'Quando',
                              cell: (e) => <span className="text-muted">há {e.whenMinAgo}min</span>,
                              sortValue: (e) => e.whenMinAgo
                            },
                            {
                              id: 'vehicle',
                              header: 'Veículo',
                              cell: (e) => {
                                const v = VEHICLES.find((x) => x.id === e.vehicleId);
                                return (
                                  <>
                                    <div className="font-weight-semibold">{v ? v.plate : '-'}</div>
                                    <div className="text-muted small">{v ? v.fleet : ''}</div>
                                  </>
                                );
                              },
                              sortValue: (e) => {
                                const v = VEHICLES.find((x) => x.id === e.vehicleId);
                                return v ? v.plate : '';
                              }
                            },
                            {
                              id: 'kind',
                              header: 'Evento',
                              cell: (e) => {
                                const badgeCls = e.severity === 'danger' ? 'badge-danger' : e.severity === 'warning' ? 'badge-warning' : 'badge-success';
                                return <span className={`badge ${badgeCls}`}>{e.kind}</span>;
                              },
                              sortValue: (e) => e.kind
                            },
                            {
                              id: 'actions',
                              header: <span className="sr-only">Ações</span>,
                              headerClassName: 'text-right',
                              className: 'text-right',
                              cell: (e) => (
                                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => openVehicle(e.vehicleId)}>
                                  Ver
                                </button>
                              )
                            }
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-4">
                    <div className="card mb-3">
                      <div className="card-header">
                        <div className="card-title">Indicadores</div>
                        <div className="card-subtitle text-muted">KPIs e saúde da frota</div>
                      </div>
                      <div className="card-body">
                        <div className="kpi-grid">
                          <div className="kpi">
                            <div className="kpi-label">Distância (hoje)</div>
                            <div className="kpi-value">{kpis.totalKm.toLocaleString('pt-BR')} km</div>
                            <div className="kpi-trend text-success">+6,2%</div>
                          </div>
                          <div className="kpi">
                            <div className="kpi-label">Consumo estimado</div>
                            <div className="kpi-value">{kpis.totalFuel.toLocaleString('pt-BR')} L</div>
                            <div className="kpi-trend text-warning">+1,1%</div>
                          </div>
                          <div className="kpi">
                            <div className="kpi-label">Tempo parado</div>
                            <div className="kpi-value">{Math.floor(kpis.totalIdle / 60)}h {kpis.totalIdle % 60}m</div>
                            <div className="kpi-trend text-danger">+18%</div>
                          </div>
                          <div className="kpi">
                            <div className="kpi-label">Alertas</div>
                            <div className="kpi-value">{kpis.alerts}</div>
                            <div className="kpi-trend text-muted">últ. 24h</div>
                          </div>
                        </div>

                        <hr className="my-3" />

                        <div className="report-list">
                          <a className="report-item" href="#" onClick={(e) => { e.preventDefault(); window.location.hash = '#reports'; }}>
                            <div className="report-title">Relatório de Rotas</div>
                            <div className="report-meta text-muted small">PDF • por frota • por período</div>
                          </a>
                          <a className="report-item" href="#" onClick={(e) => { e.preventDefault(); window.location.hash = '#reports'; }}>
                            <div className="report-title">Excesso de Velocidade</div>
                            <div className="report-meta text-muted small">CSV • por motorista</div>
                          </a>
                          <a className="report-item" href="#" onClick={(e) => { e.preventDefault(); window.location.hash = '#reports'; }}>
                            <div className="report-title">Manutenção Preventiva</div>
                            <div className="report-meta text-muted small">Resumo • alertas</div>
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header">
                        <div className="card-title">Controles</div>
                        <div className="card-subtitle text-muted">Ações rápidas por grupo</div>
                      </div>
                      <div className="card-body">
                        <button className="btn btn-outline-danger btn-block mb-2" type="button">Bloqueio remoto</button>
                        <button className="btn btn-outline-secondary btn-block mb-2" type="button">Ajustar cercas virtuais</button>
                        <button className="btn btn-outline-info btn-block" type="button">Agendar relatório</button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'vehicles' ? (
              <section>
                <div className="row">
                  <div className="col-lg-12">
                    <div className="card mb-4">
                      <div className="card-header">
                        <div className="card-title">Veículos</div>
                        <div className="card-subtitle text-muted">Filtros + status + ações rápidas</div>
                      </div>
                      <div className="card-body">
                        <form className="mb-3" onSubmit={(e) => e.preventDefault()}>
                          <div className="form-row">
                            <div className="col-md-4 mb-2">
                              <label className="small text-muted" htmlFor="fleet">Frota</label>
                              <select id="fleet" className="form-control" value={fleet} onChange={(e) => setFleet(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="Operação SP">Operação SP</option>
                                <option value="Operação RJ">Operação RJ</option>
                                <option value="Filial Sul">Filial Sul</option>
                              </select>
                            </div>
                            <div className="col-md-4 mb-2">
                              <label className="small text-muted" htmlFor="period">Período</label>
                              <input id="period" className="form-control" placeholder="(demo)" value={period} onChange={(e) => setPeriod(e.target.value)} />
                            </div>
                            <div className="col-md-4 mb-2">
                              <label className="small text-muted" htmlFor="search">Buscar</label>
                              <div className="input-group">
                                <input id="search" className="form-control" placeholder="Placa, motorista, grupo…" value={search} onChange={(e) => setSearch(e.target.value)} />
                                <div className="input-group-append">
                                  <button className="btn btn-outline-secondary" type="button">Filtrar</button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="d-flex flex-wrap gap-2">
                            <button className="btn btn-primary" type="button">Aplicar</button>
                            <button className="btn btn-outline-secondary" type="button" onClick={() => { setFleet(''); setSearch(''); setPeriod(''); }}>
                              Limpar
                            </button>
                            <button className="btn btn-outline-info" type="button" onClick={exportVehiclesCsv}>
                              Exportar CSV
                            </button>
                            <button className="btn btn-outline-warning" type="button">Gerar relatório</button>
                          </div>
                        </form>

                        <DataTable
                          rowKey={(v) => v.id}
                          rows={filteredVehicles}
                          getSearchText={vehicleSearchText}
                          searchPlaceholder="Placa, motorista, grupo…"
                          columns={[
                            {
                              id: 'vehicle',
                              header: 'Veículo',
                              cell: (v) => (
                                <>
                                  <div className="font-weight-semibold">{v.plate}</div>
                                  <div className="text-muted small">{v.kind} • {v.group}</div>
                                </>
                              ),
                              sortValue: (v) => v.plate
                            },
                            {
                              id: 'status',
                              header: 'Status',
                              cell: (v) => {
                                const badge = badgeForStatus(v);
                                return <span className={`badge ${badge.cls}`}>{badge.label}</span>;
                              },
                              sortValue: (v) => v.status
                            },
                            {
                              id: 'speed',
                              header: 'Veloc.',
                              cell: (v) => `${v.speedKmh} km/h`,
                              sortValue: (v) => v.speedKmh
                            },
                            {
                              id: 'last',
                              header: 'Último sinal',
                              cell: (v) => <span className="text-muted">{formatAgo(v.lastSignalSec)}</span>,
                              sortValue: (v) => v.lastSignalSec
                            },
                            {
                              id: 'actions',
                              header: <span className="sr-only">Ações</span>,
                              headerClassName: 'text-right',
                              className: 'text-right',
                              cell: (v) => (
                                <>
                                  <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => openVehicle(v.id)}>
                                    Detalhes
                                  </button>
                                  <button className="btn btn-sm btn-outline-danger ml-2" type="button" onClick={() => openVehicle(v.id)}>
                                    Bloquear
                                  </button>
                                </>
                              )
                            }
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'routes' ? (
              <section>
                <div className="card mb-4">
                  <div className="card-header">
                    <div className="card-title">Rotas</div>
                    <div className="card-subtitle text-muted">Lista de rotas simuladas para demonstração</div>
                  </div>
                  <div className="card-body">
                    <DataTable
                      rowKey={(r) => r.id}
                      rows={ROUTES}
                      getSearchText={(r) => {
                        const v = VEHICLES.find((x) => x.id === r.vehicleId);
                        return `${r.name} ${r.id} ${v ? v.plate : ''} ${v ? v.fleet : ''}`;
                      }}
                      columns={[
                        {
                          id: 'route',
                          header: 'Rota',
                          cell: (r) => (
                            <>
                              <div className="font-weight-semibold">{r.name}</div>
                              <div className="text-muted small">{r.id.toUpperCase()}</div>
                            </>
                          ),
                          sortValue: (r) => r.name
                        },
                        {
                          id: 'vehicle',
                          header: 'Veículo',
                          cell: (r) => {
                            const v = VEHICLES.find((x) => x.id === r.vehicleId);
                            return (
                              <>
                                <div className="font-weight-semibold">{v ? v.plate : '-'}</div>
                                <div className="text-muted small">{v ? v.fleet : ''}</div>
                              </>
                            );
                          },
                          sortValue: (r) => {
                            const v = VEHICLES.find((x) => x.id === r.vehicleId);
                            return v ? v.plate : '';
                          }
                        },
                        {
                          id: 'duration',
                          header: 'Duração',
                          cell: (r) => durationLabel(r.durationMin),
                          sortValue: (r) => r.durationMin
                        },
                        {
                          id: 'actions',
                          header: <span className="sr-only">Ações</span>,
                          headerClassName: 'text-right',
                          className: 'text-right',
                          cell: () => <button className="btn btn-sm btn-outline-secondary" type="button">Abrir</button>
                        }
                      ]}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'events' ? (
              <section>
                <div className="card mb-4">
                  <div className="card-header">
                    <div className="card-title">Ocorrências</div>
                    <div className="card-subtitle text-muted">Alertas e eventos (simulado)</div>
                  </div>
                  <div className="card-body">
                    <DataTable
                      rowKey={(e) => e.id}
                      rows={EVENTS}
                      getSearchText={(e) => {
                        const v = VEHICLES.find((x) => x.id === e.vehicleId);
                        return `${e.kind} ${e.severity} ${e.whenMinAgo} ${v ? v.plate : ''} ${v ? v.driver : ''}`;
                      }}
                      columns={[
                        {
                          id: 'when',
                          header: 'Quando',
                          cell: (e) => <span className="text-muted">há {e.whenMinAgo}min</span>,
                          sortValue: (e) => e.whenMinAgo
                        },
                        {
                          id: 'vehicle',
                          header: 'Veículo',
                          cell: (e) => {
                            const v = VEHICLES.find((x) => x.id === e.vehicleId);
                            return (
                              <>
                                <div className="font-weight-semibold">{v ? v.plate : '-'}</div>
                                <div className="text-muted small">{v ? v.driver : ''}</div>
                              </>
                            );
                          },
                          sortValue: (e) => {
                            const v = VEHICLES.find((x) => x.id === e.vehicleId);
                            return v ? v.plate : '';
                          }
                        },
                        {
                          id: 'kind',
                          header: 'Ocorrência',
                          cell: (e) => {
                            const badgeCls = e.severity === 'danger' ? 'badge-danger' : e.severity === 'warning' ? 'badge-warning' : 'badge-success';
                            return <span className={`badge ${badgeCls}`}>{e.kind}</span>;
                          },
                          sortValue: (e) => e.kind
                        },
                        {
                          id: 'actions',
                          header: <span className="sr-only">Ações</span>,
                          headerClassName: 'text-right',
                          className: 'text-right',
                          cell: (e) => (
                            <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => openVehicle(e.vehicleId)}>
                              Detalhes
                            </button>
                          )
                        }
                      ]}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'reports' ? (
              <ReportsPage vehicles={VEHICLES} />
            ) : null}

            {view === 'settings' ? (
              <section>
                <div className="card mb-4">
                  <div className="card-header">
                    <div className="card-title">Configurações</div>
                    <div className="card-subtitle text-muted">Preferências da demo</div>
                  </div>
                  <div className="card-body">
                    <div className="form-row">
                      <div className="col-md-6 mb-2">
                        <label className="small text-muted" htmlFor="setting-density">Densidade</label>
                        <select id="setting-density" className="custom-select" defaultValue="comfortable">
                          <option value="comfortable">Confortável</option>
                          <option value="compact">Compacta</option>
                        </select>
                      </div>
                      <div className="col-md-6 mb-2">
                        <label className="small text-muted" htmlFor="setting-autorefresh">Auto-atualização</label>
                        <select id="setting-autorefresh" className="custom-select" defaultValue="on">
                          <option value="on">Ligada (simulada)</option>
                          <option value="off">Desligada</option>
                        </select>
                      </div>
                    </div>
                    <div className="text-muted small">Estas opções só afetam a demo e servem para exibir estados de UI.</div>
                  </div>
                </div>
              </section>
            ) : null}
          </main>

          <footer className="footer">
            <div className="text-muted small">© 2026 • Demo UI • Classes compatíveis com Bootstrap 4</div>
          </footer>
        </div>
      </div>

      <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setSidebarOpen(false)}></div>

      <Modal
        title={selectedVehicle ? `Veículo ${selectedVehicle.plate}` : 'Veículo'}
        open={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setVehicleModalOpen(false)}>
              Fechar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setVehicleModalOpen(false)}>
              OK
            </button>
          </>
        }
      >
        {selectedVehicle ? (
          <>
            <div className="mb-2"><span className={`badge ${badgeForStatus(selectedVehicle).cls}`}>{badgeForStatus(selectedVehicle).label}</span></div>
            <div className="mb-1"><strong>Motorista:</strong> {selectedVehicle.driver}</div>
            <div className="mb-1"><strong>Frota:</strong> {selectedVehicle.fleet}</div>
            <div className="mb-1"><strong>Grupo:</strong> {selectedVehicle.group}</div>
            <div className="mb-1"><strong>Velocidade:</strong> {selectedVehicle.speedKmh} km/h</div>
            <div className="text-muted small">Último sinal {formatAgo(selectedVehicle.lastSignalSec)}</div>
          </>
        ) : null}
      </Modal>

      <Modal
        title="Ajuda"
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        footer={
          <button type="button" className="btn btn-outline-secondary" onClick={() => setHelpOpen(false)}>
            Fechar
          </button>
        }
      >
        <p className="mb-2">Este demo demonstra:</p>
        <ul className="mb-0">
          <li>Temas Sass (Bootstrap 4 compat) carregados por página e seletor</li>
          <li>Dashboard em React com navegação por hash</li>
          <li>Filtros e export CSV (simulado)</li>
        </ul>
      </Modal>
    </>
  );
}
