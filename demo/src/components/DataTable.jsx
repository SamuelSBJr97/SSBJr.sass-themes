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
  mode = 'client',
  totalRows,
  page: controlledPage,
  onPageChange,
  pageSize: controlledPageSize,
  onPageSizeChange,
  search: controlledSearch,
  onSearchChange,
  sort: controlledSort,
  onSortChange,
  loading = false,
  variant = 'standard',
  initialPageSize = 6,
  pageSizeOptions = [6, 10, 25],
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nenhum registro encontrado.'
}) {
  const isServer = mode === 'server';

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ colId: null, dir: 'asc' });

  const effectiveSearch = isServer ? (controlledSearch ?? '') : search;
  const effectivePageSize = isServer ? (controlledPageSize ?? initialPageSize) : pageSize;
  const effectivePage = isServer ? (controlledPage ?? 1) : page;
  const effectiveSort = isServer ? (controlledSort ?? { colId: null, dir: 'asc' }) : sort;

  const canSearch = isServer ? typeof onSearchChange === 'function' : !!getSearchText;

  const filtered = useMemo(() => {
    if (isServer) return rows;

    const term = (effectiveSearch || '').trim().toLowerCase();
    if (!term) return rows;
    if (!getSearchText) return rows;
    return rows.filter((r) => getSearchText(r).toLowerCase().includes(term));
  }, [rows, effectiveSearch, getSearchText, isServer]);

  const sorted = useMemo(() => {
    if (isServer) return filtered;
    if (variant === 'summary') return filtered;
    if (!effectiveSort.colId) return filtered;

    const col = columns.find((c) => c.id === effectiveSort.colId);
    if (!col || !col.sortValue) return filtered;

    const dir = effectiveSort.dir === 'desc' ? -1 : 1;
    const withIndex = filtered.map((r, i) => ({ r, i }));

    withIndex.sort((a, b) => {
      const av = col.sortValue(a.r);
      const bv = col.sortValue(b.r);
      const cmp = defaultCompare(av, bv);
      if (cmp !== 0) return cmp * dir;
      return a.i - b.i;
    });

    return withIndex.map((x) => x.r);
  }, [filtered, columns, effectiveSort, variant, isServer]);

  const pageCount = useMemo(() => {
    if (variant === 'summary') return 1;
    const total = isServer ? (typeof totalRows === 'number' ? totalRows : rows.length) : sorted.length;
    return Math.max(1, Math.ceil(total / effectivePageSize));
  }, [sorted.length, effectivePageSize, variant, isServer, totalRows, rows.length]);

  const safePage = clamp(effectivePage, 1, pageCount);
  const pageRows = useMemo(() => {
    if (variant === 'summary') return sorted;
    if (isServer) return rows;

    const start = (safePage - 1) * effectivePageSize;
    return sorted.slice(start, start + effectivePageSize);
  }, [sorted, safePage, effectivePageSize, variant, isServer, rows]);

  const range = useMemo(() => {
    const total = isServer ? (typeof totalRows === 'number' ? totalRows : rows.length) : sorted.length;
    const len = pageRows.length;

    if (!total) return { start: 0, end: 0, total: 0 };
    if (variant === 'summary') return { start: 1, end: total, total };

    const start = (safePage - 1) * effectivePageSize + 1;
    const end = Math.min(total, start + Math.max(0, len - 1));
    return { start, end, total };
  }, [sorted.length, safePage, effectivePageSize, variant, isServer, totalRows, rows.length, pageRows.length]);

  function toggleSort(col) {
    if (variant === 'summary') return;
    const sortable = isServer ? (col.sortable || !!col.sortValue) : !!col.sortValue;
    if (!sortable) return;

    if (isServer) {
      const next = (() => {
        if (effectiveSort.colId !== col.id) return { colId: col.id, dir: 'asc' };
        return { colId: col.id, dir: effectiveSort.dir === 'asc' ? 'desc' : 'asc' };
      })();
      onSortChange?.(next);
      onPageChange?.(1);
      return;
    }

    setPage(1);
    setSort((s) => {
      if (s.colId !== col.id) return { colId: col.id, dir: 'asc' };
      return { colId: col.id, dir: s.dir === 'asc' ? 'desc' : 'asc' };
    });
  }

  function onLocalSearchChange(value) {
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
              <select
                value={effectivePageSize}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (isServer) {
                    onPageSizeChange?.(next);
                    onPageChange?.(1);
                  } else {
                    setPageSize(next);
                    setPage(1);
                  }
                }}
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>

          {canSearch ? (
            <div className="dataTables_filter">
              <label className="mb-0">
                <span className="mr-2">Buscar</span>
                <input
                  type="search"
                  value={effectiveSearch}
                  placeholder={searchPlaceholder}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isServer) {
                      onSearchChange?.(v);
                      onPageChange?.(1);
                    } else {
                      onLocalSearchChange(v);
                    }
                  }}
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
                const isSorted = effectiveSort.colId === col.id;
                const ariaSort = isSorted ? (effectiveSort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                const sortable = variant !== 'summary' && (isServer ? (col.sortable || !!col.sortValue) : !!col.sortValue);

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

      {loading ? <div className="text-muted small mt-2">Carregando…</div> : null}

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
                onClick={() => (isServer ? onPageChange?.(clamp(safePage - 1, 1, pageCount)) : setPage((p) => clamp(p - 1, 1, pageCount)))}
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
                    onClick={() => (isServer ? onPageChange?.(n) : setPage(n))}
                  >
                    {n}
                  </button>
                )
              )}

              <button
                type="button"
                className={`paginate_button next ${safePage >= pageCount ? 'disabled' : ''}`}
                onClick={() => (isServer ? onPageChange?.(clamp(safePage + 1, 1, pageCount)) : setPage((p) => clamp(p + 1, 1, pageCount)))}
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
