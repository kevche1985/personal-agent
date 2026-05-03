import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { statements } from '../api/client.js';

export default function StatementUploader({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a PDF file.');
      return;
    }
    setError(null);
    setStatus('uploading');
    try {
      const result = await statements.upload(file);
      setStatus('done');
      onUploaded?.(result);
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed. Please try again.');
      setStatus(null);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
        }`}
      >
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        {status === 'uploading' ? (
          <p className="text-sm text-brand-600 font-medium animate-pulse">Uploading & analyzing...</p>
        ) : status === 'done' ? (
          <p className="text-sm text-green-600 font-medium">✓ Statement uploaded and analysis started!</p>
        ) : (
          <>
            <Upload className="mx-auto mb-2 text-gray-400" size={32} />
            <p className="text-sm font-medium text-gray-700">Drop your bank statement PDF here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse · Max 25 MB · Text-based PDFs only</p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
