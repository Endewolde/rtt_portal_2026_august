import { getStatusColor, getStatusLabel } from '../lib/utils';

export default function StatusBadge({ status, size = 'sm' }) {
    const sizeClass = size === 'lg' ? 'px-3 py-1 text-sm font-semibold' : 'px-2 py-0.5 text-xs font-medium';
    return (
        <span className={`inline-flex items-center rounded-full ${sizeClass} ${getStatusColor(status)}`}>
            {getStatusLabel(status)}
        </span>
    );
}
