import { useState, useEffect } from 'react';
import { settings as settingsApi } from '../api/client.js';

const ANTHROPIC_MODELS = [
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 (Most capable)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
  { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

function KeyInput({ label, id, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [form, setForm] = useState({
    ai_provider: 'anthropic',
    ai_model: 'claude-sonnet-4-6',
    anthropic_api_key: '',
    openai_api_key: '',
    openai_model: 'gpt-4o',
  });
  const [keyStatus, setKeyStatus] = useState({ anthropic_api_key: false, openai_api_key: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    settingsApi.getAll().then((data) => {
      setForm((prev) => ({
        ...prev,
        ai_provider: data.ai_provider?.value || 'anthropic',
        ai_model: data.ai_model?.value || 'claude-sonnet-4-6',
        openai_model: data.openai_model?.value || 'gpt-4o',
      }));
      setKeyStatus({
        anthropic_api_key: data.anthropic_api_key?.is_set || false,
        openai_api_key: data.openai_api_key?.is_set || false,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ai_provider: form.ai_provider,
        ai_model: form.ai_model,
        openai_model: form.openai_model,
      };
      if (form.anthropic_api_key) payload.anthropic_api_key = form.anthropic_api_key;
      if (form.openai_api_key) payload.openai_api_key = form.openai_api_key;

      await settingsApi.save(payload);
      setToast({ type: 'success', msg: 'Settings saved.' });
      setForm((prev) => ({ ...prev, anthropic_api_key: '', openai_api_key: '' }));
      if (form.anthropic_api_key) setKeyStatus((s) => ({ ...s, anthropic_api_key: true }));
      if (form.openai_api_key) setKeyStatus((s) => ({ ...s, openai_api_key: true }));
    } catch {
      setToast({ type: 'error', msg: 'Failed to save settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  const models = form.ai_provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS;
  const modelKey = form.ai_provider === 'openai' ? 'openai_model' : 'ai_model';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 text-gray-400">Loading…</div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Configure AI provider, model, and API keys.</p>

      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">

        {/* AI Provider */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-gray-800">AI Provider</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
            <div className="flex gap-3">
              {[
                { value: 'anthropic', label: 'Anthropic', badge: 'Active' },
                { value: 'openai', label: 'OpenAI', badge: 'Beta' },
              ].map(({ value, label, badge }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('ai_provider', value)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors text-left ${
                    form.ai_provider === value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="font-semibold">{label}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                    form.ai_provider === value ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <select
              value={form[modelKey]}
              onChange={(e) => set(modelKey, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </section>

        {/* API Keys */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between">
            <h2 className="font-semibold text-gray-800">API Keys</h2>
            <span className="text-xs text-gray-400">Keys are stored encrypted in the database</span>
          </div>

          <KeyInput
            label={
              <span>
                Anthropic API Key
                {keyStatus.anthropic_api_key && (
                  <span className="ml-2 text-xs text-green-600 font-normal">set</span>
                )}
              </span>
            }
            id="anthropic_key"
            value={form.anthropic_api_key}
            onChange={(v) => set('anthropic_api_key', v)}
            placeholder={keyStatus.anthropic_api_key ? 'Leave blank to keep existing key' : 'sk-ant-…'}
          />

          <KeyInput
            label={
              <span>
                OpenAI API Key
                {keyStatus.openai_api_key && (
                  <span className="ml-2 text-xs text-green-600 font-normal">set</span>
                )}
              </span>
            }
            id="openai_key"
            value={form.openai_api_key}
            onChange={(v) => set('openai_api_key', v)}
            placeholder={keyStatus.openai_api_key ? 'Leave blank to keep existing key' : 'sk-…'}
          />

          <p className="text-xs text-gray-400">
            If a key is set here it overrides the environment variable. Leave blank to use the value from <code>.env</code>.
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
