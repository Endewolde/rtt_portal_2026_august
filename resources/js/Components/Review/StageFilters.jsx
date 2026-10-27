import { Search, EyeOff } from 'lucide-react';
import { Select } from '../Insights/Kit';
import ClearButton from '../Finance/ClearButton';
import { term } from '../../lib/terms';
import { programmeLabel } from '../../lib/programmes';

/**
 * The filter card on the review-stage pages (blind review, open defence, central
 * evaluation): search, college, programme and year, with a reset and a note when
 * the year filter is hiding proposals from other years.
 */
export default function StageFilters({
    search, onSearch, colleges = [], college, onCollege, programmes = [], programme, onProgramme,
    years = [], year, onYear, onClear, hiddenByYear = 0, children,
}) {
    const filtersOn = !!(search || college || programme);

    return (
        <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
            <div className="flex flex-col gap-2 lg:flex-row">
                <label className="relative min-w-0 flex-1">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search tracker number, title or PI…"
                        className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                </label>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                    {colleges.length > 1 && (
                        <Select label={term('college')} value={college} onChange={onCollege} className="sm:w-44">
                            <option value="">All {term('college', { plural: true, lower: true })}</option>
                            {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    )}
                    {programmes.length > 1 && (
                        <Select label="Programme" value={programme} onChange={onProgramme} className="sm:w-44">
                            <option value="">All programmes</option>
                            {programmes.map((k) => <option key={k} value={k}>{programmeLabel(k)}</option>)}
                        </Select>
                    )}
                    {years.length > 0 && onYear && (
                        <Select label="Year" value={year} onChange={onYear} className="sm:w-36">
                            <option value="">All years</option>
                            {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </Select>
                    )}
                    {children}
                    {filtersOn && <ClearButton onClick={onClear} />}
                </div>
            </div>
            {hiddenByYear > 0 && (
                <p className="flex flex-wrap items-center gap-1.5 px-1 text-xs text-gray-500">
                    <EyeOff size={12} /> {hiddenByYear} proposal{hiddenByYear === 1 ? ' is' : 's are'} from another year and hidden.
                    <button onClick={() => onYear('')} className="font-semibold text-indigo-600 hover:underline">Show all years</button>
                </p>
            )}
        </div>
    );
}
