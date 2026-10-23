import { useState, useEffect } from 'react';
import { translate as tr } from '../lib/i18n'
import { ClipboardList, X } from 'lucide-react';
import api from '../lib/api';
import { useToast } from './Toast';

const GENDER_OPTIONS = [
    { value: 'male',   label: 'Male',   emoji: '👨' },
    { value: 'female', label: 'Female', emoji: '👩' },
    { value: 'other',  label: 'Other',  emoji: '🧑' },
];

export default function ProfileCompleteModal({ user, onSaved }) {
    const { error } = useToast();
    const [saving, setSaving] = useState(false);

    const needsGender    = !user?.gender;
    const needsCollege   = !user?.college_id;
    const needsExpertise = !(user?.expertise?.length > 0);

    const [gender, setGender]             = useState(user?.gender ?? '');
    const [collegeId, setCollegeId]       = useState(user?.college_id ?? '');
    const [departmentId, setDepartmentId] = useState(user?.department_id ?? '');
    const [expertiseTags, setExpertiseTags] = useState(user?.expertise ?? []);
    const [expertiseInput, setExpertiseInput] = useState('');

    const [colleges, setColleges]       = useState([]);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        if (needsCollege) {
            api.get('/colleges/public')
                .then(r => setColleges(r.data?.data ?? r.data ?? []))
                .catch(() => {});
        }
    }, [needsCollege]);

    useEffect(() => {
        setDepartmentId('');
        setDepartments([]);
        if (collegeId) {
            api.get(`/colleges/${collegeId}/departments/public`)
                .then(r => setDepartments(r.data?.data ?? r.data ?? []))
                .catch(() => {});
        }
    }, [collegeId]);

    const addTag = (val) => {
        const trimmed = val.trim();
        if (!trimmed || expertiseTags.includes(trimmed)) { setExpertiseInput(''); return; }
        setExpertiseTags(prev => [...prev, trimmed]);
        setExpertiseInput('');
    };

    const removeTag = (idx) => setExpertiseTags(prev => prev.filter((_, i) => i !== idx));

    const canSave = (!needsGender || !!gender)
        && (!needsCollege || !!collegeId)
        && (!needsExpertise || expertiseTags.length > 0);

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const payload = {};
            if (needsGender)    { payload.gender = gender; }
            if (needsCollege)   { payload.college_id = collegeId; if (departmentId) { payload.department_id = departmentId; } }
            if (needsExpertise) { payload.expertise = expertiseTags; }
            await api.put('/auth/profile', payload);
            onSaved(payload);
        } catch {
            error('Could not save. Please try again.');
        }
        setSaving(false);
    };

    const isGenderOnly = needsGender && !needsCollege && !needsExpertise;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center"
             style={{ backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-7 pt-7 pb-5 shrink-0"
                     style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)' }}>
                    <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4"
                         style={{ background: 'rgba(255,255,255,0.2)' }}>
                        <ClipboardList size={24} className="text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-white">{tr("Complete your profile")}</h2>
                    <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {isGenderOnly
                            ? 'Please select your gender to complete your profile.'
                            : 'A few required details are missing. Please fill them in to continue.'}
                    </p>
                </div>

                {/* Body */}
                <div className="px-7 py-6 space-y-6 overflow-y-auto">

                    {/* Gender */}
                    {needsGender && (
                        <div>
                            <p className="text-xs font-semibold text-gray-600 mb-2.5 uppercase tracking-wide">{tr("Gender *")}</p>
                            <div className="space-y-2">
                                {GENDER_OPTIONS.map(({ value, label, emoji }) => (
                                    <button
                                        key={value}
                                        onClick={() => setGender(value)}
                                        className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all"
                                        style={{
                                            border: gender === value ? '2px solid #6366f1' : '2px solid #e2e8f0',
                                            background: gender === value ? '#eef2ff' : '#fafafa',
                                        }}
                                    >
                                        <span className="text-xl leading-none">{emoji}</span>
                                        <span className={`text-sm font-semibold ${gender === value ? 'text-indigo-700' : 'text-gray-700'}`}>{label}</span>
                                        {gender === value && (
                                            <span className="ml-auto h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* College */}
                    {needsCollege && (
                        <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{tr("College / Faculty *")}</p>
                            <select
                                value={collegeId}
                                onChange={e => setCollegeId(e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-400"
                            >
                                <option value="">{tr("Select your college…")}</option>
                                {colleges.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Department */}
                    {needsCollege && collegeId && departments.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{tr("Department")}</p>
                            <select
                                value={departmentId}
                                onChange={e => setDepartmentId(e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-400"
                            >
                                <option value="">{tr("Select your department (optional)…")}</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Expertise */}
                    {needsExpertise && (
                        <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{tr("Research Expertise *")}</p>
                            {expertiseTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2.5">
                                    {expertiseTags.map((tag, i) => (
                                        <span key={i}
                                            className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-200">
                                            {tag}
                                            <button onClick={() => removeTag(i)}
                                                className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors">
                                                <X size={11} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={expertiseInput}
                                    onChange={e => setExpertiseInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault();
                                            addTag(expertiseInput);
                                        }
                                    }}
                                    onBlur={() => addTag(expertiseInput)}
                                    placeholder={tr("e.g. Machine Learning, Hydrology…")}
                                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-400"
                                />
                                <button
                                    onClick={() => addTag(expertiseInput)}
                                    type="button"
                                    className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                                    {tr("Add")}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5">{tr("Press Enter or comma to add. At least one area required.")}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-7 pb-7 pt-2 shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)' }}
                    >
                        {saving ? 'Saving…' : 'Save & Continue'}
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-3">
                        {tr("You can update these anytime in your profile settings.")}
                    </p>
                </div>
            </div>
        </div>
    );
}
