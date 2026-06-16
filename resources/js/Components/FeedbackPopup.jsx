import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MessageSquareHeart, X, Star, Lightbulb, Bug, ClipboardList } from 'lucide-react';
import api from '../lib/api';
import { useToast } from './Toast';

const TYPES = [
    { value: 'feedback', label: 'General Feedback', icon: MessageSquareHeart },
    { value: 'feature_request', label: 'Feature Request', icon: Lightbulb },
    { value: 'bug_report', label: 'Bug Report', icon: Bug },
    { value: 'survey', label: 'Survey Response', icon: ClipboardList },
];

export default function FeedbackPopup({ open, onClose, onSubmitted }) {
    const toast = useToast();
    const [type, setType] = useState('feedback');
    const [rating, setRating] = useState(0);
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async () => {
        if (!message.trim()) {
            setError('Please enter a message before submitting.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await api.post('/feedback', {
                type,
                rating: rating || null,
                message: message.trim(),
                page_url: window.location.pathname,
            });
            toast.success('Thanks for sharing your thoughts!', { title: 'Feedback Submitted' });
            onSubmitted?.();
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Failed to submit feedback. Please try again.';
            setError(msg);
            toast.error(msg, { title: 'Submission Failed' });
        }
        setSubmitting(false);
    };

    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl focus:outline-none">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>

                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                        <MessageSquareHeart size={26} className="text-blue-500" />
                    </div>

                    <Dialog.Title className="text-base font-bold text-gray-900">
                        We&rsquo;d love your feedback
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-600 mt-2 leading-relaxed">
                        Tell us what&rsquo;s working, what&rsquo;s not, or what you&rsquo;d like to see next. It only takes a minute.
                    </Dialog.Description>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        {TYPES.map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setType(value)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                    type === value
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <Icon size={14} /> {label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 mb-1.5">How satisfied are you overall? (optional)</p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} type="button" onClick={() => setRating(rating === n ? 0 : n)}>
                                    <Star
                                        size={22}
                                        className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Share your thoughts…"
                            rows={4}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

                    <div className="mt-6 flex justify-end gap-2">
                        <button onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                            Maybe Later
                        </button>
                        <button onClick={handleSubmit} disabled={submitting}
                            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {submitting ? 'Submitting…' : 'Submit Feedback'}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
