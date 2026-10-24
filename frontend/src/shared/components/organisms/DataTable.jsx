import { DataState } from './DataState.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../atoms/Table.jsx';
import { Pagination } from '../molecules/Pagination.jsx';

export function DataTable({
  columns,
  rows,
  rowKey = 'id',
  loading = false,
  error,
  onRetry,
  empty = {},
  page,
  totalPages,
  onPageChange
}) {
  const query = {
    data: rows,
    error,
    refetch: onRetry,
    status: loading ? 'loading' : error ? 'error' : 'success'
  };

  return (
    <DataState query={query} isEmpty={(data) => !data?.length} empty={empty}>
      {(data) => (
        <div className="grid gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => <TableHead key={column.key}>{column.header}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, rowIndex) => (
                <TableRow key={row[rowKey] ?? rowIndex}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.cell ? column.cell(row) : row[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {page !== undefined && totalPages !== undefined && onPageChange ? (
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
          ) : null}
        </div>
      )}
    </DataState>
  );
}
