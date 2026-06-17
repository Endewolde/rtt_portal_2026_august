import { useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import api from '../lib/api';
import { useToast } from './Toast';

const OPTIONS = [
    { value: 'male',   label: 'Male',   emoji: '👨' },
    { value: 'female', label: 'Female', emoji: '👩' },
    { value: 'other',  label: 'Other',  emoji: '🧑' },
];

export default function GenderPromptModal({ onSaved }) {
    const toast = useToast();
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await api.put('/auth/profile', { gender: selected });
            onSaved(selected);
        } catch {
            toast.error('Could not save. Please try again.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

                {/* Header */}
                <div className="px-7 pt-7 pb-5" style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)' }}>
                    <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        <UserCircle2 size={24} className="text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-white">One quick thing</h2>
                    <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        Please select your gender to complete your profile.
                    </p>
                </div>

                {/* Options */}
                <div className="px-7 py-6 space-y-2.5">
                    {OPTIONS.map(({ value, label, emoji }) => (
                        <button
                            key={value}
                            onClick={() => setSelected(value)}
                            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all"
                            style={{
                                border: selected === value ? '2px solid #6366f1' : '2px solid #e2e8f0',
                                background: selected === value ? '#eef2ff' : '#fafafa',
                            }}
                        >
                            <span className="text-2xl leading-none">{emoji}</span>
                            <span className={`text-sm font-semibold ${selected === value ? 'text-indigo-700' : 'text-gray-700'}`}>
                                {label}
                            </span>
                            {selected === value && (
                                <span className="ml-auto h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-7 pb-7">
                    <button
                        onClick={handleSave}
                        disabled={!selected || saving}
                        className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)' }}
                    >
                        {saving ? 'Saving…' : 'Continue'}
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-3">
                        You can update this anytime in your profile settings.
                    </p>
                </div>
            </div>
        </div>
    );
}
