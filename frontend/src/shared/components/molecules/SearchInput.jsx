import { Search, X } from 'lucide-react';
import { Button } from '../atoms/Button.jsx';
import { Input } from '../atoms/Input.jsx';

export function SearchInput({ value, onChange, onClear, placeholder = 'Tìm kiếm...' }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        aria-label="Tìm kiếm"
        className="pl-9 pr-10"
        onChange={onChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {value ? (
        <Button
          aria-label="Xóa nội dung tìm kiếm"
          className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
          onClick={onClear}
          size="icon"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
