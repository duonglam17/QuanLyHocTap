import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../atoms/Button.jsx';

export function Pagination({ page, totalPages, onPageChange, disabled = false }) {
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Phân trang">
      <Button
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(previousPage)}
        variant="outline"
      >
        <ChevronLeft className="mr-2 size-4" />
        Trước
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        Trang {page} / {totalPages}
      </span>
      <Button
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(nextPage)}
        variant="outline"
      >
        Sau
        <ChevronRight className="ml-2 size-4" />
      </Button>
    </nav>
  );
}
