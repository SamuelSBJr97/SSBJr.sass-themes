import React, { useEffect, useMemo, useState } from 'react';
import DataTable from './DataTable.jsx';

function hashToInt(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatKm(km) {
  return `${km.toLocaleString('pt-BR')} km`;
}

function formatL(l) {
  return `${l.toLocaleString('pt-BR')} L`;
}

function formatPct(p) {
  return `${p.toLocaleString('pt-BR')}%`;
}

function formatMin(min) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function downloadCsv(filename, rows) {
  const header = Object.keys(rows[0] || {});
  const csv = [header.join(';')]
    .concat(rows.map((r) => header.map((k) => String(r[k] ?? '')).join(';')))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function makeTelemetryForVehicle(vehicle) {
  const h = hashToInt(vehicle.id);
  const speed = clamp(vehicle.speedKmh + ((h % 17) - 8), 0, 120);
  const rpm = clamp(800 + (speed * 28) + (h % 500), 700, 4200);
  const fuelPct = clamp(18 + (h % 78), 5, 100);
  const coolantC = clamp(72 + (h % 28), 60, 110);
  const battV = clamp(12.1 + ((h % 40) / 10), 11.6, 14.6);
  const odoKm = clamp(38200 + (h % 19000) + Math.round(vehicle.distanceTodayKm * 12), 1000, 999999);

  const gpsFix = (h % 10) > 1 ? '3D' : '2D';
  const ignition = vehicle.speedKmh > 0 || vehicle.status !== 'critical' ? 'Ligada' : 'Desligada';

  return {
    plate: vehicle.plate,
    fleet: vehicle.fleet,
    group: vehicle.group,
    status: vehicle.state,
    ignition,
    speedKmh: speed,
    rpm,
    fuelPct,
    coolantC,
    batteryV: battV.toFixed(1),
    odometerKm: odoKm,
    gpsFix,
    lastSignalSec: vehicle.lastSignalSec
  };
}

function makeTripSummaryRows(vehicles, periodDays) {
  const multiplier = clamp(periodDays, 1, 60);
  return vehicles.map((v) => {
    const h = hashToInt(v.id + String(periodDays));
    const trips = 2 + (h % 10);
    const km = Math.round(v.distanceTodayKm * (0.7 + (multiplier * 0.22)));
    const idleMin = Math.round(v.idleMin * (0.6 + (multiplier * 0.18)));
    const driveMin = Math.round((km / 42) * 60);

    return {
      plate: v.plate,
      fleet: v.fleet,
      trips,
      distanceKm: km,
      driveTime: formatMin(driveMin),
      idleTime: formatMin(idleMin)
    };
  });
}

function makeSpeedingRows(vehicles, periodDays) {
  const rows = [];
  for (const v of vehicles) {
    const h = hashToInt(v.id + `speed:${periodDays}`);
    const count = (h % 6);
    for (let i = 0; i < count; i += 1) {
      const peak = clamp(74 + ((h + i * 31) % 48), 70, 140);
      const limit = 80;
      rows.push({
        plate: v.plate,
        fleet: v.fleet,
        when: `D-${((h + i) % periodDays) + 1}`,
        speedKmh: peak,
        limitKmh: limit,
        excessKmh: peak - limit
      });
    }
  }
  return rows;
}

function makeFuelRows(vehicles, periodDays) {
  return vehicles.map((v) => {
    const h = hashToInt(v.id + `fuel:${periodDays}`);
    const km = Math.round(v.distanceTodayKm * (0.7 + (periodDays * 0.22)));
    const liters = Math.max(5, Math.round(v.fuelTodayL * (0.8 + (periodDays * 0.2))));
    const l100 = km > 0 ? (liters / km) * 100 : 0;

    return {
      plate: v.plate,
      fleet: v.fleet,
      distanceKm: km,
      fuelL: liters,
      avgLPer100Km: l100.toFixed(1)
    };
  });
}

function makeIdleRows(vehicles, periodDays) {
  return vehicles.map((v) => {
    const h = hashToInt(v.id + `idle:${periodDays}`);
    const idle = Math.round(v.idleMin * (0.8 + (periodDays * 0.25)));
    const events = (h % 8);

    return {
      plate: v.plate,
      fleet: v.fleet,
      idleTime: formatMin(idle),
      idleEvents: events,
      estFuelWasteL: Math.max(1, Math.round(idle / 30))
    };
  });
}

function makeMaintenanceRows(vehicles) {
  return vehicles.map((v) => {
    const h = hashToInt(v.id + 'maint');
    const kmToService = clamp(1200 + (h % 9800) - Math.round(v.distanceTodayKm * 6), -900, 15000);
    const priority = kmToService < 0 ? 'Vencido' : kmToService < 800 ? 'Urgente' : kmToService < 2500 ? 'Atenção' : 'OK';

    return {
      plate: v.plate,
      fleet: v.fleet,
      nextServiceKm: kmToService,
      priority
    };
  });
}

function makeGeofenceRows(vehicles, periodDays) {
  const fences = ['CD Principal', 'Zona Restrita', 'Filial Sul', 'Porto'];
  const rows = [];
  for (const v of vehicles) {
    const h = hashToInt(v.id + `geo:${periodDays}`);
    const count = 1 + (h % 6);
    for (let i = 0; i < count; i += 1) {
      rows.push({
        plate: v.plate,
        fleet: v.fleet,
        when: `D-${((h + i) % periodDays) + 1}`,
        geofence: fences[(h + i) % fences.length],
        event: ((h + i) % 2) ? 'Entrada' : 'Saída'
      });
    }
  }
  return rows;
}

function makeDriverBehaviorRows(vehicles, periodDays) {
  return vehicles.map((v) => {
    const h = hashToInt(v.id + `beh:${periodDays}`);
    const harshBrake = (h % 9);
    const harshAccel = (h % 7);
    const sharpTurn = (h % 6);
    const score = clamp(92 - (harshBrake * 3 + harshAccel * 2 + sharpTurn * 2), 40, 99);

    return {
      plate: v.plate,
      fleet: v.fleet,
      harshBrake,
      harshAccel,
      sharpTurn,
      safetyScore: score
    };
  });
}

function makePositionsRows(vehicles, periodDays, offset, limit) {
  const rows = [];
  for (let i = 0; i < limit; i += 1) {
    const idx = offset + i;
    const v = vehicles[idx % vehicles.length];
    const h = hashToInt(`${v.id}:pos:${periodDays}:${idx}`);
    const lat = (-23.55 + ((h % 2000) / 10000)).toFixed(5);
    const lng = (-46.63 + (((h >>> 11) % 2000) / 10000)).toFixed(5);
    const speed = clamp(5 + (h % 110), 0, 120);
    rows.push({
      when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
      plate: v.plate,
      fleet: v.fleet,
      lat,
      lng,
      speedKmh: speed
    });
  }
  return rows;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeSort(sort) {
  if (!sort || !sort.colId) return { colId: null, dir: 'asc' };
  return { colId: sort.colId, dir: sort.dir === 'desc' ? 'desc' : 'asc' };
}

export default function ReportsPage({ vehicles }) {
  const [periodDays, setPeriodDays] = useState(7);
  const [fleet, setFleet] = useState('');
  const [activeId, setActiveId] = useState('telemetry');

  const [states, setStates] = useState(() => ({
    telemetry: { page: 1, pageSize: 10, search: '', sort: { colId: null, dir: 'asc' }, rows: [], total: 0, loading: false },
    trips: { page: 1, pageSize: 10, search: '', sort: { colId: null, dir: 'asc' }, rows: [], total: 0, loading: false },
    speeding: { page: 1, pageSize: 10, search: '', sort: { colId: 'when', dir: 'desc' }, rows: [], total: 0, loading: false },
    fuel: { page: 1, pageSize: 10, search: '', sort: { colId: null, dir: 'asc' }, rows: [], total: 0, loading: false },
    idle: { page: 1, pageSize: 10, search: '', sort: { colId: null, dir: 'asc' }, rows: [], total: 0, loading: false },
    maintenance: { page: 1, pageSize: 10, search: '', sort: { colId: 'priority', dir: 'asc' }, rows: [], total: 0, loading: false },
    geofence: { page: 1, pageSize: 10, search: '', sort: { colId: 'when', dir: 'desc' }, rows: [], total: 0, loading: false },
    behavior: { page: 1, pageSize: 10, search: '', sort: { colId: 'safetyScore', dir: 'desc' }, rows: [], total: 0, loading: false },
    positions: { page: 1, pageSize: 10, search: '', sort: { colId: 'when', dir: 'desc' }, rows: [], total: 0, loading: false }
  }));

  const fleetOptions = useMemo(() => {
    return Array.from(new Set(vehicles.map((v) => v.fleet))).sort();
  }, [vehicles]);

  const scopedVehicles = useMemo(() => {
    return fleet ? vehicles.filter((v) => v.fleet === fleet) : vehicles;
  }, [vehicles, fleet]);

  const reportDefs = useMemo(() => {
    return [
      {
        id: 'telemetry',
        title: 'Telemetria Atual',
        subtitle: 'Ignição, velocidade, RPM, combustível, temperatura, bateria e GPS',
        category: 'Rastreamento',
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'ignition', header: 'Ignição', sortable: true },
          { id: 'speed', header: 'Veloc.', cell: (r) => `${r.speedKmh} km/h`, sortable: true },
          { id: 'rpm', header: 'RPM', cell: (r) => Number(r.rpm).toLocaleString('pt-BR'), sortable: true },
          { id: 'fuel', header: 'Combustível', cell: (r) => formatPct(r.fuelPct), sortable: true },
          { id: 'coolant', header: 'Temp.', cell: (r) => `${r.coolantC}°C`, sortable: true },
          { id: 'battery', header: 'Bateria', cell: (r) => `${r.batteryV} V`, sortable: true }
        ],
        async fetchPage({ page, pageSize }) {
          const total = scopedVehicles.length;
          const start = (page - 1) * pageSize;
          const slice = scopedVehicles.slice(start, start + pageSize).map(makeTelemetryForVehicle);
          await sleep(120);
          return { rows: slice, total };
        },
        async exportAll() {
          const rows = scopedVehicles.map(makeTelemetryForVehicle);
          downloadCsv('telemetria_atual.csv', rows);
        }
      },
      {
        id: 'trips',
        title: 'Relatório de Viagens',
        subtitle: 'Resumo por veículo: viagens, distância, tempo em movimento e tempo parado',
        category: 'Operação',
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'trips', header: 'Viagens', sortable: true },
          { id: 'distanceKm', header: 'Distância', cell: (r) => formatKm(r.distanceKm), sortable: true },
          { id: 'driveTime', header: 'Em movimento' },
          { id: 'idleTime', header: 'Parado' }
        ],
        async fetchPage({ page, pageSize }) {
          const all = makeTripSummaryRows(scopedVehicles, periodDays);
          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll() {
          const all = makeTripSummaryRows(scopedVehicles, periodDays);
          downloadCsv('relatorio_viagens.csv', all);
        }
      },
      {
        id: 'speeding',
        title: 'Eventos de Excesso de Velocidade',
        subtitle: 'Ocorrências com pico, limite e excesso (carregamento paginado)',
        category: 'Segurança',
        estimateTotal: () => scopedVehicles.length * Math.max(10, periodDays * 10),
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'when', header: 'Quando', sortable: true },
          { id: 'speedKmh', header: 'Pico', cell: (r) => `${r.speedKmh} km/h`, sortable: true },
          { id: 'limitKmh', header: 'Limite', cell: (r) => `${r.limitKmh} km/h`, sortable: true },
          { id: 'excessKmh', header: 'Excesso', cell: (r) => `${r.excessKmh} km/h`, sortable: true }
        ],
        async fetchPage({ page, pageSize }) {
          const total = scopedVehicles.length * Math.max(10, periodDays * 10);
          const start = (page - 1) * pageSize;
          const rows = [];
          for (let i = 0; i < pageSize; i += 1) {
            const idx = start + i;
            if (idx >= total) break;
            const v = scopedVehicles[idx % scopedVehicles.length];
            const h = hashToInt(`${v.id}:speed:${periodDays}:${idx}`);
            const peak = clamp(74 + (h % 48), 70, 140);
            const limit = 80;
            rows.push({
              plate: v.plate,
              fleet: v.fleet,
              when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
              speedKmh: peak,
              limitKmh: limit,
              excessKmh: peak - limit
            });
          }
          await sleep(160);
          return { rows, total };
        },
        async exportAll() {
          const total = scopedVehicles.length * Math.max(10, periodDays * 10);
          const cap = Math.min(total, 5000);
          const out = [];
          for (let idx = 0; idx < cap; idx += 1) {
            const v = scopedVehicles[idx % scopedVehicles.length];
            const h = hashToInt(`${v.id}:speed:${periodDays}:${idx}`);
            const peak = clamp(74 + (h % 48), 70, 140);
            const limit = 80;
            out.push({
              plate: v.plate,
              fleet: v.fleet,
              when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
              speedKmh: peak,
              limitKmh: limit,
              excessKmh: peak - limit
            });
            if (idx > 0 && idx % 800 === 0) await sleep(0);
          }
          downloadCsv('eventos_velocidade.csv', out);
        }
      },
      {
        id: 'fuel',
        title: 'Consumo de Combustível',
        subtitle: 'Distância, litros e média (L/100km)',
        category: 'Custos',
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'distanceKm', header: 'Distância', cell: (r) => formatKm(r.distanceKm), sortable: true },
          { id: 'fuelL', header: 'Combustível', cell: (r) => formatL(r.fuelL), sortable: true },
          { id: 'avgLPer100Km', header: 'Média', cell: (r) => `${r.avgLPer100Km} L/100km`, sortable: true }
        ],
        async fetchPage({ page, pageSize }) {
          const all = makeFuelRows(scopedVehicles, periodDays);
          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll() {
          const all = makeFuelRows(scopedVehicles, periodDays);
          downloadCsv('consumo_combustivel.csv', all);
        }
      },
      {
        id: 'idle',
        title: 'Tempo Parado / Marcha Lenta',
        subtitle: 'Tempo parado, eventos e desperdício aproximado',
        category: 'Operação',
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'idleTime', header: 'Tempo parado' },
          { id: 'idleEvents', header: 'Eventos', sortable: true },
          { id: 'estFuelWasteL', header: 'Desperdício', cell: (r) => `${r.estFuelWasteL} L`, sortable: true }
        ],
        async fetchPage({ page, pageSize }) {
          const all = makeIdleRows(scopedVehicles, periodDays);
          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll() {
          const all = makeIdleRows(scopedVehicles, periodDays);
          downloadCsv('tempo_parado.csv', all);
        }
      },
      {
        id: 'maintenance',
        title: 'Manutenção Preventiva',
        subtitle: 'Proximidade da revisão e prioridade',
        category: 'Manutenção',
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'nextServiceKm', header: 'Próx. revisão', cell: (r) => `${Number(r.nextServiceKm).toLocaleString('pt-BR')} km`, sortable: true },
          {
            id: 'priority',
            header: 'Prioridade',
            sortable: true,
            cell: (r) => {
              const cls = r.priority === 'Vencido' ? 'badge-danger' : r.priority === 'Urgente' ? 'badge-warning' : r.priority === 'Atenção' ? 'badge-info' : 'badge-success';
              return <span className={`badge ${cls}`}>{r.priority}</span>;
            }
          }
        ],
        async fetchPage({ page, pageSize }) {
          const all = makeMaintenanceRows(scopedVehicles);
          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll() {
          const all = makeMaintenanceRows(scopedVehicles);
          downloadCsv('manutencao_preventiva.csv', all);
        }
      },
      {
        id: 'geofence',
        title: 'Cercas Virtuais (Geofence)',
        subtitle: 'Entradas e saídas por área (carregamento paginado)',
        category: 'Conformidade',
        estimateTotal: () => scopedVehicles.length * Math.max(10, periodDays * 8),
        columns: [
          { id: 'when', header: 'Quando', sortable: true },
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'geofence', header: 'Cerca', sortable: true },
          { id: 'event', header: 'Evento', sortable: true }
        ],
        async fetchPage({ page, pageSize }) {
          const fences = ['CD Principal', 'Zona Restrita', 'Filial Sul', 'Porto'];
          const total = scopedVehicles.length * Math.max(10, periodDays * 8);
          const start = (page - 1) * pageSize;
          const rows = [];
          for (let i = 0; i < pageSize; i += 1) {
            const idx = start + i;
            if (idx >= total) break;
            const v = scopedVehicles[idx % scopedVehicles.length];
            const h = hashToInt(`${v.id}:geo:${periodDays}:${idx}`);
            rows.push({
              plate: v.plate,
              fleet: v.fleet,
              when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
              geofence: fences[(h + idx) % fences.length],
              event: ((h + idx) % 2) ? 'Entrada' : 'Saída'
            });
          }
          await sleep(160);
          return { rows, total };
        },
        async exportAll() {
          const fences = ['CD Principal', 'Zona Restrita', 'Filial Sul', 'Porto'];
          const total = scopedVehicles.length * Math.max(10, periodDays * 8);
          const cap = Math.min(total, 5000);
          const out = [];
          for (let idx = 0; idx < cap; idx += 1) {
            const v = scopedVehicles[idx % scopedVehicles.length];
            const h = hashToInt(`${v.id}:geo:${periodDays}:${idx}`);
            out.push({
              plate: v.plate,
              fleet: v.fleet,
              when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
              geofence: fences[(h + idx) % fences.length],
              event: ((h + idx) % 2) ? 'Entrada' : 'Saída'
            });
            if (idx > 0 && idx % 800 === 0) await sleep(0);
          }
          downloadCsv('cercas_virtuais.csv', out);
        }
      },
      {
        id: 'behavior',
        title: 'Comportamento do Motorista',
        subtitle: 'Frenagens/arrancadas/curvas bruscas e score',
        category: 'Segurança',
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'harshBrake', header: 'Frenagens', sortable: true },
          { id: 'harshAccel', header: 'Arrancadas', sortable: true },
          { id: 'sharpTurn', header: 'Curvas', sortable: true },
          {
            id: 'safetyScore',
            header: 'Score',
            sortable: true,
            cell: (r) => {
              const cls = r.safetyScore >= 85 ? 'badge-success' : r.safetyScore >= 70 ? 'badge-warning' : 'badge-danger';
              return <span className={`badge ${cls}`}>{r.safetyScore}</span>;
            }
          }
        ],
        async fetchPage({ page, pageSize }) {
          const all = makeDriverBehaviorRows(scopedVehicles, periodDays);
          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll() {
          const all = makeDriverBehaviorRows(scopedVehicles, periodDays);
          downloadCsv('comportamento_motorista.csv', all);
        }
      },
      {
        id: 'positions',
        title: 'Histórico de Posições (GPS)',
        subtitle: 'Exemplo de relatório de alto volume (pontos GPS paginados)',
        category: 'Rastreamento',
        estimateTotal: () => scopedVehicles.length * Math.max(200, periodDays * 250),
        columns: [
          { id: 'when', header: 'Quando', sortable: true },
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'lat', header: 'Lat' },
          { id: 'lng', header: 'Lng' },
          { id: 'speedKmh', header: 'Veloc.', cell: (r) => `${r.speedKmh} km/h`, sortable: true }
        ],
        async fetchPage({ page, pageSize }) {
          const total = scopedVehicles.length * Math.max(200, periodDays * 250);
          const start = (page - 1) * pageSize;
          const rows = makePositionsRows(scopedVehicles, periodDays, start, Math.min(pageSize, Math.max(0, total - start)));
          await sleep(180);
          return { rows, total };
        },
        async exportAll() {
          const total = scopedVehicles.length * Math.max(200, periodDays * 250);
          const cap = Math.min(total, 8000);
          const out = makePositionsRows(scopedVehicles, periodDays, 0, cap);
          downloadCsv('historico_posicoes.csv', out);
        }
      }
    ];
  }, [scopedVehicles, periodDays]);

  const activeDef = useMemo(() => reportDefs.find((r) => r.id === activeId) || reportDefs[0], [reportDefs, activeId]);

  function updateState(reportId, patch) {
    setStates((s) => ({
      ...s,
      [reportId]: { ...s[reportId], ...patch }
    }));
  }

  async function loadActive() {
    const id = activeDef.id;
    const st = states[id];
    updateState(id, { loading: true });

    try {
      const sort = normalizeSort(st.sort);
      const res = await activeDef.fetchPage({
        fleet,
        periodDays,
        page: st.page,
        pageSize: st.pageSize,
        search: st.search,
        sort
      });
      updateState(id, { rows: res.rows, total: res.total, loading: false });
    } catch {
      updateState(id, { rows: [], total: 0, loading: false });
    }
  }

  useEffect(() => {
    // Carrega apenas o relatório selecionado.
    loadActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, fleet, periodDays]);

  const activeState = states[activeDef.id];

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of reportDefs) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category).push(r);
    }
    return Array.from(map.entries());
  }, [reportDefs]);

  return (
    <section>
      <div className="card mb-4">
        <div className="card-header">
          <div className="card-title">Relatórios</div>
          <div className="card-subtitle text-muted">Carregamento individual por relatório (preview paginado) + exportação</div>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="col-md-4 mb-2">
              <label className="small text-muted" htmlFor="reportFleet">Frota</label>
              <select id="reportFleet" className="form-control" value={fleet} onChange={(e) => { setFleet(e.target.value); }}>
                <option value="">Todas</option>
                {fleetOptions.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4 mb-2">
              <label className="small text-muted" htmlFor="reportPeriod">Período</label>
              <select id="reportPeriod" className="form-control" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
                <option value={1}>Hoje</option>
                <option value={7}>Últimos 7 dias</option>
                <option value={15}>Últimos 15 dias</option>
                <option value={30}>Últimos 30 dias</option>
              </select>
            </div>
            <div className="col-md-4 mb-2">
              <label className="small text-muted">Organização</label>
              <div className="text-muted small">Selecione um relatório no catálogo abaixo para carregar.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-4">
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">Catálogo de Relatórios</div>
              <div className="card-subtitle text-muted">Todos os tipos (carregam individualmente)</div>
            </div>
            <div className="card-body">
              {grouped.map(([cat, items]) => (
                <div key={cat} className="mb-3">
                  <div className="text-muted small mb-2">{cat}</div>
                  <div className="d-flex flex-wrap gap-2">
                    {items.map((r) => {
                      const active = r.id === activeDef.id;
                      const total = r.estimateTotal();
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setActiveId(r.id)}
                        >
                          {r.title}
                          <span className="ml-1 text-muted" aria-hidden="true">({total.toLocaleString('pt-BR')})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="text-muted small">
                Nota: pré-visualização é paginada. Exportação de alto volume é limitada na demo para evitar travar o navegador.
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">{activeDef.title}</div>
              <div className="card-subtitle text-muted">{activeDef.subtitle}</div>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-2">
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => loadActive()}
                  disabled={activeState.loading}
                >
                  Recarregar
                </button>
                <button
                  className="btn btn-outline-info"
                  type="button"
                  onClick={() => activeDef.exportAll()}
                  disabled={activeState.loading}
                >
                  Exportar CSV
                </button>
              </div>

              <DataTable
                mode="server"
                rows={activeState.rows}
                totalRows={activeState.total}
                page={activeState.page}
                pageSize={activeState.pageSize}
                search={activeState.search}
                sort={activeState.sort}
                loading={activeState.loading}
                onPageChange={(p) => { updateState(activeDef.id, { page: p }); loadActive(); }}
                onPageSizeChange={(n) => { updateState(activeDef.id, { pageSize: n, page: 1 }); loadActive(); }}
                onSearchChange={(v) => { updateState(activeDef.id, { search: v, page: 1 }); loadActive(); }}
                onSortChange={(s) => { updateState(activeDef.id, { sort: s, page: 1 }); loadActive(); }}
                rowKey={(r, i) => `${activeDef.id}-${r.plate || ''}-${r.when || ''}-${i}`}
                initialPageSize={10}
                pageSizeOptions={[10, 25, 50]}
                columns={activeDef.columns}
                emptyText="Nenhum registro encontrado."
              />

              <div className="text-muted small mt-2">
                Carregando somente o relatório selecionado. Para produção, use paginação/ordenação/busca no servidor e exportação assíncrona.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
