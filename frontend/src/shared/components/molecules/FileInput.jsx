import { useState } from 'react';
import { formatFileSize } from '../../lib/formatters.js';
import { Input } from '../atoms/Input.jsx';

function matchesAllowedType(file, accept) {
  if (!accept) return true;
  const allowed = accept
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const fileName = file.name.toLowerCase();
  return allowed.some((type) => {
    if (type.startsWith('.')) return fileName.endsWith(type);
    if (type.endsWith('/*')) return file.type.startsWith(type.slice(0, -1));
    return file.type === type;
  });
}

export function FileInput({
  accept,
  maxSize = 20 * 1024 * 1024,
  onFileChange,
  onChange: externalOnChange,
  progress,
  disabled,
  ...props
}) {
  const [error, setError] = useState('');

  function handleChange(event) {
    externalOnChange?.(event);
    const file = event.target.files?.[0] ?? null;
    setError('');
    if (!file) {
      onFileChange?.(null);
      return;
    }
    if (!matchesAllowedType(file, accept)) {
      setError('Định dạng tệp không được hỗ trợ.');
      event.target.value = '';
      onFileChange?.(null);
      return;
    }
    if (file.size > maxSize) {
      setError(`Tệp vượt quá dung lượng tối đa ${formatFileSize(maxSize)}.`);
      event.target.value = '';
      onFileChange?.(null);
      return;
    }
    onFileChange?.(file);
  }

  return (
    <div className="grid gap-2">
      <Input
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        type="file"
        {...props}
      />
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {progress !== undefined ? (
        <div className="grid gap-1">
          <progress
            aria-label="Tiến trình tải tệp"
            className="h-2 w-full overflow-hidden rounded-full accent-primary"
            max="100"
            value={Math.max(0, Math.min(100, progress))}
          />
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
      ) : null}
    </div>
  );
}
