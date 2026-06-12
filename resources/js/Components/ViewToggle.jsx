import { LayoutGrid, TableProperties } from 'lucide-react';

export default function ViewToggle({ view, onChange }) {
    return (
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
            <button
                type="button"
                onClick={() => onChange('card')}
                title="Card view"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                    view === 'card'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <LayoutGrid size={13} />
                Cards
            </button>
            <button
                type="button"
                onClick={() => onChange('table')}
                title="Table view"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                    view === 'table'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <TableProperties size={13} />
                Table
            </button>
        </div>
    );
}
