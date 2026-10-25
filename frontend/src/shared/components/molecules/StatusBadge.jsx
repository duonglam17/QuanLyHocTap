import { Badge } from '../atoms/Badge.jsx';
import { statusLabels } from './statusLabels.js';

export function StatusBadge({ type, value, className }) {
  const [label, variant] = statusLabels[type]?.[value] ?? [value ?? 'Không rõ', 'outline'];
  return (
    <Badge className={className} variant={variant}>
      {label}
    </Badge>
  );
}
