import * as React from "react";
import { cn } from "@/lib/utils";
import { DsEmptyState } from "@/components/ds/panel";

export type DsColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "num";
  mono?: boolean;
  width?: string;
};

type Props<T> = {
  columns: DsColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Mô tả bảng cho trình đọc màn hình. */
  caption: string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  selectedKey?: string | null;
  onRowClick?: (row: T) => void;
};

// Bảng dữ liệu dùng chung: tiêu đề dính, hàng bấm được (có bàn phím), trạng thái tải và rỗng.
export function DsDataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  emptyTitle = "Chưa có dữ liệu",
  emptyDescription,
  selectedKey,
  onRowClick,
}: Props<T>) {
  if (!loading && rows.length === 0) {
    return <DsEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(column.align === "num" && "is-num")}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <tr key={index} aria-hidden="true">
                  {columns.map((column) => (
                    <td key={column.key}>
                      <span className="ds-skel" style={{ width: `${55 + ((index + column.key.length) % 4) * 10}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => {
                const key = rowKey(row);
                const clickable = Boolean(onRowClick);
                return (
                  <tr
                    key={key}
                    data-clickable={clickable || undefined}
                    aria-selected={selectedKey ? selectedKey === key : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => onRowClick?.(row) : undefined}
                    onKeyDown={
                      clickable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick?.(row);
                            }
                          }
                        : undefined
                    }
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={cn(column.align === "num" && "is-num", column.mono && "is-mono")}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
