import React, { useMemo, useRef, useState } from 'react';
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

export default function ReportsPage({ vehicles }) {
  const [periodDays, setPeriodDays] = useState(7);
  const [fleet, setFleet] = useState('');

  const refs = {
    telemetry: useRef(null),
    trips: useRef(null),
    speeding: useRef(null),
    fuel: useRef(null),
    idle: useRef(null),
    maintenance: useRef(null),
    geofence: useRef(null),
    behavior: useRef(null)
  };

  const fleetOptions = useMemo(() => {
    return Array.from(new Set(vehicles.map((v) => v.fleet))).sort();
  }, [vehicles]);

  const scopedVehicles = useMemo(() => {
    return fleet ? vehicles.filter((v) => v.fleet === fleet) : vehicles;
  }, [vehicles, fleet]);

  const telemetryRows = useMemo(() => scopedVehicles.map(makeTelemetryForVehicle), [scopedVehicles]);
  const tripRows = useMemo(() => makeTripSummaryRows(scopedVehicles, periodDays), [scopedVehicles, periodDays]);
  const speedingRows = useMemo(() => makeSpeedingRows(scopedVehicles, periodDays), [scopedVehicles, periodDays]);
  const fuelRows = useMemo(() => makeFuelRows(scopedVehicles, periodDays), [scopedVehicles, periodDays]);
  const idleRows = useMemo(() => makeIdleRows(scopedVehicles, periodDays), [scopedVehicles, periodDays]);
  const maintenanceRows = useMemo(() => makeMaintenanceRows(scopedVehicles), [scopedVehicles]);
  const geofenceRows = useMemo(() => makeGeofenceRows(scopedVehicles, periodDays), [scopedVehicles, periodDays]);
  const behaviorRows = useMemo(() => makeDriverBehaviorRows(scopedVehicles, periodDays), [scopedVehicles, periodDays]);

  function scrollTo(id) {
    const ref = refs[id];
    if (!ref?.current) return;
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section>
      <div className="card mb-4">
        <div className="card-header">
          <div className="card-title">Relatórios</div>
          <div className="card-subtitle text-muted">Pré-visualização de dados, telemetria e exportação</div>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="col-md-4 mb-2">
              <label className="small text-muted" htmlFor="reportFleet">Frota</label>
              <select id="reportFleet" className="form-control" value={fleet} onChange={(e) => setFleet(e.target.value)}>
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
              <label className="small text-muted">Atalhos</label>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-outline-secondary" type="button" onClick={() => scrollTo('telemetry')}>Telemetria</button>
                <button className="btn btn-outline-secondary" type="button" onClick={() => scrollTo('trips')}>Viagens</button>
                <button className="btn btn-outline-secondary" type="button" onClick={() => scrollTo('speeding')}>Velocidade</button>
                <button className="btn btn-outline-secondary" type="button" onClick={() => scrollTo('fuel')}>Combustível</button>
              </div>
            </div>
          </div>

          <hr className="my-3" />

          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-outline-info" type="button" onClick={() => downloadCsv('telemetria_atual.csv', telemetryRows)}>
              Exportar Telemetria (CSV)
            </button>
            <button className="btn btn-outline-info" type="button" onClick={() => downloadCsv('relatorio_viagens.csv', tripRows)}>
              Exportar Viagens (CSV)
            </button>
            <button className="btn btn-outline-info" type="button" onClick={() => downloadCsv('eventos_velocidade.csv', speedingRows)}>
              Exportar Eventos de Velocidade (CSV)
            </button>
            <button className="btn btn-outline-info" type="button" onClick={() => downloadCsv('consumo_combustivel.csv', fuelRows)}>
              Exportar Consumo (CSV)
            </button>
            <button className="btn btn-outline-info" type="button" onClick={() => downloadCsv('tempo_parado.csv', idleRows)}>
              Exportar Tempo Parado (CSV)
            </button>
            <button className="btn btn-outline-info" type="button" onClick={() => downloadCsv('manutencao_preventiva.csv', maintenanceRows)}>
              Exportar Manutenção (CSV)
            </button>
            <button className="btn btn-outline-info" type="button" onClick={() => downloadCsv('cercas_virtuais.csv', geofenceRows)}>
              Exportar Cercas Virtuais (CSV)
            </button>
            <button className="btn btn-outline-info" type="button" onClick={() => downloadCsv('comportamento_motorista.csv', behaviorRows)}>
              Exportar Comportamento (CSV)
            </button>
          </div>

          <div className="text-muted small mt-2">
            (demo) Dados gerados localmente para pré-visualização. Classes compatíveis com Bootstrap 4.
          </div>
        </div>
      </div>

      <div className="card mb-4" ref={refs.telemetry}>
        <div className="card-header">
          <div className="card-title">Telemetria Atual</div>
          <div className="card-subtitle text-muted">Status de ignição, velocidade, RPM, combustível, temperatura, bateria e GPS</div>
        </div>
        <div className="card-body">
          <DataTable
            rows={telemetryRows}
            rowKey={(r) => r.plate}
            initialPageSize={6}
            columns={[
              { id: 'plate', header: 'Veículo', sortValue: (r) => r.plate },
              { id: 'fleet', header: 'Frota', sortValue: (r) => r.fleet },
              { id: 'ignition', header: 'Ignição', sortValue: (r) => r.ignition },
              { id: 'speed', header: 'Veloc.', cell: (r) => `${r.speedKmh} km/h`, sortValue: (r) => r.speedKmh },
              { id: 'rpm', header: 'RPM', cell: (r) => r.rpm.toLocaleString('pt-BR'), sortValue: (r) => r.rpm },
              { id: 'fuel', header: 'Combustível', cell: (r) => formatPct(r.fuelPct), sortValue: (r) => r.fuelPct },
              { id: 'coolant', header: 'Temp.', cell: (r) => `${r.coolantC}°C`, sortValue: (r) => r.coolantC },
              { id: 'battery', header: 'Bateria', cell: (r) => `${r.batteryV} V`, sortValue: (r) => Number(r.batteryV) }
            ]}
          />
        </div>
      </div>

      <div className="card mb-4" ref={refs.trips}>
        <div className="card-header">
          <div className="card-title">Relatório de Viagens</div>
          <div className="card-subtitle text-muted">Resumo por veículo: número de viagens, distância, tempo em movimento e tempo parado</div>
        </div>
        <div className="card-body">
          <DataTable
            rows={tripRows}
            rowKey={(r) => r.plate}
            initialPageSize={6}
            columns={[
              { id: 'plate', header: 'Veículo', sortValue: (r) => r.plate },
              { id: 'fleet', header: 'Frota', sortValue: (r) => r.fleet },
              { id: 'trips', header: 'Viagens', sortValue: (r) => r.trips },
              { id: 'distanceKm', header: 'Distância', cell: (r) => formatKm(r.distanceKm), sortValue: (r) => r.distanceKm },
              { id: 'driveTime', header: 'Em movimento', sortValue: (r) => r.driveTime },
              { id: 'idleTime', header: 'Parado', sortValue: (r) => r.idleTime }
            ]}
          />
        </div>
      </div>

      <div className="card mb-4" ref={refs.speeding}>
        <div className="card-header">
          <div className="card-title">Eventos de Excesso de Velocidade</div>
          <div className="card-subtitle text-muted">Lista de ocorrências com pico, limite e excesso</div>
        </div>
        <div className="card-body">
          <DataTable
            rows={speedingRows}
            rowKey={(r, i) => `${r.plate}-${i}`}
            initialPageSize={6}
            columns={[
              { id: 'plate', header: 'Veículo', sortValue: (r) => r.plate },
              { id: 'fleet', header: 'Frota', sortValue: (r) => r.fleet },
              { id: 'when', header: 'Quando', sortValue: (r) => r.when },
              { id: 'speed', header: 'Pico', cell: (r) => `${r.speedKmh} km/h`, sortValue: (r) => r.speedKmh },
              { id: 'limit', header: 'Limite', cell: (r) => `${r.limitKmh} km/h`, sortValue: (r) => r.limitKmh },
              { id: 'excess', header: 'Excesso', cell: (r) => `${r.excessKmh} km/h`, sortValue: (r) => r.excessKmh }
            ]}
          />
          <div className="text-muted small mt-2">Dica: use a busca e ordenação para localizar placas e picos.</div>
        </div>
      </div>

      <div className="card mb-4" ref={refs.fuel}>
        <div className="card-header">
          <div className="card-title">Consumo de Combustível</div>
          <div className="card-subtitle text-muted">Estimativa por veículo: distância, litros e média (L/100km)</div>
        </div>
        <div className="card-body">
          <DataTable
            rows={fuelRows}
            rowKey={(r) => r.plate}
            initialPageSize={6}
            columns={[
              { id: 'plate', header: 'Veículo', sortValue: (r) => r.plate },
              { id: 'fleet', header: 'Frota', sortValue: (r) => r.fleet },
              { id: 'distance', header: 'Distância', cell: (r) => formatKm(r.distanceKm), sortValue: (r) => r.distanceKm },
              { id: 'fuel', header: 'Combustível', cell: (r) => formatL(r.fuelL), sortValue: (r) => r.fuelL },
              { id: 'avg', header: 'Média', cell: (r) => `${r.avgLPer100Km} L/100km`, sortValue: (r) => Number(r.avgLPer100Km) }
            ]}
          />
        </div>
      </div>

      <div className="card mb-4" ref={refs.idle}>
        <div className="card-header">
          <div className="card-title">Tempo Parado / Marcha Lenta</div>
          <div className="card-subtitle text-muted">Tempo parado estimado, número de eventos e desperdício aproximado</div>
        </div>
        <div className="card-body">
          <DataTable
            rows={idleRows}
            rowKey={(r) => r.plate}
            initialPageSize={6}
            columns={[
              { id: 'plate', header: 'Veículo', sortValue: (r) => r.plate },
              { id: 'fleet', header: 'Frota', sortValue: (r) => r.fleet },
              { id: 'idleTime', header: 'Tempo parado', sortValue: (r) => r.idleTime },
              { id: 'idleEvents', header: 'Eventos', sortValue: (r) => r.idleEvents },
              { id: 'waste', header: 'Desperdício', cell: (r) => `${r.estFuelWasteL} L`, sortValue: (r) => r.estFuelWasteL }
            ]}
          />
        </div>
      </div>

      <div className="card mb-4" ref={refs.maintenance}>
        <div className="card-header">
          <div className="card-title">Manutenção Preventiva</div>
          <div className="card-subtitle text-muted">Proximidade da revisão (km) e prioridade</div>
        </div>
        <div className="card-body">
          <DataTable
            rows={maintenanceRows}
            rowKey={(r) => r.plate}
            initialPageSize={6}
            columns={[
              { id: 'plate', header: 'Veículo', sortValue: (r) => r.plate },
              { id: 'fleet', header: 'Frota', sortValue: (r) => r.fleet },
              { id: 'next', header: 'Próx. revisão', cell: (r) => `${r.nextServiceKm.toLocaleString('pt-BR')} km`, sortValue: (r) => r.nextServiceKm },
              {
                id: 'priority',
                header: 'Prioridade',
                cell: (r) => {
                  const cls = r.priority === 'Vencido' ? 'badge-danger' : r.priority === 'Urgente' ? 'badge-warning' : r.priority === 'Atenção' ? 'badge-info' : 'badge-success';
                  return <span className={`badge ${cls}`}>{r.priority}</span>;
                },
                sortValue: (r) => r.priority
              }
            ]}
          />
        </div>
      </div>

      <div className="card mb-4" ref={refs.geofence}>
        <div className="card-header">
          <div className="card-title">Cercas Virtuais (Geofence)</div>
          <div className="card-subtitle text-muted">Entradas e saídas em áreas configuradas</div>
        </div>
        <div className="card-body">
          <DataTable
            rows={geofenceRows}
            rowKey={(r, i) => `${r.plate}-${r.geofence}-${i}`}
            initialPageSize={6}
            columns={[
              { id: 'when', header: 'Quando', sortValue: (r) => r.when },
              { id: 'plate', header: 'Veículo', sortValue: (r) => r.plate },
              { id: 'fleet', header: 'Frota', sortValue: (r) => r.fleet },
              { id: 'geofence', header: 'Cerca', sortValue: (r) => r.geofence },
              { id: 'event', header: 'Evento', sortValue: (r) => r.event }
            ]}
          />
        </div>
      </div>

      <div className="card mb-4" ref={refs.behavior}>
        <div className="card-header">
          <div className="card-title">Comportamento do Motorista</div>
          <div className="card-subtitle text-muted">Frenagens/arrancadas/curvas bruscas e score de segurança</div>
        </div>
        <div className="card-body">
          <DataTable
            rows={behaviorRows}
            rowKey={(r) => r.plate}
            initialPageSize={6}
            columns={[
              { id: 'plate', header: 'Veículo', sortValue: (r) => r.plate },
              { id: 'fleet', header: 'Frota', sortValue: (r) => r.fleet },
              { id: 'harshBrake', header: 'Frenagens', sortValue: (r) => r.harshBrake },
              { id: 'harshAccel', header: 'Arrancadas', sortValue: (r) => r.harshAccel },
              { id: 'sharpTurn', header: 'Curvas', sortValue: (r) => r.sharpTurn },
              {
                id: 'score',
                header: 'Score',
                cell: (r) => {
                  const cls = r.safetyScore >= 85 ? 'badge-success' : r.safetyScore >= 70 ? 'badge-warning' : 'badge-danger';
                  return <span className={`badge ${cls}`}>{r.safetyScore}</span>;
                },
                sortValue: (r) => r.safetyScore
              }
            ]}
          />
        </div>
      </div>
    </section>
  );
}
