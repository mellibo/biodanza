// Paginación simple (equivalente al comportamiento de ng-table: count=15
// por página). Los resultados ya vienen rankeados/ordenados por el buscador,
// así que no hace falta ordenamiento por columna -- por eso no se trajo
// TanStack Table para esto, sería complejidad sin uso real acá.
interface PaginationProps {
  page: number
  count: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, count, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  if (totalPages <= 1) return null
  return (
    <div className="row" style={{ margin: '8px 0' }}>
      <ul className="pagination" style={{ margin: 0 }}>
        <li className={page <= 1 ? 'disabled' : ''}>
          <a onClick={() => page > 1 && onPageChange(page - 1)}>&laquo;</a>
        </li>
        <li className="disabled">
          <a>
            Página {page} de {totalPages} ({count} resultados)
          </a>
        </li>
        <li className={page >= totalPages ? 'disabled' : ''}>
          <a onClick={() => page < totalPages && onPageChange(page + 1)}>&raquo;</a>
        </li>
      </ul>
    </div>
  )
}
