import { useState, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, CheckCircle, XCircle, TrendingDown } from 'lucide-react';
import StatementUploader from '../components/StatementUploader.jsx';
import { statements as statementsApi } from '../api/client.js';
import { formatCents } from '../utils/formatCurrency.js';

const PRIORITY_STYLE = {
  high: 'border-red-200 bg-red-50',
  medium: 'border-yellow-200 bg-yellow-50',
  low: 'border-gray-200 bg-gray-50',
};

const RULE_LABELS = {
  'RULE-01': 'Duplicate Subscription',
  'RULE-02': 'Unused Subscription',
  'RULE-03': 'Overlapping Services',
  'RULE-04': 'High-Frequency Discretionary',
  'RULE-05': 'Over Budget',
  'RULE-06': 'FX Transaction Fees',
  'RULE-07': 'Untracked Recurring',
};

function FindingCard({ finding, onAction }) {
  const [loading, setLoading] = useState(false);

  const handle = async (action) => {
    const reason = action === 'dismiss' ? prompt('Reason (optional):') ?? undefined : undefined;
    setLoading(true);
    try {
      await onAction(finding.id, action, reason);
    } finally {
      setLoading(false);
    }
  };

  if (finding.status !== 'open') return null;

  return (
    <div className={`border rounded-lg p-4 ${PRIORITY_STYLE[finding.priority]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase text-gray-500">{RULE_LABELS[finding.rule_id] || finding.rule_id}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              finding.priority === 'high' ? 'bg-red-200 text-red-800' :
              finding.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-700'
            }`}>{finding.priority}</span>
          </div>
          <p className="text-sm font-medium text-gray-900">{finding.merchant}</p>
          {finding.estimated_monthly_savings_cents > 0 && (
            <p className="text-xs text-green-700 mt-1">
              Estimated savings: {formatCents(finding.estimated_monthly_savings_cents)}/mo
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => handle('accept')}
            disabled={loading}
            title="Accept – create task"
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle size={13} />
            Accept
          </button>
          <button
            onClick={() => handle('dismiss')}
            disabled={loading}
            title="Dismiss"
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <XCircle size={13} />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function StatementDetail({ id }) {
  const [report, setReport] = useState(null);
  const [findings, setFindings] = useState([]);
  const [txns, setTxns] = useState([]);
  const [tab, setTab] = useState('findings');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, f, t] = await Promise.all([
        statementsApi.report(id).catch(() => null),
        statementsApi.findings(id),
        statementsApi.transactions(id),
      ]);
      setReport(r);
      setFindings(f);
      setTxns(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleFindingAction = async (findingId, action, reason) => {
    await statementsApi.updateFinding(findingId, action, reason);
    load();
  };

  if (loading) return <p className="text-sm text-gray-400 py-4 text-center">Loading analysis…</p>;

  const openFindings = findings.filter((f) => f.status === 'open');
  const totalSavings = openFindings.reduce((s, f) => s + (f.estimated_monthly_savings_cents || 0), 0);

  return (
    <div className="mt-4">
      {report?.executive_summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-800">
          {report.executive_summary}
        </div>
      )}

      {totalSavings > 0 && (
        <div className="flex items-center gap-2 text-sm text-green-700 font-medium mb-4">
          <TrendingDown size={16} />
          Potential monthly savings: {formatCents(totalSavings)}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['findings', 'transactions'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t === 'findings' ? `Findings (${openFindings.length})` : `Transactions (${txns.length})`}
          </button>
        ))}
      </div>

      {tab === 'findings' && (
        <div className="space-y-3">
          {openFindings.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">No open findings.</p>
            : openFindings.map((f) => <FindingCard key={f.id} finding={f} onAction={handleFindingAction} />)
          }
        </div>
      )}

      {tab === 'transactions' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Date</th>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Merchant</th>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Category</th>
                <th className="text-right px-4 py-2 text-gray-500 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {txns.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{t.date}</td>
                  <td className="px-4 py-2 text-gray-900 font-medium">{t.merchant}</td>
                  <td className="px-4 py-2">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span>
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${t.amount_cents < 0 ? 'text-gray-900' : 'text-green-600'}`}>
                    {formatCents(Math.abs(t.amount_cents))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Statements() {
  const [statementList, setStatementList] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await statementsApi.list();
      setStatementList(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Statement Analysis</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Upload Statement</h2>
        <StatementUploader onUploaded={() => setTimeout(load, 2000)} />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : statementList.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No statements uploaded yet.</p>
      ) : (
        <div className="space-y-3">
          {statementList.map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-gray-400" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{s.original_name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.uploaded_at).toLocaleDateString()} ·{' '}
                      <span className={s.status === 'complete' ? 'text-green-600' : s.status === 'error' ? 'text-red-500' : 'text-yellow-600'}>
                        {s.status}
                      </span>
                      {s.total_amount_cents ? ` · ${formatCents(s.total_amount_cents)} total` : ''}
                    </p>
                  </div>
                </div>
                {expanded === s.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {expanded === s.id && s.status === 'complete' && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <StatementDetail id={s.id} />
                </div>
              )}
              {expanded === s.id && s.status === 'error' && (
                <div className="px-5 pb-4 border-t border-gray-100">
                  <p className="text-sm text-red-500 mt-3">{s.error_message}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
