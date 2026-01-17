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

function normalizeQuery(search) {
  return String(search ?? '').trim().toLowerCase();
}

function includesText(value, q) {
  if (!q) return true;
  return String(value ?? '').toLowerCase().includes(q);
}

export default function ReportsPage({ vehicles }) {
  const [periodDays, setPeriodDays] = useState(7);
  const [fleet, setFleet] = useState('');
  const [draftPeriodDays, setDraftPeriodDays] = useState(7);
  const [draftFleet, setDraftFleet] = useState('');
  const [hasApplied, setHasApplied] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [activeCategory, setActiveCategory] = useState('Rastreamento');

  const [states, setStates] = useState(() => ({
    telemetry: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: null, dir: 'asc' },
      filters: { ignition: '', minSpeedKmh: '', maxSpeedKmh: '' },
      rows: [],
      total: 0,
      loading: false
    },
    trips: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: null, dir: 'asc' },
      filters: { minTrips: '', minDistanceKm: '' },
      rows: [],
      total: 0,
      loading: false
    },
    speeding: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: 'when', dir: 'desc' },
      filters: { limitKmh: 80, minExcessKmh: 10, minPeakKmh: '' },
      rows: [],
      total: 0,
      loading: false
    },
    fuel: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: null, dir: 'asc' },
      filters: { minDistanceKm: '', maxAvgLPer100Km: '' },
      rows: [],
      total: 0,
      loading: false
    },
    idle: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: null, dir: 'asc' },
      filters: { minIdleEvents: '', minWasteL: '' },
      rows: [],
      total: 0,
      loading: false
    },
    maintenance: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: 'priority', dir: 'asc' },
      filters: { priority: '' },
      rows: [],
      total: 0,
      loading: false
    },
    geofence: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: 'when', dir: 'desc' },
      filters: { event: '', geofence: '' },
      rows: [],
      total: 0,
      loading: false
    },
    behavior: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: 'safetyScore', dir: 'desc' },
      filters: { minScore: 70 },
      rows: [],
      total: 0,
      loading: false
    },
    positions: {
      page: 1,
      pageSize: 10,
      search: '',
      sort: { colId: 'when', dir: 'desc' },
      filters: { minSpeedKmh: '' },
      rows: [],
      total: 0,
      loading: false
    }
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
        defaultFilters: { ignition: '', minSpeedKmh: '', maxSpeedKmh: '' },
        filters: [
          {
            id: 'ignition',
            label: 'Ignição',
            type: 'select',
            options: [
              { value: '', label: 'Todas' },
              { value: 'Ligada', label: 'Ligada' },
              { value: 'Desligada', label: 'Desligada' }
            ]
          },
          { id: 'minSpeedKmh', label: 'Veloc. mínima (km/h)', type: 'number', min: 0, step: 1, placeholder: 'ex: 10' },
          { id: 'maxSpeedKmh', label: 'Veloc. máxima (km/h)', type: 'number', min: 0, step: 1, placeholder: 'ex: 80' }
        ],
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
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minSpeed = f.minSpeedKmh !== '' && f.minSpeedKmh != null ? Number(f.minSpeedKmh) : null;
          const maxSpeed = f.maxSpeedKmh !== '' && f.maxSpeedKmh != null ? Number(f.maxSpeedKmh) : null;

          const all = scopedVehicles
            .map(makeTelemetryForVehicle)
            .filter((r) => {
              if (f.ignition && r.ignition !== f.ignition) return false;
              if (Number.isFinite(minSpeed) && r.speedKmh < minSpeed) return false;
              if (Number.isFinite(maxSpeed) && r.speedKmh > maxSpeed) return false;
              if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
              return true;
            });

          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minSpeed = f.minSpeedKmh !== '' && f.minSpeedKmh != null ? Number(f.minSpeedKmh) : null;
          const maxSpeed = f.maxSpeedKmh !== '' && f.maxSpeedKmh != null ? Number(f.maxSpeedKmh) : null;

          const rows = scopedVehicles
            .map(makeTelemetryForVehicle)
            .filter((r) => {
              if (f.ignition && r.ignition !== f.ignition) return false;
              if (Number.isFinite(minSpeed) && r.speedKmh < minSpeed) return false;
              if (Number.isFinite(maxSpeed) && r.speedKmh > maxSpeed) return false;
              if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
              return true;
            });

          downloadCsv('telemetria_atual.csv', rows);
        }
      },
      {
        id: 'trips',
        title: 'Relatório de Viagens',
        subtitle: 'Resumo por veículo: viagens, distância, tempo em movimento e tempo parado',
        category: 'Operação',
        defaultFilters: { minTrips: '', minDistanceKm: '' },
        filters: [
          { id: 'minTrips', label: 'Mín. viagens', type: 'number', min: 0, step: 1, placeholder: 'ex: 3' },
          { id: 'minDistanceKm', label: 'Mín. distância (km)', type: 'number', min: 0, step: 1, placeholder: 'ex: 50' }
        ],
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'trips', header: 'Viagens', sortable: true },
          { id: 'distanceKm', header: 'Distância', cell: (r) => formatKm(r.distanceKm), sortable: true },
          { id: 'driveTime', header: 'Em movimento' },
          { id: 'idleTime', header: 'Parado' }
        ],
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minTrips = f.minTrips !== '' && f.minTrips != null ? Number(f.minTrips) : null;
          const minDistance = f.minDistanceKm !== '' && f.minDistanceKm != null ? Number(f.minDistanceKm) : null;

          const all = makeTripSummaryRows(scopedVehicles, periodDays).filter((r) => {
            if (Number.isFinite(minTrips) && r.trips < minTrips) return false;
            if (Number.isFinite(minDistance) && r.distanceKm < minDistance) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
            return true;
          });

          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minTrips = f.minTrips !== '' && f.minTrips != null ? Number(f.minTrips) : null;
          const minDistance = f.minDistanceKm !== '' && f.minDistanceKm != null ? Number(f.minDistanceKm) : null;

          const all = makeTripSummaryRows(scopedVehicles, periodDays).filter((r) => {
            if (Number.isFinite(minTrips) && r.trips < minTrips) return false;
            if (Number.isFinite(minDistance) && r.distanceKm < minDistance) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
            return true;
          });

          downloadCsv('relatorio_viagens.csv', all);
        }
      },
      {
        id: 'speeding',
        title: 'Eventos de Excesso de Velocidade',
        subtitle: 'Ocorrências com pico, limite e excesso (carregamento paginado)',
        category: 'Segurança',
        defaultFilters: { limitKmh: 80, minExcessKmh: 10, minPeakKmh: '' },
        filters: [
          {
            id: 'limitKmh',
            label: 'Limite (km/h)',
            type: 'select',
            options: [
              { value: 60, label: '60' },
              { value: 80, label: '80' },
              { value: 100, label: '100' }
            ]
          },
          { id: 'minExcessKmh', label: 'Mín. excesso (km/h)', type: 'number', min: 0, step: 1, placeholder: 'ex: 10' },
          { id: 'minPeakKmh', label: 'Mín. pico (km/h)', type: 'number', min: 0, step: 1, placeholder: 'ex: 90' }
        ],
        estimateTotal: () => Math.min(scopedVehicles.length * Math.max(10, periodDays * 10), 2000),
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'when', header: 'Quando', sortable: true },
          { id: 'speedKmh', header: 'Pico', cell: (r) => `${r.speedKmh} km/h`, sortable: true },
          { id: 'limitKmh', header: 'Limite', cell: (r) => `${r.limitKmh} km/h`, sortable: true },
          { id: 'excessKmh', header: 'Excesso', cell: (r) => `${r.excessKmh} km/h`, sortable: true }
        ],
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};

          const baseTotal = scopedVehicles.length * Math.max(10, periodDays * 10);
          const hardCap = 2000;
          const totalUniverse = Math.min(baseTotal, hardCap);

          const limit = Number(f.limitKmh ?? 80);
          const minExcess = f.minExcessKmh !== '' && f.minExcessKmh != null ? Number(f.minExcessKmh) : 0;
          const minPeak = f.minPeakKmh !== '' && f.minPeakKmh != null ? Number(f.minPeakKmh) : null;

          const targetStart = (page - 1) * pageSize;
          let seen = 0;
          const rows = [];

          for (let idx = 0; idx < totalUniverse; idx += 1) {
            const v = scopedVehicles[idx % scopedVehicles.length];
            const h = hashToInt(`${v.id}:speed:${periodDays}:${idx}`);
            const peak = clamp(74 + (h % 48), 70, 140);
            const excess = peak - limit;
            const row = {
              plate: v.plate,
              fleet: v.fleet,
              when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
              speedKmh: peak,
              limitKmh: limit,
              excessKmh: excess
            };

            if (excess < minExcess) continue;
            if (Number.isFinite(minPeak) && peak < minPeak) continue;
            if (q && !(includesText(row.plate, q) || includesText(row.fleet, q) || includesText(row.when, q))) continue;

            if (seen >= targetStart && rows.length < pageSize) rows.push(row);
            seen += 1;
          }

          await sleep(160);
          return { rows, total: seen };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};

          const baseTotal = scopedVehicles.length * Math.max(10, periodDays * 10);
          const hardCap = 2000;
          const totalUniverse = Math.min(baseTotal, hardCap);

          const limit = Number(f.limitKmh ?? 80);
          const minExcess = f.minExcessKmh !== '' && f.minExcessKmh != null ? Number(f.minExcessKmh) : 0;
          const minPeak = f.minPeakKmh !== '' && f.minPeakKmh != null ? Number(f.minPeakKmh) : null;

          const out = [];

          // Exporta somente o preview (capado) nesta demo.
          for (let idx = 0; idx < totalUniverse; idx += 1) {
            const v = scopedVehicles[idx % scopedVehicles.length];
            const h = hashToInt(`${v.id}:speed:${periodDays}:${idx}`);
            const peak = clamp(74 + (h % 48), 70, 140);
            const excess = peak - limit;
            const row = {
              plate: v.plate,
              fleet: v.fleet,
              when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
              speedKmh: peak,
              limitKmh: limit,
              excessKmh: excess
            };

            if (excess < minExcess) continue;
            if (Number.isFinite(minPeak) && peak < minPeak) continue;
            if (q && !(includesText(row.plate, q) || includesText(row.fleet, q) || includesText(row.when, q))) continue;

            out.push(row);
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
        defaultFilters: { minDistanceKm: '', maxAvgLPer100Km: '' },
        filters: [
          { id: 'minDistanceKm', label: 'Mín. distância (km)', type: 'number', min: 0, step: 1, placeholder: 'ex: 50' },
          { id: 'maxAvgLPer100Km', label: 'Máx. média (L/100km)', type: 'number', min: 0, step: 0.1, placeholder: 'ex: 14.5' }
        ],
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'distanceKm', header: 'Distância', cell: (r) => formatKm(r.distanceKm), sortable: true },
          { id: 'fuelL', header: 'Combustível', cell: (r) => formatL(r.fuelL), sortable: true },
          { id: 'avgLPer100Km', header: 'Média', cell: (r) => `${r.avgLPer100Km} L/100km`, sortable: true }
        ],
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minDistance = f.minDistanceKm !== '' && f.minDistanceKm != null ? Number(f.minDistanceKm) : null;
          const maxAvg = f.maxAvgLPer100Km !== '' && f.maxAvgLPer100Km != null ? Number(f.maxAvgLPer100Km) : null;

          const all = makeFuelRows(scopedVehicles, periodDays).filter((r) => {
            if (Number.isFinite(minDistance) && r.distanceKm < minDistance) return false;
            if (Number.isFinite(maxAvg) && Number(r.avgLPer100Km) > maxAvg) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
            return true;
          });

          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minDistance = f.minDistanceKm !== '' && f.minDistanceKm != null ? Number(f.minDistanceKm) : null;
          const maxAvg = f.maxAvgLPer100Km !== '' && f.maxAvgLPer100Km != null ? Number(f.maxAvgLPer100Km) : null;

          const all = makeFuelRows(scopedVehicles, periodDays).filter((r) => {
            if (Number.isFinite(minDistance) && r.distanceKm < minDistance) return false;
            if (Number.isFinite(maxAvg) && Number(r.avgLPer100Km) > maxAvg) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
            return true;
          });

          downloadCsv('consumo_combustivel.csv', all);
        }
      },
      {
        id: 'idle',
        title: 'Tempo Parado / Marcha Lenta',
        subtitle: 'Tempo parado, eventos e desperdício aproximado',
        category: 'Operação',
        defaultFilters: { minIdleEvents: '', minWasteL: '' },
        filters: [
          { id: 'minIdleEvents', label: 'Mín. eventos', type: 'number', min: 0, step: 1, placeholder: 'ex: 2' },
          { id: 'minWasteL', label: 'Mín. desperdício (L)', type: 'number', min: 0, step: 1, placeholder: 'ex: 3' }
        ],
        estimateTotal: () => scopedVehicles.length,
        columns: [
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'idleTime', header: 'Tempo parado' },
          { id: 'idleEvents', header: 'Eventos', sortable: true },
          { id: 'estFuelWasteL', header: 'Desperdício', cell: (r) => `${r.estFuelWasteL} L`, sortable: true }
        ],
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minEvents = f.minIdleEvents !== '' && f.minIdleEvents != null ? Number(f.minIdleEvents) : null;
          const minWaste = f.minWasteL !== '' && f.minWasteL != null ? Number(f.minWasteL) : null;

          const all = makeIdleRows(scopedVehicles, periodDays).filter((r) => {
            if (Number.isFinite(minEvents) && r.idleEvents < minEvents) return false;
            if (Number.isFinite(minWaste) && r.estFuelWasteL < minWaste) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
            return true;
          });

          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minEvents = f.minIdleEvents !== '' && f.minIdleEvents != null ? Number(f.minIdleEvents) : null;
          const minWaste = f.minWasteL !== '' && f.minWasteL != null ? Number(f.minWasteL) : null;

          const all = makeIdleRows(scopedVehicles, periodDays).filter((r) => {
            if (Number.isFinite(minEvents) && r.idleEvents < minEvents) return false;
            if (Number.isFinite(minWaste) && r.estFuelWasteL < minWaste) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
            return true;
          });

          downloadCsv('tempo_parado.csv', all);
        }
      },
      {
        id: 'maintenance',
        title: 'Manutenção Preventiva',
        subtitle: 'Proximidade da revisão e prioridade',
        category: 'Manutenção',
        defaultFilters: { priority: '' },
        filters: [
          {
            id: 'priority',
            label: 'Prioridade',
            type: 'select',
            options: [
              { value: '', label: 'Todas' },
              { value: 'Vencido', label: 'Vencido' },
              { value: 'Urgente', label: 'Urgente' },
              { value: 'Atenção', label: 'Atenção' },
              { value: 'OK', label: 'OK' }
            ]
          }
        ],
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
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};

          const all = makeMaintenanceRows(scopedVehicles).filter((r) => {
            if (f.priority && r.priority !== f.priority) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q) || includesText(r.priority, q))) return false;
            return true;
          });

          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};

          const all = makeMaintenanceRows(scopedVehicles).filter((r) => {
            if (f.priority && r.priority !== f.priority) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q) || includesText(r.priority, q))) return false;
            return true;
          });

          downloadCsv('manutencao_preventiva.csv', all);
        }
      },
      {
        id: 'geofence',
        title: 'Cercas Virtuais (Geofence)',
        subtitle: 'Entradas e saídas por área (carregamento paginado)',
        category: 'Conformidade',
        defaultFilters: { event: '', geofence: '' },
        filters: [
          {
            id: 'event',
            label: 'Evento',
            type: 'select',
            options: [
              { value: '', label: 'Todos' },
              { value: 'Entrada', label: 'Entrada' },
              { value: 'Saída', label: 'Saída' }
            ]
          },
          {
            id: 'geofence',
            label: 'Cerca',
            type: 'select',
            options: [
              { value: '', label: 'Todas' },
              { value: 'CD Principal', label: 'CD Principal' },
              { value: 'Zona Restrita', label: 'Zona Restrita' },
              { value: 'Filial Sul', label: 'Filial Sul' },
              { value: 'Porto', label: 'Porto' }
            ]
          }
        ],
        estimateTotal: () => Math.min(scopedVehicles.length * Math.max(10, periodDays * 8), 2000),
        columns: [
          { id: 'when', header: 'Quando', sortable: true },
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'geofence', header: 'Cerca', sortable: true },
          { id: 'event', header: 'Evento', sortable: true }
        ],
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};

          const fences = ['CD Principal', 'Zona Restrita', 'Filial Sul', 'Porto'];
          const baseTotal = scopedVehicles.length * Math.max(10, periodDays * 8);
          const hardCap = 2000;
          const totalUniverse = Math.min(baseTotal, hardCap);

          const targetStart = (page - 1) * pageSize;
          let seen = 0;
          const rows = [];

          for (let idx = 0; idx < totalUniverse; idx += 1) {
            const v = scopedVehicles[idx % scopedVehicles.length];
            const h = hashToInt(`${v.id}:geo:${periodDays}:${idx}`);
            const row = {
              plate: v.plate,
              fleet: v.fleet,
              when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
              geofence: fences[(h + idx) % fences.length],
              event: ((h + idx) % 2) ? 'Entrada' : 'Saída'
            };

            if (f.event && row.event !== f.event) continue;
            if (f.geofence && row.geofence !== f.geofence) continue;
            if (q && !(includesText(row.plate, q) || includesText(row.fleet, q) || includesText(row.when, q) || includesText(row.geofence, q))) continue;

            if (seen >= targetStart && rows.length < pageSize) rows.push(row);
            seen += 1;
          }

          await sleep(160);
          return { rows, total: seen };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};

          const fences = ['CD Principal', 'Zona Restrita', 'Filial Sul', 'Porto'];
          const baseTotal = scopedVehicles.length * Math.max(10, periodDays * 8);
          const cap = Math.min(baseTotal, 2000);
          const out = [];
          for (let idx = 0; idx < cap; idx += 1) {
            const v = scopedVehicles[idx % scopedVehicles.length];
            const h = hashToInt(`${v.id}:geo:${periodDays}:${idx}`);
            const row = {
              plate: v.plate,
              fleet: v.fleet,
              when: `D-${(idx % periodDays) + 1} ${String((h % 24)).padStart(2, '0')}:${String((h % 60)).padStart(2, '0')}`,
              geofence: fences[(h + idx) % fences.length],
              event: ((h + idx) % 2) ? 'Entrada' : 'Saída'
            };

            if (f.event && row.event !== f.event) continue;
            if (f.geofence && row.geofence !== f.geofence) continue;
            if (q && !(includesText(row.plate, q) || includesText(row.fleet, q) || includesText(row.when, q) || includesText(row.geofence, q))) continue;

            out.push(row);
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
        defaultFilters: { minScore: 70 },
        filters: [
          { id: 'minScore', label: 'Score mínimo', type: 'number', min: 0, step: 1, placeholder: 'ex: 70' }
        ],
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
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minScore = f.minScore !== '' && f.minScore != null ? Number(f.minScore) : 0;

          const all = makeDriverBehaviorRows(scopedVehicles, periodDays).filter((r) => {
            if (r.safetyScore < minScore) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
            return true;
          });

          const total = all.length;
          const start = (page - 1) * pageSize;
          await sleep(120);
          return { rows: all.slice(start, start + pageSize), total };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};
          const minScore = f.minScore !== '' && f.minScore != null ? Number(f.minScore) : 0;

          const all = makeDriverBehaviorRows(scopedVehicles, periodDays).filter((r) => {
            if (r.safetyScore < minScore) return false;
            if (q && !(includesText(r.plate, q) || includesText(r.fleet, q))) return false;
            return true;
          });

          downloadCsv('comportamento_motorista.csv', all);
        }
      },
      {
        id: 'positions',
        title: 'Histórico de Posições (GPS)',
        subtitle: 'Exemplo de relatório de alto volume (pontos GPS paginados)',
        category: 'Rastreamento',
        defaultFilters: { minSpeedKmh: '' },
        filters: [
          { id: 'minSpeedKmh', label: 'Veloc. mínima (km/h)', type: 'number', min: 0, step: 1, placeholder: 'ex: 5' }
        ],
        estimateTotal: () => Math.min(scopedVehicles.length * Math.max(200, periodDays * 250), 3000),
        columns: [
          { id: 'when', header: 'Quando', sortable: true },
          { id: 'plate', header: 'Veículo', sortable: true },
          { id: 'fleet', header: 'Frota', sortable: true },
          { id: 'lat', header: 'Lat' },
          { id: 'lng', header: 'Lng' },
          { id: 'speedKmh', header: 'Veloc.', cell: (r) => `${r.speedKmh} km/h`, sortable: true }
        ],
        async fetchPage({ page, pageSize, search, filters }) {
          const q = normalizeQuery(search);
          const f = filters || {};

          const baseTotal = scopedVehicles.length * Math.max(200, periodDays * 250);
          const hardCap = 3000;
          const totalUniverse = Math.min(baseTotal, hardCap);

          const minSpeed = f.minSpeedKmh !== '' && f.minSpeedKmh != null ? Number(f.minSpeedKmh) : null;

          const targetStart = (page - 1) * pageSize;
          let seen = 0;
          const rows = [];

          for (let idx = 0; idx < totalUniverse; idx += 1) {
            const row = makePositionsRows(scopedVehicles, periodDays, idx, 1)[0];
            if (Number.isFinite(minSpeed) && row.speedKmh < minSpeed) continue;
            if (q && !(includesText(row.plate, q) || includesText(row.fleet, q) || includesText(row.when, q))) continue;
            if (seen >= targetStart && rows.length < pageSize) rows.push(row);
            seen += 1;
          }

          await sleep(180);
          return { rows, total: seen };
        },
        async exportAll({ search, filters } = {}) {
          const q = normalizeQuery(search);
          const f = filters || {};

          const baseTotal = scopedVehicles.length * Math.max(200, periodDays * 250);
          const cap = Math.min(baseTotal, 3000);
          const minSpeed = f.minSpeedKmh !== '' && f.minSpeedKmh != null ? Number(f.minSpeedKmh) : null;

          const out = makePositionsRows(scopedVehicles, periodDays, 0, cap).filter((row) => {
            if (Number.isFinite(minSpeed) && row.speedKmh < minSpeed) return false;
            if (q && !(includesText(row.plate, q) || includesText(row.fleet, q) || includesText(row.when, q))) return false;
            return true;
          });

          downloadCsv('historico_posicoes.csv', out);
        }
      }
    ];
  }, [scopedVehicles, periodDays]);

  const activeDef = useMemo(() => reportDefs.find((r) => r.id === activeId) || null, [reportDefs, activeId]);

  function updateState(reportId, patch) {
    setStates((s) => ({
      ...s,
      [reportId]: { ...s[reportId], ...patch }
    }));
  }

  async function loadActive(overrides = {}) {
    if (!hasApplied || !activeDef) return;
    const id = activeDef.id;
    const st = { ...states[id], ...overrides };
    updateState(id, { ...overrides, loading: true });

    try {
      const sort = normalizeSort(st.sort);
      const res = await activeDef.fetchPage({
        fleet,
        periodDays,
        page: st.page,
        pageSize: st.pageSize,
        search: st.search,
        sort,
        filters: st.filters
      });
      updateState(id, { rows: res.rows, total: res.total, loading: false });
    } catch {
      updateState(id, { rows: [], total: 0, loading: false });
    }
  }

  useEffect(() => {
    // Carrega apenas o relatório selecionado (depois que o usuário aplicar filtros).
    if (!hasApplied || !activeDef) return;
    loadActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, fleet, periodDays, hasApplied]);

  useEffect(() => {
    if (activeDef?.category && activeCategory !== activeDef.category) {
      setActiveCategory(activeDef.category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDef?.category]);

  const activeState = activeDef ? states[activeDef.id] : null;

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of reportDefs) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category).push(r);
    }
    return Array.from(map.entries());
  }, [reportDefs]);

  const categories = useMemo(() => grouped.map(([cat]) => cat), [grouped]);
  const reportsInCategory = useMemo(() => {
    return reportDefs.filter((r) => r.category === activeCategory);
  }, [reportDefs, activeCategory]);

  function setCategory(cat) {
    if (cat === activeCategory) return;
    setActiveCategory(cat);
    // Ao trocar a categoria, desmarca o relatório e limpa tudo até selecionar/aplicar.
    setHasApplied(false);
    if (activeDef) {
      updateState(activeDef.id, {
        page: 1,
        search: '',
        filters: activeDef.defaultFilters,
        rows: [],
        total: 0,
        loading: false
      });
    }
    setActiveId('');
  }

  function setActiveReport(id) {
    if (id === activeId) return;
    const def = reportDefs.find((r) => r.id === id);
    if (def?.category) setActiveCategory(def.category);
    // Ao trocar o relatório, limpa os dados e exige novo "Aplicar".
    setHasApplied(false);
    updateState(id, {
      page: 1,
      search: '',
      filters: def?.defaultFilters ?? states[id]?.filters,
      rows: [],
      total: 0,
      loading: false
    });
    setActiveId(id);
  }

  function setActiveFilter(fieldId, value) {
    if (!activeDef || !activeState) return;
    updateState(activeDef.id, {
      filters: { ...(activeState.filters || {}), [fieldId]: value }
    });
  }

  function resetActiveFilters() {
    if (!activeDef) return;
    updateState(activeDef.id, { filters: activeDef.defaultFilters, page: 1 });
    if (hasApplied) loadActive({ filters: activeDef.defaultFilters, page: 1 });
  }

  return (
    <section>
      <div className="row">
        <div className="col-lg-3">
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">1) Tipo de relatório</div>
              <div className="card-subtitle text-muted">Selecione a categoria</div>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`btn btn-sm ${cat === activeCategory ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-3">
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">2) Relatórios</div>
              <div className="card-subtitle text-muted">Do tipo selecionado</div>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                {reportsInCategory.map((r) => {
                  const active = r.id === activeDef.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setActiveReport(r.id)}
                    >
                      {r.title}
                    </button>
                  );
                })}
              </div>

              <div className="text-muted small mt-2">
                Pré-visualização paginada e export limitado na demo.
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">3) Relatório</div>
              <div className="card-subtitle text-muted">Filtro + dados</div>
            </div>
            <div className="card-body">
              {!activeDef ? (
                <div className="alert alert-info mb-0">
                  Selecione um tipo de relatório no passo 2 para configurar filtros e visualizar os dados.
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="font-weight-bold">{activeDef.title}</div>
                    <div className="text-muted small">{activeDef.subtitle}</div>
                  </div>

                  <div className="mb-3">
                    <div className="text-muted small mb-2">Escopo</div>
                    <div className="md-form">
                      <div className="form-row">
                        <div className="col-md-6">
                          <div className={`md-field ${draftFleet ? 'is-filled' : ''}`}>
                            <select
                              id="reportFleet"
                              className="form-control"
                              value={draftFleet}
                              onChange={(e) => { setDraftFleet(e.target.value); }}
                            >
                              <option value="">Todas</option>
                              {fleetOptions.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                            <label htmlFor="reportFleet">Frota</label>
                            <small className="md-helper">Escopo dos dados</small>
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className={`md-field ${draftPeriodDays ? 'is-filled' : ''}`}>
                            <select
                              id="reportPeriod"
                              className="form-control"
                              value={draftPeriodDays}
                              onChange={(e) => setDraftPeriodDays(Number(e.target.value))}
                            >
                              <option value={1}>Hoje</option>
                              <option value={7}>Últimos 7 dias</option>
                              <option value={15}>Últimos 15 dias</option>
                              <option value={30}>Últimos 30 dias</option>
                            </select>
                            <label htmlFor="reportPeriod">Período</label>
                            <small className="md-helper">Período de apuração</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-muted small mb-2">Filtros do relatório</div>
                    <form
                      className="md-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const sameScope = draftFleet === fleet && draftPeriodDays === periodDays;

                        updateState(activeDef.id, sameScope ? { page: 1 } : { page: 1, rows: [], total: 0 });
                        setHasApplied(true);
                        setFleet(draftFleet);
                        setPeriodDays(draftPeriodDays);

                        // Se o escopo não mudou, podemos recarregar imediatamente.
                        if (sameScope) loadActive({ page: 1 });
                      }}
                    >
                      <div className="form-row">
                        {(activeDef.filters || []).map((field) => {
                          const value = (activeState?.filters || {})[field.id];

                          if (field.type === 'select') {
                            return (
                              <div key={field.id} className="col-md-6">
                                <div className={`md-field ${value !== '' && value != null ? 'is-filled' : ''}`}>
                                  <select
                                    id={`rf-${field.id}`}
                                    className="form-control"
                                    value={value ?? ''}
                                    onChange={(ev) => setActiveFilter(field.id, ev.target.value)}
                                  >
                                    {(field.options || []).map((opt) => (
                                      <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <label htmlFor={`rf-${field.id}`}>{field.label}</label>
                                  <small className="md-helper">Seleção</small>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={field.id} className="col-md-6">
                              <div className={`md-field ${value !== '' && value != null ? 'is-filled' : ''}`}>
                                <input
                                  id={`rf-${field.id}`}
                                  className="form-control"
                                  type="number"
                                  min={field.min}
                                  step={field.step}
                                  placeholder=" "
                                  value={value ?? ''}
                                  onChange={(ev) => setActiveFilter(field.id, ev.target.value)}
                                />
                                <label htmlFor={`rf-${field.id}`}>{field.label}</label>
                                <small className="md-helper">{field.placeholder || 'Filtro'}</small>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="d-flex flex-wrap gap-2">
                        <button className="btn btn-primary" type="submit" disabled={activeState?.loading}>
                          Aplicar filtros
                        </button>
                        <button className="btn btn-outline-secondary" type="button" onClick={() => resetActiveFilters()} disabled={activeState?.loading}>
                          Limpar filtros
                        </button>
                        <button className="btn btn-outline-secondary" type="button" onClick={() => loadActive()} disabled={!hasApplied || activeState?.loading}>
                          Recarregar
                        </button>
                        <button
                          className="btn btn-outline-info"
                          type="button"
                          onClick={() => activeDef.exportAll({ search: activeState?.search, filters: activeState?.filters })}
                          disabled={!hasApplied || activeState?.loading}
                        >
                          Exportar CSV
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">Dados</div>
              <div className="card-subtitle text-muted">Pré-visualização paginada</div>
            </div>
            <div className="card-body">
              {!activeDef ? (
                <div className="alert alert-info mb-0">
                  Selecione um tipo de relatório para visualizar os dados.
                </div>
              ) : !hasApplied ? (
                <div className="alert alert-info mb-0">
                  Aplique os filtros para exibir os dados do relatório.
                </div>
              ) : (
                <DataTable
                  mode="server"
                  rows={activeState?.rows || []}
                  totalRows={activeState?.total || 0}
                  page={activeState?.page || 1}
                  pageSize={activeState?.pageSize || 10}
                  search={activeState?.search || ''}
                  sort={activeState?.sort || { colId: null, dir: 'asc' }}
                  loading={activeState?.loading}
                  onPageChange={(p) => loadActive({ page: p })}
                  onPageSizeChange={(n) => loadActive({ pageSize: n, page: 1 })}
                  onSearchChange={(v) => loadActive({ search: v, page: 1 })}
                  onSortChange={(s) => loadActive({ sort: s, page: 1 })}
                  rowKey={(r, i) => `${activeDef.id}-${r.plate || ''}-${r.when || ''}-${i}`}
                  initialPageSize={10}
                  pageSizeOptions={[10, 25, 50]}
                  columns={activeDef.columns}
                  emptyText="Nenhum registro encontrado."
                />
              )}

              <div className="text-muted small mt-2">
                Carrega somente o relatório selecionado. Em produção, isso viria do backend.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
