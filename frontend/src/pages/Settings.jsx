import { useState, useEffect } from 'react';
import { settings as settingsApi } from '../api/client.js';

const PROVIDERS = [
  { value: 'anthropic',   label: 'Anthropic',   hint: 'claude-sonnet-4-6',       keyField: 'anthropic_api_key',   keyPlaceholder: 'sk-ant-…' },
  { value: 'openai',      label: 'OpenAI',       hint: 'gpt-4o',                  keyField: 'openai_api_key',      keyPlaceholder: 'sk-…' },
  { value: 'openrouter',  label: 'OpenRouter',   hint: 'openai/gpt-4o',           keyField: 'openrouter_api_key',  keyPlaceholder: 'sk-or-…' },
  { value: 'gemini',      label: 'Gemini',       hint: 'gemini-2.0-flash',        keyField: 'gemini_api_key',      keyPlaceholder: 'AIza…' },
  { value: 'ollama',      label: 'Ollama',       hint: 'llama3.2',                keyField: null,                  keyPlaceholder: null },
];

const ALL_KEY_FIELDS = ['anthropic_api_key', 'openai_api_key', 'openrouter_api_key', 'gemini_api_key'];

function KeyInput({ label, id, value, onChange, placeholder, isSet }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {isSet && <span className="ml-2 text-xs font-normal text-green-600">set</span>}
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

const EMPTY_FORM = {
  ai_provider: 'anthropic',
  ai_model: '',
  ollama_base_url: 'http://localhost:11434',
  anthropic_api_key: '',
  openai_api_key: '',
  openrouter_api_key: '',
  gemini_api_key: '',
};

export default function Settings() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [keyStatus, setKeyStatus] = useState(
    Object.fromEntries(ALL_KEY_FIELDS.map((k) => [k, false]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    settingsApi.getAll().then((data) => {
      setForm((prev) => ({
        ...prev,
        ai_provider:    data.ai_provider?.value    || 'anthropic',
        ai_model:       data.ai_model?.value        || '',
        ollama_base_url: data.ollama_base_url?.value || 'http://localhost:11434',
      }));
      const status = {};
      for (const k of ALL_KEY_FIELDS) {
        status[k] = data[k]?.is_set || false;
      }
      setKeyStatus(status);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ai_provider:     form.ai_provider,
        ai_model:        form.ai_model,
        ollama_base_url: form.ollama_base_url,
      };
      for (const k of ALL_KEY_FIELDS) {
        if (form[k]) payload[k] = form[k];
      }
      await settingsApi.save(payload);

      const newKeyStatus = { ...keyStatus };
      for (const k of ALL_KEY_FIELDS) {
        if (form[k]) newKeyStatus[k] = true;
      }
      setKeyStatus(newKeyStatus);
      setForm((prev) => ({
        ...prev,
        ...Object.fromEntries(ALL_KEY_FIELDS.map((k) => [k, ''])),
      }));
      setToast({ type: 'success', msg: 'Settings saved.' });
    } catch {
      setToast({ type: 'error', msg: 'Failed to save settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  const activeProvider = PROVIDERS.find((p) => p.value === form.ai_provider) || PROVIDERS[0];

  if (loading) {
    return <div className="flex justify-center items-center h-48 text-gray-400">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Configure AI provider, model, and API keys.</p>

      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">

        {/* Provider */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-gray-800">AI Provider</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PROVIDERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField('ai_provider', value)}
                  className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    form.ai_provider === value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Model — free text */}
          <div>
            <label htmlFor="ai_model" className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <input
              id="ai_model"
              type="text"
              value={form.ai_model}
              onChange={(e) => setField('ai_model', e.target.value)}
              placeholder={activeProvider.hint}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-gray-400">
              Type any model identifier supported by {activeProvider.label}.
              {form.ai_model === '' && ` Leave blank to use the default: ${activeProvider.hint}`}
            </p>
          </div>

          {/* Ollama base URL */}
          {form.ai_provider === 'ollama' && (
            <div>
              <label htmlFor="ollama_url" className="block text-sm font-medium text-gray-700 mb-1">
                Ollama Base URL
              </label>
              <input
                id="ollama_url"
                type="text"
                value={form.ollama_base_url}
                onChange={(e) => setField('ollama_base_url', e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}
        </section>

        {/* API Keys */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between">
            <h2 className="font-semibold text-gray-800">API Keys</h2>
            <span className="text-xs text-gray-400">Stored in the database, not in .env</span>
          </div>

          <KeyInput
            label="Anthropic"
            id="anthropic_key"
            value={form.anthropic_api_key}
            onChange={(v) => setField('anthropic_api_key', v)}
            placeholder={keyStatus.anthropic_api_key ? 'Leave blank to keep existing key' : 'sk-ant-…'}
            isSet={keyStatus.anthropic_api_key}
          />
          <KeyInput
            label="OpenAI"
            id="openai_key"
            value={form.openai_api_key}
            onChange={(v) => setField('openai_api_key', v)}
            placeholder={keyStatus.openai_api_key ? 'Leave blank to keep existing key' : 'sk-…'}
            isSet={keyStatus.openai_api_key}
          />
          <KeyInput
            label="OpenRouter"
            id="openrouter_key"
            value={form.openrouter_api_key}
            onChange={(v) => setField('openrouter_api_key', v)}
            placeholder={keyStatus.openrouter_api_key ? 'Leave blank to keep existing key' : 'sk-or-…'}
            isSet={keyStatus.openrouter_api_key}
          />
          <KeyInput
            label="Gemini"
            id="gemini_key"
            value={form.gemini_api_key}
            onChange={(v) => setField('gemini_api_key', v)}
            placeholder={keyStatus.gemini_api_key ? 'Leave blank to keep existing key' : 'AIza…'}
            isSet={keyStatus.gemini_api_key}
          />

          <p className="text-xs text-gray-400">
            Keys set here override the corresponding <code>.env</code> variable. Ollama runs locally and needs no key.
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
