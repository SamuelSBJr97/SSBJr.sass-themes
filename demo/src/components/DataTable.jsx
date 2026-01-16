import React, { useMemo, useState } from 'react';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function defaultCompare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
}

function pageNumbers(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const set = new Set([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount]);
  const nums = Array.from(set)
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);

  const out = [];
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    const prev = nums[i - 1];
    if (i > 0 && n - prev > 1) out.push('…');
    out.push(n);
  }
  return out;
}

export default function DataTable({
  columns,
  rows,
  rowKey,
  getSearchText,
  variant = 'standard',
  initialPageSize = 6,
  pageSizeOptions = [6, 10, 25],
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nenhum registro encontrado.'
}) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ colId: null, dir: 'asc' });

  const filtered = useMemo(() => {
    const term = (search || '').trim().toLowerCase();
    if (!term) return rows;
    if (!getSearchText) return rows;
    return rows.filter((r) => getSearchText(r).toLowerCase().includes(term));
  }, [rows, search, getSearchText]);

  const sorted = useMemo(() => {
    if (variant === 'summary') return filtered;
    if (!sort.colId) return filtered;

    const col = columns.find((c) => c.id === sort.colId);
    if (!col || !col.sortValue) return filtered;

    const dir = sort.dir === 'desc' ? -1 : 1;
    const withIndex = filtered.map((r, i) => ({ r, i }));

    withIndex.sort((a, b) => {
      const av = col.sortValue(a.r);
      const bv = col.sortValue(b.r);
      const cmp = defaultCompare(av, bv);
      if (cmp !== 0) return cmp * dir;
      return a.i - b.i;
    });

    return withIndex.map((x) => x.r);
  }, [filtered, columns, sort, variant]);

  const pageCount = useMemo(() => {
    if (variant === 'summary') return 1;
    return Math.max(1, Math.ceil(sorted.length / pageSize));
  }, [sorted.length, pageSize, variant]);

  const safePage = clamp(page, 1, pageCount);
  const pageRows = useMemo(() => {
    if (variant === 'summary') return sorted;
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize, variant]);

  const range = useMemo(() => {
    if (!sorted.length) return { start: 0, end: 0, total: 0 };
    if (variant === 'summary') return { start: 1, end: sorted.length, total: sorted.length };

    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(sorted.length, safePage * pageSize);
    return { start, end, total: sorted.length };
  }, [sorted.length, safePage, pageSize, variant]);

  function toggleSort(col) {
    if (variant === 'summary') return;
    if (!col.sortValue) return;

    setPage(1);
    setSort((s) => {
      if (s.colId !== col.id) return { colId: col.id, dir: 'asc' };
      return { colId: col.id, dir: s.dir === 'asc' ? 'desc' : 'asc' };
    });
  }

  function onSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  const showControls = variant !== 'summary';

  return (
    <div className="dataTables_wrapper">
      {showControls ? (
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div className="dataTables_length">
            <label className="mb-0">
              <span className="mr-2">Exibir</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>

          {getSearchText ? (
            <div className="dataTables_filter">
              <label className="mb-0">
                <span className="mr-2">Buscar</span>
                <input
                  type="search"
                  value={search}
                  placeholder={searchPlaceholder}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="table table-hover dataTable">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sort.colId === col.id;
                const ariaSort = isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                const sortable = !!col.sortValue && variant !== 'summary';

                return (
                  <th
                    key={col.id}
                    className={col.headerClassName}
                    aria-sort={ariaSort}
                    style={sortable ? { cursor: 'pointer' } : undefined}
                    onClick={() => toggleSort(col)}
                  >
                    {col.header}
                    {sortable ? (
                      <span className="ml-1 text-muted" aria-hidden="true">
                        {isSorted ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, rowIndex) => (
              <tr key={rowKey ? rowKey(r, rowIndex) : rowIndex}>
                {columns.map((col) => {
                  const value = r && col && col.id in r ? r[col.id] : '';
                  const content = typeof col.cell === 'function' ? col.cell(r, rowIndex) : value;
                  return (
                    <td key={col.id} className={col.className}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!pageRows.length ? <div className="text-muted small">{emptyText}</div> : null}

      {variant !== 'summary' ? (
        <div className="d-flex align-items-center justify-content-between mt-2">
          <div className="dataTables_info">
            {range.total ? `Mostrando ${range.start}–${range.end} de ${range.total}` : 'Sem dados'}
          </div>

          {pageCount > 1 ? (
            <div className="dataTables_paginate paging_simple_numbers">
              <button
                type="button"
                className={`paginate_button previous ${safePage <= 1 ? 'disabled' : ''}`}
                onClick={() => setPage((p) => clamp(p - 1, 1, pageCount))}
                disabled={safePage <= 1}
              >
                Anterior
              </button>

              {pageNumbers(safePage, pageCount).map((n, idx) =>
                n === '…' ? (
                  <span key={`ellipsis-${idx}`} className="paginate_button disabled" aria-hidden="true">…</span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={`paginate_button ${n === safePage ? 'current' : ''}`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                )
              )}

              <button
                type="button"
                className={`paginate_button next ${safePage >= pageCount ? 'disabled' : ''}`}
                onClick={() => setPage((p) => clamp(p + 1, 1, pageCount))}
                disabled={safePage >= pageCount}
              >
                Próximo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
