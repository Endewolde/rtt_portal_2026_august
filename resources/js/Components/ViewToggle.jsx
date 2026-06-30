import { LayoutGrid, TableProperties, Columns3 } from 'lucide-react';

const VIEWS = [
    { key: 'table',  icon: TableProperties, label: 'Table'  },
    { key: 'card',   icon: LayoutGrid,      label: 'Cards'  },
    { key: 'kanban', icon: Columns3,        label: 'Kanban' },
];

export default function ViewToggle({ view, onChange, views }) {
    const allowed = views ?? VIEWS.map(v => v.key);
    const options = VIEWS.filter(v => allowed.includes(v.key));

    return (
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
            {options.map(({ key, icon: Icon, label }) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    title={`${label} view`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                        view === key
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Icon size={13} />
                    {label}
                </button>
            ))}
        </div>
    );
}
