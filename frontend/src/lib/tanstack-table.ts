import React from 'react';

export type SortDirection = 'asc' | 'desc';

export interface ColumnSort {
  id: string;
  desc: boolean;
}

export type SortingState = ColumnSort[];

export interface CellContext<TData, TValue = unknown> {
  row: {
    id: string;
    index: number;
    original: TData;
    getValue: (columnId: string) => unknown;
  };
  column: {
    id: string;
    columnDef: ColumnDef<TData, TValue>;
  };
  getValue: () => TValue;
}

export interface HeaderContext<TData, TValue = unknown> {
  column: {
    id: string;
    columnDef: ColumnDef<TData, TValue>;
    getIsSorted: () => false | SortDirection;
    toggleSorting: (desc?: boolean) => void;
  };
}

export interface ColumnDef<TData, TValue = any> {
  id: string;
  accessorKey?: keyof TData | string;
  accessorFn?: (row: TData) => TValue;
  header: string | ((ctx: HeaderContext<TData, TValue>) => React.ReactNode);
  cell?: (ctx: CellContext<TData, TValue>) => React.ReactNode;
  enableSorting?: boolean;
  meta?: {
    align?: 'left' | 'center' | 'right';
    width?: string;
    className?: string;
  };
}

export interface TableState {
  sorting?: SortingState;
}

export interface TableOptions<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  state?: TableState;
  manualPagination?: boolean;
  manualSorting?: boolean;
  pageCount?: number;
  onSortingChange?: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  getCoreRowModel: () => any;
}

export function getCoreRowModel() {
  return () => 'core';
}

export function flexRender<TProps>(
  Comp: React.ReactNode | ((props: TProps) => React.ReactNode),
  props: TProps
): React.ReactNode {
  if (typeof Comp === 'function') {
    return (Comp as (props: TProps) => React.ReactNode)(props);
  }
  return Comp;
}

export function useReactTable<TData>(options: TableOptions<TData>) {
  const { data, columns, state, onSortingChange } = options;
  const sorting = state?.sorting ?? [];

  const getHeaderGroups = () => [
    {
      id: 'header-group-0',
      headers: columns.map((col) => {
        const currentSort = sorting.find((s) => s.id === col.id);
        const getIsSorted = (): false | SortDirection => {
          if (!currentSort) return false;
          return currentSort.desc ? 'desc' : 'asc';
        };
        const toggleSorting = (forceDesc?: boolean) => {
          if (!col.enableSorting || !onSortingChange) return;
          const nextDesc =
            typeof forceDesc === 'boolean'
              ? forceDesc
              : currentSort
                ? !currentSort.desc
                : false;
          onSortingChange([{ id: col.id, desc: nextDesc }]);
        };

        return {
          id: col.id,
          column: {
            id: col.id,
            columnDef: col,
            getIsSorted,
            toggleSorting,
          },
          getContext: (): HeaderContext<TData, any> => ({
            column: {
              id: col.id,
              columnDef: col,
              getIsSorted,
              toggleSorting,
            },
          }),
        };
      }),
    },
  ];

  const getRowModel = () => ({
    rows: data.map((item, idx) => {
      const getValue = (colId: string): any => {
        const col = columns.find((c) => c.id === colId);
        if (col?.accessorFn) return col.accessorFn(item);
        const key = (col?.accessorKey ?? colId) as keyof TData;
        return item[key];
      };

      const rowObj = {
        id: String((item as any).apartment_id ?? (item as any).id ?? idx),
        index: idx,
        original: item,
        getValue,
        getVisibleCells: () =>
          columns.map((col) => {
            const val = getValue(col.id);
            return {
              id: `${idx}_${col.id}`,
              column: {
                id: col.id,
                columnDef: col,
              },
              getContext: (): CellContext<TData, any> => ({
                row: {
                  id: String((item as any).apartment_id ?? (item as any).id ?? idx),
                  index: idx,
                  original: item,
                  getValue,
                },
                column: {
                  id: col.id,
                  columnDef: col,
                },
                getValue: () => val,
              }),
            };
          }),
      };
      return rowObj;
    }),
  });

  return {
    getHeaderGroups,
    getRowModel,
  };
}

