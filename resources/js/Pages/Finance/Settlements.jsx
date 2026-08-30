import { useState, useEffect, useRef, useCallback } from 'react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import { useConfirm } from '../../hooks/useConfirm'
import ViewToggle from '../../Components/ViewToggle'
import { useViewPreference } from '../../hooks/useViewPreference'
import { downloadFile } from '../../lib/download'
import { CheckCircle, FileText, Upload, X, ChevronRight, Shield } from 'lucide-react'
import api from '../../lib/api'

const STATUS_CONFIG = {
    submitted:        { label: 'Submitted',        color: 'bg-blue-100 text-blue-700',   icon: '📤', step: 1 },
    college_verified: { label: 'College Verified', color: 'bg-purple-100 text-purple-700', icon: '🏛', step: 2 },
    finance_verified: { label: 'Finance Verified', color: 'bg-green-100 text-green-700', icon: '✅', step: 3 },
}

export default function Settlements() {
    const { success, error } = useToast()
    const { confirm, Dialog } = useConfirm()
    const [view, setView] = useViewPreference('settlements', 'card')
    const [activeTab, setActiveTab] = useState('pending')
    const [settlements, setSettlements] = useState([])
    const [pendingRequests, setPendingRequests] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showSubmitModal, setShowSubmitModal] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState(null)

    const user = (() => { try { return JSON.parse(localStorage.getItem('rtt_user') || '{}') } catch { return {} } })()
    const roles = (user.roles || []).map(r => typeof r === 'string' ? r : r.name)
    const isPI = roles.some(r => ['pi', 'staff'].includes(r))
    const isCollegeOfficer = roles.some(r => ['college_officer'].includes(r))
    const isFinance = roles.some(r => ['super_admin', 'admin', 'central_officer', 'finance_officer',
        'research_officer', 'community_officer', 'technology_officer'].includes(r))

    useEffect(() => {
        loadAll()
    }, [])

    const loadAll = async () => {
        setLoading(true)
        try {
            const promises = [
                api.get('/settlements'),
                api.get('/settlements/stats'),
            ]
            if (isPI || isCollegeOfficer) {
                promises.push(api.get('/settlements/pending'))
            } else {
                promises.push(Promise.resolve({ data: { data: [] } }))
            }

            const [settleRes, statsRes, pendingRes] = await Promise.all(promises)
            setSettlements(settleRes.data?.data || [])
            setStats(statsRes.data?.data || {})
            setPendingRequests(pendingRes.data?.data || [])

            if ((isPI || isCollegeOfficer) && (pendingRes.data?.data || []).length > 0) {
                setActiveTab('pending')
            } else if (isFinance) {
                setActiveTab('pending_finance')
            } else {
                setActiveTab('all')
            }
        } catch {
            error('Failed to load settlements.')
        }
        setLoading(false)
    }

    const pendingCollegeVerification = settlements.filter(s => s.status === 'submitted')
    const pendingFinanceVerification = settlements.filter(s => s.status === 'college_verified')

    // Returns true when all finalized settlement totals meet or exceed the proposal's awarded budget
    const isBudgetExhausted = (settlement) => {
        const awarded = parseFloat(settlement.budget_request?.proposal?.award?.awarded_amount || 0)
        if (awarded <= 0) return false
        const proposalId = settlement.budget_request?.proposal?.id
        const totalSpent = settlements
            .filter(s => s.status === 'finance_verified' && s.budget_request?.proposal?.id === proposalId)
            .reduce((sum, s) => sum + parseFloat(s.total_spent || 0), 0)
        return totalSpent >= awarded
    }

    const TABS = [
        { key: 'pending',         label: '📋 Submit Settlement',  count: pendingRequests.length,            show: isPI || isCollegeOfficer },
        { key: 'pending_college', label: '🏛 Verify (College)',   count: pendingCollegeVerification.length, show: isCollegeOfficer || isFinance },
        { key: 'pending_finance', label: '✅ Finalize (Finance)',  count: pendingFinanceVerification.length, show: isFinance },
        { key: 'all',             label: '📊 All Settlements',    count: settlements.length,                show: true },
    ].filter(t => t.show)

    return (
        <AppLayout>
            <div className="p-6 max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Shield size={24} className="text-blue-600" />
                            Settlements
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Expense reporting and settlement management</p>
                    </div>
                    <ViewToggle view={view} onChange={setView} />
                </div>

                {/* Workflow diagram */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Settlement Process</p>
                    <div className="flex items-center gap-2 overflow-x-auto">
                        {[
                            { label: 'PI Submits',          desc: 'Expense report + amounts', icon: '📤' },
                            { label: 'College Verifies',    desc: 'College Officer reviews',  icon: '🏛' },
                            { label: 'Finance Finalizes',   desc: 'Finance closes the round', icon: '✅' },
                            { label: 'Next Round Unlocked', desc: 'PI can submit Round N+1',  icon: '🔓' },
                        ].map((s, i) => (
                            <div key={s.label} className="flex items-center gap-2 shrink-0">
                                <div className="text-center">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-300
                                                    flex items-center justify-center text-lg mx-auto mb-1">
                                        {s.icon}
                                    </div>
                                    <p className="text-xs font-semibold text-blue-700">{s.label}</p>
                                    <p className="text-xs text-gray-400">{s.desc}</p>
                                </div>
                                {i < 3 && <ChevronRight size={16} className="text-gray-300 shrink-0" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Settlements', value: stats.total || 0,            icon: '📊', color: 'text-blue-600'   },
                            { label: 'Awaiting College',  value: stats.submitted || 0,         icon: '🏛', color: 'text-yellow-600' },
                            { label: 'Awaiting Finance',  value: stats.college_verified || 0,  icon: '💼', color: 'text-purple-600' },
                            { label: 'Finalized',         value: stats.finance_verified || 0,  icon: '✅', color: 'text-green-600'  },
                        ].map(stat => (
                            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                                <div className="text-2xl mb-1">{stat.icon}</div>
                                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex flex-wrap gap-1 border-b border-gray-200">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium
                                        border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                    activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'pending' && (
                            <div className="space-y-4">
                                {pendingRequests.length === 0 ? (
                                    <EmptyState
                                        icon="🧾"
                                        title="No settlements pending"
                                        message="All disbursed funds have been settled or no funds have been disbursed yet."
                                    />
                                ) : (
                                    pendingRequests.map(request => (
                                        <PendingSettlementCard
                                            key={request.id}
                                            request={request}
                                            onSubmit={() => { setSelectedRequest(request); setShowSubmitModal(true) }}
                                        />
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'pending_college' && (
                            <div className="space-y-4">
                                {pendingCollegeVerification.length === 0 ? (
                                    <EmptyState
                                        icon="🏛"
                                        title="No settlements awaiting college verification"
                                        message="Settlements submitted by PIs will appear here."
                                    />
                                ) : (
                                    pendingCollegeVerification.map(settlement => (
                                        <SettlementCard
                                            key={settlement.id}
                                            settlement={settlement}
                                            onRefresh={loadAll}
                                            canVerifyCollege={isCollegeOfficer || isFinance}
                                            canVerifyFinance={false}
                                            budgetExhausted={isBudgetExhausted(settlement)}
                                        />
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'pending_finance' && (
                            <div className="space-y-4">
                                {pendingFinanceVerification.length === 0 ? (
                                    <EmptyState
                                        icon="💼"
                                        title="No settlements awaiting finance verification"
                                        message="College-verified settlements will appear here."
                                    />
                                ) : (
                                    pendingFinanceVerification.map(settlement => (
                                        <SettlementCard
                                            key={settlement.id}
                                            settlement={settlement}
                                            onRefresh={loadAll}
                                            canVerifyCollege={false}
                                            canVerifyFinance={isFinance}
                                            budgetExhausted={isBudgetExhausted(settlement)}
                                        />
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'all' && (
                            view === 'table' ? (
                                <SettlementsTable settlements={settlements} />
                            ) : (
                                <div className="space-y-3">
                                    {settlements.length === 0 ? (
                                        <EmptyState icon="📊" title="No settlements yet" message="" />
                                    ) : (
                                        settlements.map(settlement => (
                                            <SettlementCard
                                                key={settlement.id}
                                                settlement={settlement}
                                                onRefresh={loadAll}
                                                canVerifyCollege={isCollegeOfficer || isFinance}
                                                canVerifyFinance={isFinance}
                                                budgetExhausted={isBudgetExhausted(settlement)}
                                            />
                                        ))
                                    )}
                                </div>
                            )
                        )}
                    </>
                )}

                {showSubmitModal && selectedRequest && (
                    <SubmitSettlementModal
                        request={selectedRequest}
                        onClose={() => { setShowSubmitModal(false); setSelectedRequest(null) }}
                        onSuccess={() => { setShowSubmitModal(false); setSelectedRequest(null); loadAll() }}
                    />
                )}

                <Dialog />
            </div>
        </AppLayout>
    )
}

function EmptyState({ icon, title, message }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">{icon}</div>
            <h3 className="text-gray-600 font-medium mb-1">{title}</h3>
            {message && <p className="text-sm text-gray-400">{message}</p>}
        </div>
    )
}

function PendingSettlementCard({ request, onSubmit }) {
    const totalDisbursed = parseFloat(request.total_disbursed || 0)

    return (
        <div className="bg-blue-50/30 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50
                                         px-2 py-0.5 rounded border border-blue-200">
                            {request.proposal?.tracker_number}
                        </span>
                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                            Round {request.funding_round}
                        </span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            💳 Disbursed
                        </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{request.proposal?.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {request.proposal?.college?.name} · PI: {request.proposal?.pi?.name}
                    </p>
                    <div className="mt-2 flex gap-4 text-sm">
                        <div>
                            <span className="text-xs text-gray-500">Approved Budget</span>
                            <p className="font-bold text-gray-900">
                                ETB {parseFloat(request.total_amount || 0).toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500">Total Disbursed</span>
                            <p className="font-bold text-green-700">ETB {totalDisbursed.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                <div className="shrink-0">
                    <button
                        onClick={onSubmit}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white
                                   rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        <FileText size={14} />
                        Submit Settlement
                    </button>
                </div>
            </div>
        </div>
    )
}

function SettlementCard({ settlement, onRefresh, canVerifyCollege, canVerifyFinance, budgetExhausted = false }) {
    const { success, error } = useToast()
    const { confirm, Dialog } = useConfirm()
    const [verifying, setVerifying]   = useState(false)
    // 'college' | 'finance' | null — which inline notes form is open
    const [noteMode, setNoteMode]     = useState(null)
    const [noteText, setNoteText]     = useState('')
    // PDF viewer
    const [pdfUrl, setPdfUrl]         = useState(null)
    const [pdfLoading, setPdfLoading] = useState(false)
    const [pdfOpen, setPdfOpen]       = useState(false)

    const statusConf = STATUS_CONFIG[settlement.status] || STATUS_CONFIG.submitted

    // Revoke blob URL when card unmounts to avoid memory leaks
    useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

    const togglePdf = useCallback(async () => {
        if (pdfOpen) { setPdfOpen(false); return }
        if (pdfUrl)  { setPdfOpen(true);  return }
        setPdfLoading(true)
        try {
            const res = await api.get(`/settlements/${settlement.id}/download-report`, { responseType: 'blob' })
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
            setPdfUrl(url)
            setPdfOpen(true)
        } catch {
            error('Failed to load expense report.')
        }
        setPdfLoading(false)
    }, [pdfOpen, pdfUrl, settlement.id])

    const submitCollegeVerify = async () => {
        setVerifying(true)
        try {
            await api.post(`/settlements/${settlement.id}/verify`, { notes: noteText })
            success('Settlement verified by college.')
            setNoteMode(null); setNoteText('')
            onRefresh()
        } catch (e) {
            error(e.response?.data?.message || 'Failed to verify.')
        }
        setVerifying(false)
    }

    const submitFinanceFinalize = async () => {
        const ok = await confirm({
            title: 'Finalize Settlement?',
            description: 'This will close this funding round and allow the PI to submit the next round.',
            confirmLabel: 'Finalize',
        })
        if (!ok) return
        setVerifying(true)
        try {
            await api.post(`/settlements/${settlement.id}/finalize`, { notes: noteText })
            success('Settlement finalized. Next round is now available for the PI.')
            setNoteMode(null); setNoteText('')
            onRefresh()
        } catch (e) {
            error(e.response?.data?.message || 'Failed to finalize.')
        }
        setVerifying(false)
    }

    const proposal     = settlement.budget_request?.proposal
    const budgetRequest = settlement.budget_request

    return (
        <div className={`bg-white border rounded-xl p-5 transition-all hover:shadow-sm ${
            settlement.status === 'finance_verified' ? 'border-green-200' :
            settlement.status === 'college_verified' ? 'border-purple-200' :
            'border-gray-200'
        }`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50
                                         px-2 py-0.5 rounded border border-blue-200">
                            {proposal?.tracker_number}
                        </span>
                        <span className="text-xs text-gray-400">Round {budgetRequest?.funding_round}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConf.color}`}>
                            {statusConf.icon} {statusConf.label}
                        </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{proposal?.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {proposal?.college?.name} · PI: {proposal?.pi?.name}
                    </p>
                </div>
            </div>

            {/* Progress timeline */}
            <div className="flex items-center gap-2 mb-4">
                {[
                    { step: 1, label: 'Submitted',        done: true,                             actor: settlement.submitted_by?.name },
                    { step: 2, label: 'College Verified', done: !!settlement.college_verified_at, actor: settlement.college_verified_by_user?.name },
                    { step: 3, label: 'Finance Verified', done: !!settlement.finance_verified_at, actor: settlement.finance_verified_by_user?.name },
                ].map((s, i) => (
                    <div key={s.step} className="flex items-center gap-2 flex-1">
                        <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                s.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                            }`}>
                                {s.done ? '✓' : s.step}
                            </div>
                            <p className="text-xs text-center text-gray-500 mt-1 leading-tight">{s.label}</p>
                            {s.actor && <p className="text-xs text-center text-gray-400">{s.actor}</p>}
                        </div>
                        {i < 2 && (
                            <div className={`flex-1 h-0.5 mb-6 ${s.done ? 'bg-green-400' : 'bg-gray-200'}`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Approved</p>
                    <p className="text-sm font-bold text-gray-900">
                        ETB {parseFloat(budgetRequest?.total_amount || 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Total Spent</p>
                    <p className="text-sm font-bold text-blue-700">
                        ETB {parseFloat(settlement.total_spent || 0).toLocaleString()}
                    </p>
                </div>
                <div className={`rounded-lg p-3 text-center ${
                    parseFloat(settlement.unspent_amount || 0) > 0 ? 'bg-amber-50' : 'bg-green-50'
                }`}>
                    <p className="text-xs text-gray-500">Unspent</p>
                    <p className={`text-sm font-bold ${
                        parseFloat(settlement.unspent_amount || 0) > 0 ? 'text-amber-700' : 'text-green-700'
                    }`}>
                        ETB {parseFloat(settlement.unspent_amount || 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Saved notes */}
            {settlement.college_notes && (
                <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-xs font-semibold text-purple-700 mb-0.5">College Notes:</p>
                    <p className="text-xs text-purple-600">{settlement.college_notes}</p>
                </div>
            )}
            {settlement.finance_notes && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-semibold text-green-700 mb-0.5">Finance Notes:</p>
                    <p className="text-xs text-green-600">{settlement.finance_notes}</p>
                </div>
            )}

            {/* Expense report — view + download */}
            {settlement.expense_report_path && (
                <div className="mb-3">
                    <div className="flex items-center gap-3">
                        <FileText size={14} className="text-blue-500 shrink-0" />
                        <span className="text-xs text-gray-500">Expense Report</span>
                        <button
                            onClick={togglePdf}
                            disabled={pdfLoading}
                            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                        >
                            {pdfLoading ? 'Loading…' : pdfOpen ? 'Hide' : 'View'}
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                            onClick={() => downloadFile(
                                `/settlements/${settlement.id}/download-report`,
                                'expense-report.pdf'
                            ).catch(() => {})}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            Download
                        </button>
                    </div>

                    {pdfOpen && pdfUrl && (
                        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                            <iframe
                                src={pdfUrl}
                                title="Expense Report"
                                className="w-full h-96"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                    {(() => {
                        const midtermEvals = settlement.budget_request?.proposal?.midterm_evaluations ?? []
                        const midtermReported = midtermEvals.some(e =>
                            ['scored', 'completed'].includes(e.status)
                        )

                        return (
                            <>
                                {/* Step 1 — College Verify */}
                                {canVerifyCollege && settlement.status === 'submitted' && noteMode !== 'college' && (
                                    midtermReported ? (
                                        <button
                                            onClick={() => { setNoteMode('college'); setNoteText('') }}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm
                                                       font-medium hover:bg-purple-700"
                                        >
                                            🏛 Verify (College)
                                        </button>
                                    ) : (
                                        <div title="Mid-Term M&E meeting must be held and scored first"
                                            className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 border
                                                       border-amber-200 text-amber-700 rounded-lg text-sm font-medium
                                                       cursor-not-allowed select-none">
                                            🔒 College Verify — awaiting Mid-Term M&E scoring
                                        </div>
                                    )
                                )}

                                {/* Step 2 — Finance Finalize (active only after college verified) */}
                                {canVerifyFinance && settlement.status === 'college_verified' && noteMode !== 'finance' && (
                                    <button
                                        onClick={() => { setNoteMode('finance'); setNoteText('') }}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm
                                                   font-medium hover:bg-green-700"
                                    >
                                        ✅ Finalize (Finance)
                                    </button>
                                )}

                                {/* Finance step locked — waiting for college */}
                                {canVerifyFinance && settlement.status === 'submitted' && (
                                    <div title="College must verify before Finance can finalize"
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-400
                                                   rounded-lg text-sm font-medium cursor-not-allowed select-none">
                                        🔒 Finalize (Finance) — awaiting college verification
                                    </div>
                                )}
                            </>
                        )
                    })()}

                    {settlement.status === 'finance_verified' && (
                        budgetExhausted ? (
                            <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 border
                                            border-amber-300 text-amber-800 rounded-lg text-sm font-semibold">
                                🏁 Settlement Complete — No More Budget Request is needed
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-4 py-2 bg-green-50 border
                                            border-green-200 text-green-700 rounded-lg text-sm font-medium">
                                <CheckCircle size={14} />
                                Settlement Complete — Next Round Available
                            </div>
                        )
                    )}
                </div>

                {/* Inline notes form — college verify */}
                {noteMode === 'college' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                        <label className="block text-xs font-semibold text-purple-700">
                            Verification notes (optional)
                        </label>
                        <textarea
                            autoFocus
                            rows={3}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Add any notes about this verification…"
                            className="w-full text-sm border border-purple-300 rounded-lg px-3 py-2
                                       focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => { setNoteMode(null); setNoteText('') }}
                                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300
                                           rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitCollegeVerify}
                                disabled={verifying}
                                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg
                                           font-medium hover:bg-purple-700 disabled:opacity-50"
                            >
                                {verifying ? 'Verifying…' : 'Confirm Verify'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Inline notes form — finance finalize */}
                {noteMode === 'finance' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                        <label className="block text-xs font-semibold text-green-700">
                            Finance notes (optional)
                        </label>
                        <textarea
                            autoFocus
                            rows={3}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Add any notes about this finalization…"
                            className="w-full text-sm border border-green-300 rounded-lg px-3 py-2
                                       focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => { setNoteMode(null); setNoteText('') }}
                                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300
                                           rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitFinanceFinalize}
                                disabled={verifying}
                                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg
                                           font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                                {verifying ? 'Finalizing…' : 'Confirm Finalize'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <Dialog />
        </div>
    )
}

function SettlementsTable({ settlements }) {
    const fmtDate = (d) => d
        ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—'

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase w-10">#</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proposal</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Round</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Approved</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Spent</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unspent</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Submitted</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {settlements.map((s, i) => {
                            const statusConf = STATUS_CONFIG[s.status] || STATUS_CONFIG.submitted
                            return (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-xs font-medium text-gray-400 tabular-nums w-10">{i + 1}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-mono text-xs text-blue-600 font-bold">
                                            {s.budget_request?.proposal?.tracker_number}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate max-w-xs">
                                            {s.budget_request?.proposal?.title}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs font-bold text-gray-500">
                                        Round {s.budget_request?.funding_round}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                                        ETB {parseFloat(s.budget_request?.total_amount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-blue-700">
                                        ETB {parseFloat(s.total_spent || 0).toLocaleString()}
                                    </td>
                                    <td className={`px-4 py-3 text-right text-sm font-semibold ${
                                        parseFloat(s.unspent_amount || 0) > 0 ? 'text-amber-600' : 'text-green-600'
                                    }`}>
                                        ETB {parseFloat(s.unspent_amount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusConf.color}`}>
                                            {statusConf.icon} {statusConf.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                        {fmtDate(s.created_at)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile: stacked cards */}
            <div className="sm:hidden divide-y divide-gray-100">
                {settlements.map(s => {
                    const statusConf = STATUS_CONFIG[s.status] || STATUS_CONFIG.submitted
                    return (
                        <div key={s.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="font-mono text-xs text-blue-600 font-bold">
                                    {s.budget_request?.proposal?.tracker_number}
                                </p>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusConf.color}`}>
                                    {statusConf.icon} {statusConf.label}
                                </span>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{s.budget_request?.proposal?.title}</p>
                            <div className="grid grid-cols-3 gap-2 text-xs mb-1.5">
                                <div>
                                    <p className="text-gray-400">Approved</p>
                                    <p className="font-semibold text-gray-900">ETB {parseFloat(s.budget_request?.total_amount || 0).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400">Spent</p>
                                    <p className="font-semibold text-blue-700">ETB {parseFloat(s.total_spent || 0).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400">Unspent</p>
                                    <p className={`font-semibold ${parseFloat(s.unspent_amount || 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                        ETB {parseFloat(s.unspent_amount || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400">Round {s.budget_request?.funding_round} · Submitted {fmtDate(s.created_at)}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function SubmitSettlementModal({ request, onClose, onSuccess }) {
    const { success, error } = useToast()
    const [form, setForm] = useState({
        total_spent:    String(request.total_disbursed || request.total_amount || ''),
        unspent_amount: '0',
    })
    const [file, setFile] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const fileRef = useRef(null)

    const totalDisbursed = parseFloat(request.total_disbursed || request.total_amount || 0)

    useEffect(() => {
        const spent = parseFloat(form.total_spent) || 0
        const unspent = Math.max(0, totalDisbursed - spent)
        setForm(p => ({ ...p, unspent_amount: unspent.toFixed(2) }))
    }, [form.total_spent])

    const handleSubmit = async () => {
        if (!form.total_spent || parseFloat(form.total_spent) < 0) {
            error('Please enter total amount spent.')
            return
        }
        if (parseFloat(form.total_spent) > totalDisbursed) {
            error('Amount spent cannot exceed total disbursed.')
            return
        }

        setSubmitting(true)
        try {
            const res = await api.post('/settlements', {
                budget_request_id: request.id,
                total_spent:       parseFloat(form.total_spent),
                unspent_amount:    parseFloat(form.unspent_amount),
            })

            const settlementId = res.data?.data?.id

            if (file && settlementId) {
                const fd = new FormData()
                fd.append('file', file)
                await api.post(`/settlements/${settlementId}/upload-report`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
            }

            success('Settlement submitted successfully. Awaiting college verification.')
            onSuccess()
        } catch (e) {
            error(e.response?.data?.message || 'Failed to submit settlement.')
        }
        setSubmitting(false)
    }

    const totalApproved = parseFloat(request.total_amount || 0)

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

                {/* Header */}
                <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-t-2xl px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-white">Submit Settlement</h2>
                            <p className="text-blue-100 text-xs mt-1">
                                {request.proposal?.tracker_number} · Round {request.funding_round}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-white/70 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5">

                    {/* Budget reference */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500">Approved Budget</p>
                                <p className="text-lg font-bold text-gray-900">
                                    ETB {totalApproved.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total Disbursed</p>
                                <p className="text-lg font-bold text-green-700">
                                    ETB {totalDisbursed.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Total spent */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Total Amount Spent (ETB) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            max={totalDisbursed}
                            step="0.01"
                            value={form.total_spent}
                            onChange={e => setForm(p => ({ ...p, total_spent: e.target.value }))}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg
                                       font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                        />
                    </div>

                    {/* Unspent (auto-calculated) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unspent Amount (auto-calculated)
                        </label>
                        <div className={`w-full border rounded-xl px-4 py-3 text-lg font-bold ${
                            parseFloat(form.unspent_amount) > 0
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-green-300 bg-green-50 text-green-700'
                        }`}>
                            ETB {parseFloat(form.unspent_amount || 0).toLocaleString()}
                        </div>
                        {parseFloat(form.unspent_amount) > 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                                ⚠️ Unspent funds must be returned to the university.
                            </p>
                        )}
                    </div>

                    {/* Expense report upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expense Report (PDF) — Recommended
                        </label>
                        <div
                            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer
                                        transition-colors ${
                                file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                            }`}
                            onClick={() => fileRef.current?.click()}
                        >
                            {file ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileText size={16} className="text-green-500" />
                                    <span className="text-sm text-green-700 font-medium">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setFile(null) }}
                                        className="text-red-400 hover:text-red-600"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <Upload size={20} className="mx-auto text-gray-400 mb-1" />
                                    <p className="text-sm text-gray-500">Click to upload expense report (PDF)</p>
                                    <p className="text-xs text-gray-400">Max 10MB</p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={e => setFile(e.target.files[0] || null)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 pb-6">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm
                                   text-gray-700 hover:bg-gray-50 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm
                                   font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? 'Submitting...' : 'Submit Settlement'}
                    </button>
                </div>
            </div>
        </div>
    )
}
