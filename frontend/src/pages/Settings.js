import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon, { icons } from '../components/Icon';
import { incomeAPI, expenseAPI, budgetAPI, goalAPI, investmentAPI, settingsAPI, userAPI, exportAPI, importAPI, feedbackAPI } from '../services/api';
import { useState, useEffect, useRef } from 'react';
import ToastContainer, { showToast } from '../components/ui/Toast';

const fadeInUp = { animation: 'fadeInUp 0.5s ease-out forwards', opacity: 0 };
const stagger = (i) => ({ animationDelay: `${i * 0.08}s` });

const currencyOptions = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
];

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        animation: 'modalFadeIn 0.2s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 0,
        maxWidth: '420px', width: '92%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'modalSlideIn 0.25s ease-out',
      }}>
        {children}
      </div>
    </div>
  );
}

function toCSV(rows, headers) {
  if (!rows.length) return '';
  const lines = [headers.join(',')];
  rows.forEach(row => {
    lines.push(headers.map(h => {
      let val = row[h] ?? '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(','));
  });
  return lines.join('\n');
}

function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exportingKey, setExportingKey] = useState(null);

  const REPORT_TYPES = ['expenses', 'investments', 'financial-report', 'goals'];
  const [formats, setFormats] = useState(() => {
    try {
      const saved = localStorage.getItem('sfi-export-formats');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('sfi-export-formats', JSON.stringify(formats));
  }, [formats]);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  const [curOpen, setCurOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [curLoading, setCurLoading] = useState(false);
  const [curMsg, setCurMsg] = useState({ type: '', text: '' });

  const [fbOpen, setFbOpen] = useState(false);
  const [fbCategory, setFbCategory] = useState('General Feedback');
  const [fbRating, setFbRating] = useState(0);
  const [fbHoverRating, setFbHoverRating] = useState(0);
  const [fbMessage, setFbMessage] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbLoading, setFbLoading] = useState(false);
  const [fbMsg, setFbMsg] = useState({ type: '', text: '' });

  useEffect(() => { setSelectedCurrency(currency); }, [currency]);

  const resetFb = () => {
    setFbCategory('General Feedback');
    setFbRating(0);
    setFbHoverRating(0);
    setFbMessage('');
    setFbEmail('');
    setFbMsg({ type: '', text: '' });
  };

  const handleFbSubmit = async (e) => {
    e.preventDefault();
    setFbMsg({ type: '', text: '' });
    if (fbRating < 1) {
      setFbMsg({ type: 'error', text: 'Please select a rating' }); return;
    }
    if (!fbMessage.trim() || fbMessage.trim().length < 3) {
      setFbMsg({ type: 'error', text: 'Message must be at least 3 characters' }); return;
    }
    setFbLoading(true);
    try {
      await feedbackAPI.submit({
        category: fbCategory,
        rating: fbRating,
        message: fbMessage.trim(),
        email: fbEmail.trim(),
      });
      setFbMsg({ type: 'success', text: 'Thank you! Your feedback has been submitted.' });
      resetFb();
      setTimeout(() => { setFbOpen(false); setFbMsg({ type: '', text: '' }); }, 1800);
    } catch (err) {
      setFbMsg({ type: 'error', text: err.response?.data?.error || 'Failed to submit feedback' });
    } finally {
      setFbLoading(false);
    }
  };

  const resetPw = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPw(false);
    setPwMsg({ type: '', text: '' });
  };

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMsg({ type: 'error', text: 'All fields are required' }); return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'New password must be at least 6 characters' }); return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match' }); return;
    }
    setPwLoading(true);
    try {
      await userAPI.changePassword({ currentPassword, newPassword });
      setPwMsg({ type: 'success', text: 'Password updated successfully' });
      resetPw();
      setTimeout(() => { setPwOpen(false); setPwMsg({ type: '', text: '' }); }, 1200);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleCurSave = async () => {
    setCurLoading(true);
    setCurMsg({ type: '', text: '' });
    try {
      await userAPI.updateCurrency(selectedCurrency);
      setCurrency(selectedCurrency);
      if (user) updateUser({ currency: selectedCurrency });
      setCurMsg({ type: 'success', text: 'Currency updated' });
      setTimeout(() => { setCurOpen(false); setCurMsg({ type: '', text: '' }); }, 1000);
    } catch (err) {
      setCurMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update' });
    } finally {
      setCurLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const [incRes, expRes, budRes, goalRes, invRes] = await Promise.all([
        incomeAPI.getAll(),
        expenseAPI.getAll(),
        budgetAPI.getAll(),
        goalAPI.getAll(),
        investmentAPI.getAll(),
      ]);

      const incomes = incRes.data || [];
      const expenses = expRes.data || [];
      const budgets = budRes.data || [];
      const goals = goalRes.data || [];
      const investments = invRes.data || [];

      const incomeCSV = toCSV(incomes.map(i => ({
        date: new Date(i.date).toLocaleDateString('en-IN'),
        source: i.source,
        amount: i.amount,
        description: i.description || '',
      })), ['date', 'source', 'amount', 'description']);

      const expenseCSV = toCSV(expenses.map(e => ({
        date: new Date(e.date).toLocaleDateString('en-IN'),
        category: e.category,
        amount: e.amount,
        description: e.description || '',
      })), ['date', 'category', 'amount', 'description']);

      const budgetCSV = toCSV(budgets.map(b => ({
        month: b.month,
        category: b.category,
        limit: b.limit,
      })), ['month', 'category', 'limit']);

      const goalCSV = toCSV(goals.map(g => ({
        goalName: g.goalName,
        category: g.category,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        monthlySaving: g.monthlySaving,
        targetDate: new Date(g.targetDate).toLocaleDateString('en-IN'),
        priority: g.priority,
        status: g.status,
      })), ['goalName', 'category', 'targetAmount', 'savedAmount', 'monthlySaving', 'targetDate', 'priority', 'status']);

      const investCSV = toCSV(investments.map(i => ({
        name: i.name,
        type: i.type,
        category: i.category,
        amount: i.amount,
        currentValue: i.currentValue,
        investedDate: new Date(i.investedDate).toLocaleDateString('en-IN'),
        expectedReturns: i.expectedReturns,
        status: i.status,
        notes: i.notes || '',
      })), ['name', 'type', 'category', 'amount', 'currentValue', 'investedDate', 'expectedReturns', 'status', 'notes']);

      const combined = [
        '=== INCOME ===',
        'date,source,amount,description',
        incomeCSV || '(no data)',
        '',
        '=== EXPENSES ===',
        'date,category,amount,description',
        expenseCSV || '(no data)',
        '',
        '=== BUDGETS ===',
        'month,category,limit',
        budgetCSV || '(no data)',
        '',
        '=== GOALS ===',
        'goalName,category,targetAmount,savedAmount,monthlySaving,targetDate,priority,status',
        goalCSV || '(no data)',
        '',
        '=== INVESTMENTS ===',
        'name,type,category,amount,currentValue,investedDate,expectedReturns,status,notes',
        investCSV || '(no data)',
      ].join('\n');

      downloadCSV(`smart-finance-export-${new Date().toISOString().split('T')[0]}.csv`, combined);
      showToast('All data exported as CSV');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Failed to export data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const setFormat = (reportType, format) => {
    setFormats(prev => ({ ...prev, [reportType]: format }));
  };

  const handleUniversalExport = async (reportType) => {
    const format = formats[reportType];
    if (!format) return;

    const key = `${reportType}-${format}`;
    setExportingKey(key);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ext = format === 'xlsx' ? 'xlsx' : format;

    const fileNames = {
      expenses: `expense-report-${monthStr}.${ext}`,
      investments: `investment-report-${dateStr}.${ext}`,
      'financial-report': `financial-summary-${dateStr}.${ext}`,
      goals: `goal-progress-${dateStr}.${ext}`,
    };

    try {
      const apiMap = {
        comprehensive: { csv: exportAPI.comprehensiveCSV },
        expenses: { pdf: exportAPI.expensePDF, csv: exportAPI.expenseCSV, xlsx: exportAPI.expenseExcel },
        investments: { pdf: exportAPI.investmentPDF, csv: exportAPI.investmentCSV, xlsx: exportAPI.investmentExcel },
        'financial-report': { pdf: exportAPI.financialPDF, csv: exportAPI.financialCSV, xlsx: exportAPI.financialExcel },
        goals: { pdf: exportAPI.goalPDF, csv: exportAPI.goalCSV, xlsx: exportAPI.goalExcel },
      };

      const fn = apiMap[reportType]?.[format];
      if (!fn) throw new Error('Unsupported format');

      const res = await fn();
      downloadBlob(res.data, fileNames[reportType]);
      showToast(`Downloaded ${fileNames[reportType]}`);
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setExportingKey(null);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await settingsAPI.clearAllData();
      showToast(`All data cleared (${res.data.deletedCount} records)`);
      window.location.reload();
    } catch (err) {
      console.error('Clear data failed:', err);
      showToast('Failed to clear data', 'error');
    } finally {
      setClearing(false);
    }
  };

  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importFile, setImportFile] = useState(null);
  const [importFileType, setImportFileType] = useState('');
  const [importDatasetType, setImportDatasetType] = useState('');
  const [importPreview, setImportPreview] = useState([]);
  const [importAllRows, setImportAllRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const resetImport = () => {
    setImportStep(1);
    setImportFile(null);
    setImportFileType('');
    setImportDatasetType('');
    setImportPreview([]);
    setImportAllRows([]);
    setImportErrors([]);
    setImporting(false);
    setImportResult(null);
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      showToast('Unsupported file type. Use CSV or XLSX.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be under 10MB', 'error');
      return;
    }
    setImportFile(file);
    setImportFileType(ext);
  };

  const parseCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      const Papa = require('papaparse');
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error('CSV parsing error: ' + results.errors[0].message));
          }
          resolve(results.data);
        },
        error: (err) => reject(err),
      });
    });
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const XLSX = require('xlsx');
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          resolve(jsonData);
        } catch (err) {
          reject(new Error('Failed to parse Excel file. It may be corrupted.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleImportNext = async () => {
    if (importStep === 1 && importFile && importDatasetType) {
      setImportStep(3);
    } else if (importStep === 2 && importDatasetType) {
      setImportStep(3);
    } else if (importStep === 3) {
      if (!importFile) return;
      try {
        let rows;
        if (importFileType === 'csv') {
          rows = await parseCSVFile(importFile);
        } else {
          rows = await parseExcelFile(importFile);
        }
        if (!rows || rows.length === 0) {
          showToast('File is empty or has no data rows', 'error');
          return;
        }
        const normalizedRows = rows.map(r => {
          const row = {};
          Object.keys(r).forEach(k => {
            row[k.trim().toLowerCase().replace(/\s+/g, '')] = r[k];
          });
          return row;
        });
        setImportAllRows(normalizedRows);
        setImportPreview(normalizedRows.slice(0, 10));
        setImportErrors([]);
        setImportStep(4);
      } catch (err) {
        showToast(err.message || 'Failed to parse file', 'error');
      }
    } else if (importStep === 4) {
      setImportStep(5);
    }
  };

  const handleImportSubmit = async () => {
    setImporting(true);
    setImportErrors([]);
    try {
      const apiCall = importDatasetType === 'expense'
        ? importAPI.importExpenses(importAllRows)
        : importAPI.importIncome(importAllRows);
      const res = await apiCall;
      const data = res.data;
      if (data.success) {
        setImportResult(data);
        showToast(`${data.imported} ${importDatasetType} transactions imported successfully.`);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('sfi-data-imported'));
        }, 100);
      } else {
        setImportErrors(data.errors || ['Import failed']);
        setImportResult(data);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Import failed. Please try again.';
      showToast(msg, 'error');
      setImportErrors([msg]);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async (type) => {
    try {
      const res = type === 'expense'
        ? await importAPI.downloadExpenseTemplate()
        : await importAPI.downloadIncomeTemplate();
      const blob = new Blob([res.data], { type: 'text/csv' });
      downloadBlob(blob, `${type}-template.csv`);
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} template downloaded`);
    } catch (err) {
      showToast('Failed to download template', 'error');
    }
  };

  const currentLabel = currencyOptions.find(o => o.code === currency);

  const modalInput = {
    width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <>
    <Layout title="Settings">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes modalFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes modalSlideIn { from { opacity:0; transform:translateY(12px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        .setting-row {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: var(--radius-md);
          cursor: default;
        }
        .setting-row:hover {
          background: var(--bg-glass);
          transform: translateX(4px);
        }
        .setting-row:hover .setting-icon {
          transform: scale(1.1);
        }
        .setting-icon {
          transition: transform 0.25s ease;
        }
        .export-btn {
          position: relative; overflow: hidden;
          transition: all 0.3s ease;
        }
        .export-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59,130,246,0.25);
        }
        .export-btn:disabled {
          opacity: 0.7; cursor: not-allowed;
        }
        .danger-btn {
          transition: all 0.3s ease;
        }
        .danger-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(239,68,68,0.25);
        }
        .danger-btn:disabled {
          opacity: 0.7; cursor: not-allowed;
        }
        .section-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .section-card:hover {
          box-shadow: var(--shadow-lg);
        }
        .gradient-text {
          background: linear-gradient(135deg, var(--accent), var(--purple), var(--teal));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-size: 200% 200%; animation: gradient-shift 3s ease infinite;
        }
        .pw-field:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
        .pw-field::placeholder { color: var(--text-muted); opacity: 0.6; }
        .pw-toggle {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: var(--text-muted);
          padding: 4px; display: flex; border-radius: var(--radius-sm);
        }
        .pw-toggle:hover { color: var(--text-primary); }
        .cur-opt {
          padding: 10px 8px; border-radius: var(--radius-md); border: 1.5px solid var(--border);
          background: var(--bg-secondary); text-align: center; cursor: pointer;
          transition: all 0.2s;
        }
        .cur-opt:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.08); }
        .cur-opt.active { border-color: var(--accent); background: rgba(59,130,246,0.06);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .help-tile {
          background: linear-gradient(135deg, rgba(17,24,39,0.55) 0%, rgba(15,23,42,0.4) 100%);
          border: 1px solid rgba(148,163,184,0.12);
          border-radius: 18px;
          padding: 24px 20px;
          backdrop-filter: blur(14px);
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .help-tile::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 10%, rgba(148,163,184,0.1) 50%, transparent 90%);
        }
        .help-tile:hover {
          border-color: rgba(59,130,246,0.2);
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(59,130,246,0.08), 0 0 0 1px rgba(59,130,246,0.06);
        }
        [data-theme="light"] .help-tile {
          background: linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.82) 100%);
        }
        [data-theme="light"] .help-tile:hover {
          border-color: rgba(37,99,235,0.15);
        }
        .help-tile-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 14px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.25s ease;
        }
        .help-tile:hover .help-tile-icon {
          transform: scale(1.08);
        }
        .help-tile-title {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 0.92rem;
          margin-bottom: 5px;
        }
        .help-tile-desc {
          font-size: 0.76rem;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .help-primary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 32px;
          border-radius: 14px;
          border: 1px solid var(--accent);
          background: rgba(59,130,246,0.08);
          color: var(--accent);
          font-weight: 700;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.25s ease;
          letter-spacing: 0.01em;
        }
        .help-primary-btn:hover {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 6px 24px rgba(59,130,246,0.3);
          transform: translateY(-2px);
        }
        [data-theme="light"] .help-primary-btn {
          background: rgba(37,99,235,0.06);
        }
        [data-theme="light"] .help-primary-btn:hover {
          background: var(--accent);
          color: #fff;
        }
        .fb-star {
          cursor: pointer;
          transition: all 0.15s ease;
          color: var(--text-muted);
        }
        .fb-star:hover, .fb-star.active {
          color: #F59E0B;
          transform: scale(1.15);
        }
        .fb-star.active {
          filter: drop-shadow(0 0 4px rgba(245,158,11,0.4));
        }
        .fb-field {
          width: 100%;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit;
        }
        .fb-field:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
        }
        .fb-field::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }
        .export-section-wrap {
          background: linear-gradient(145deg, rgba(11,20,38,0.78) 0%, rgba(13,27,54,0.65) 100%);
          border: 1px solid rgba(148,163,184,0.14);
          border-radius: 24px;
          padding: 32px;
          backdrop-filter: blur(18px);
          box-shadow: 0 0 40px rgba(59,130,246,0.06), 0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .export-section-wrap:hover {
          box-shadow: 0 0 60px rgba(59,130,246,0.08), 0 12px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        [data-theme="light"] .export-section-wrap {
          background: linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.88) 100%);
          box-shadow: 0 0 40px rgba(59,130,246,0.04), 0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .export-section-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
        }
        .export-section-icon {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(20,184,166,0.12);
          border: 1px solid rgba(20,184,166,0.15);
          box-shadow: 0 0 24px rgba(20,184,166,0.1);
        }
        .export-section-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          line-height: 1.2;
        }
        .export-section-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 2px;
          line-height: 1.3;
        }
        .export-hero-wrap {
          margin-bottom: 24px;
        }
        .export-hero-card {
          background: linear-gradient(135deg, rgba(17,24,39,0.6) 0%, rgba(15,23,42,0.45) 100%);
          border: 1px solid rgba(148,163,184,0.12);
          border-radius: 20px;
          padding: 36px 32px;
          backdrop-filter: blur(14px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: center;
          max-width: 480px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
        }
        .export-hero-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 10%, rgba(59,130,246,0.2) 50%, transparent 90%);
        }
        .export-hero-card:hover {
          border-color: rgba(59,130,246,0.2);
          box-shadow: 0 8px 40px rgba(59,130,246,0.08), 0 0 0 1px rgba(59,130,246,0.06);
        }
        [data-theme="light"] .export-hero-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(248,250,252,0.8) 100%);
        }
        [data-theme="light"] .export-hero-card:hover {
          border-color: rgba(37,99,235,0.15);
        }
        .export-hero-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(20,184,166,0.1);
          border: 1px solid rgba(20,184,166,0.12);
          box-shadow: 0 0 32px rgba(20,184,166,0.1), 0 4px 16px rgba(0,0,0,0.15);
        }
        .export-hero-title {
          font-weight: 800;
          color: var(--text-primary);
          font-size: 1.15rem;
          line-height: 1.3;
          margin-bottom: 8px;
        }
        .export-hero-desc {
          font-size: 0.82rem;
          color: var(--text-muted);
          line-height: 1.5;
          margin-bottom: 24px;
          max-width: 340px;
          margin-left: auto;
          margin-right: auto;
        }
        .export-hero-format {
          display: inline-flex;
          gap: 0;
          border: 1px solid rgba(148,163,184,0.14);
          border-radius: 12px;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        [data-theme="light"] .export-hero-format {
          background: rgba(0,0,0,0.02);
        }
        .export-hero-format .export-format-pill {
          padding: 10px 20px;
          font-size: 0.78rem;
          letter-spacing: 0.04em;
        }
        .export-hero-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          max-width: 260px;
          padding: 14px 28px;
          border-radius: 14px;
          border: 1px solid var(--accent);
          background: rgba(59,130,246,0.08);
          color: var(--accent);
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.25s ease;
          letter-spacing: 0.01em;
        }
        .export-hero-btn:hover:not(:disabled) {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 6px 24px rgba(59,130,246,0.3);
          transform: translateY(-2px);
        }
        .export-hero-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        [data-theme="light"] .export-hero-btn {
          background: rgba(37,99,235,0.06);
          border-color: var(--accent);
          color: var(--accent);
        }
        [data-theme="light"] .export-hero-btn:hover:not(:disabled) {
          background: var(--accent);
          color: #fff;
        }
        .export-grid-2x2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .export-card {
          background: linear-gradient(135deg, rgba(17,24,39,0.55) 0%, rgba(15,23,42,0.4) 100%);
          border: 1px solid rgba(148,163,184,0.12);
          border-radius: 20px;
          padding: 24px;
          backdrop-filter: blur(14px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
          overflow: hidden;
        }
        .export-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 10%, rgba(148,163,184,0.1) 50%, transparent 90%);
        }
        .export-card:hover {
          border-color: rgba(59,130,246,0.18);
          box-shadow: 0 8px 32px rgba(59,130,246,0.06), 0 0 0 1px rgba(59,130,246,0.04);
        }
        [data-theme="light"] .export-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(248,250,252,0.8) 100%);
        }
        [data-theme="light"] .export-card:hover {
          border-color: rgba(37,99,235,0.12);
        }
        .export-card-header {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .export-card-icon {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .export-card-title {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 0.92rem;
          line-height: 1.3;
        }
        .export-card-desc {
          font-size: 0.76rem;
          color: var(--text-muted);
          margin-top: 2px;
          line-height: 1.4;
        }
        .export-format-bar {
          display: flex;
          gap: 0;
          border: 1px solid rgba(148,163,184,0.14);
          border-radius: 12px;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        [data-theme="light"] .export-format-bar {
          background: rgba(0,0,0,0.02);
        }
        .export-format-pill {
          flex: 1;
          padding: 10px 0;
          border: none;
          background: transparent;
          font-size: 0.74rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .export-format-pill:not(:last-child) {
          border-right: 1px solid rgba(148,163,184,0.1);
        }
        .export-format-pill:hover {
          color: var(--text-secondary);
          background: rgba(255,255,255,0.04);
        }
        [data-theme="light"] .export-format-pill:hover {
          background: rgba(0,0,0,0.02);
        }
        .export-format-pill.active {
          color: var(--accent);
          background: rgba(59,130,246,0.1);
          font-weight: 700;
          box-shadow: inset 0 0 12px rgba(59,130,246,0.06);
        }
        .export-format-pill.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 20%;
          right: 20%;
          height: 2px;
          background: var(--accent);
          border-radius: 2px 2px 0 0;
          box-shadow: 0 0 8px rgba(59,130,246,0.4);
        }
        .export-format-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .export-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 13px 20px;
          border-radius: 14px;
          border: 1px solid var(--accent);
          background: rgba(59,130,246,0.08);
          color: var(--accent);
          font-weight: 700;
          font-size: 0.84rem;
          cursor: pointer;
          transition: all 0.25s ease;
          letter-spacing: 0.01em;
        }
        .export-btn-primary:hover:not(:disabled) {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 6px 24px rgba(59,130,246,0.25);
          transform: translateY(-2px);
        }
        .export-btn-primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        [data-theme="light"] .export-btn-primary {
          background: rgba(37,99,235,0.06);
          border-color: var(--accent);
          color: var(--accent);
        }
        [data-theme="light"] .export-btn-primary:hover:not(:disabled) {
          background: var(--accent);
          color: #fff;
        }
        .export-danger-card {
          background: linear-gradient(135deg, rgba(17,24,39,0.55) 0%, rgba(15,23,42,0.4) 100%);
          border: 1px solid rgba(239,68,68,0.12);
          border-radius: 20px;
          padding: 24px;
          backdrop-filter: blur(14px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .export-danger-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 10%, rgba(239,68,68,0.15) 50%, transparent 90%);
        }
        .export-danger-card:hover {
          border-color: rgba(239,68,68,0.22);
          box-shadow: 0 6px 28px rgba(239,68,68,0.06);
        }
        [data-theme="light"] .export-danger-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(248,250,252,0.8) 100%);
        }
        .export-danger-info {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }
        .export-danger-icon {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--danger-glow);
          border: 1px solid rgba(239,68,68,0.1);
          box-shadow: 0 0 20px rgba(239,68,68,0.08);
        }
        .export-danger-title {
          font-weight: 700;
          color: var(--danger-light);
          font-size: 0.92rem;
        }
        .export-danger-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 2px;
          line-height: 1.4;
        }
        .export-danger-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          border-radius: 14px;
          background: transparent;
          border: 1px solid var(--danger);
          color: var(--danger-light);
          font-weight: 700;
          font-size: 0.84rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.25s ease;
        }
        .export-danger-btn:hover:not(:disabled) {
          background: rgba(239,68,68,0.1);
          border-color: var(--danger-light);
          box-shadow: 0 4px 20px rgba(239,68,68,0.12);
          transform: translateY(-2px);
        }
        .export-danger-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        @media (max-width: 680px) {
          .export-section-wrap {
            padding: 24px 20px;
          }
          .export-grid-2x2 {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .export-hero-card {
            padding: 28px 24px;
          }
          .export-hero-format .export-format-pill {
            padding: 9px 16px;
            font-size: 0.74rem;
          }
          .export-danger-card {
            flex-direction: column;
            align-items: stretch;
            padding: 20px;
          }
          .export-danger-btn {
            width: 100%;
            justify-content: center;
          }
        }

        .import-card-wrap {
          background: linear-gradient(135deg, rgba(17,24,39,0.55) 0%, rgba(15,23,42,0.4) 100%);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 20px;
          padding: 28px;
          backdrop-filter: blur(14px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .import-card-wrap::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 10%, rgba(59,130,246,0.2) 50%, transparent 90%);
        }
        .import-card-wrap:hover {
          border-color: rgba(59,130,246,0.22);
          box-shadow: 0 8px 40px rgba(59,130,246,0.08);
        }
        [data-theme="light"] .import-card-wrap {
          background: linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(248,250,252,0.8) 100%);
        }
        .import-card-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }
        .import-card-icon {
          width: 52px;
          height: 52px;
          min-width: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(20,184,166,0.12));
          border: 1px solid rgba(59,130,246,0.15);
          box-shadow: 0 0 24px rgba(59,130,246,0.1);
        }
        .import-card-title {
          font-weight: 800;
          color: var(--text-primary);
          font-size: 1.05rem;
          line-height: 1.3;
          margin-bottom: 4px;
        }
        .import-card-desc {
          font-size: 0.8rem;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .import-format-chips {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .import-chip {
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid rgba(148,163,184,0.15);
          background: rgba(255,255,255,0.04);
          color: var(--text-muted);
        }
        .import-chip.active {
          border-color: rgba(59,130,246,0.3);
          background: rgba(59,130,246,0.08);
          color: var(--accent);
        }
        .import-card-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .import-btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 20px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .import-btn-secondary:hover {
          border-color: var(--text-muted);
          color: var(--text-primary);
          background: rgba(255,255,255,0.06);
        }
        [data-theme="light"] .import-btn-secondary:hover {
          background: rgba(0,0,0,0.04);
        }
        .import-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 24px;
          border-radius: 12px;
          border: 1px solid var(--accent);
          background: rgba(59,130,246,0.08);
          color: var(--accent);
          font-weight: 700;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .import-btn-primary:hover:not(:disabled) {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 6px 24px rgba(59,130,246,0.3);
          transform: translateY(-2px);
        }
        .import-btn-primary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        [data-theme="light"] .import-btn-primary {
          background: rgba(37,99,235,0.06);
        }
        [data-theme="light"] .import-btn-primary:hover:not(:disabled) {
          background: var(--accent);
          color: #fff;
        }

        .import-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
          animation: modalFadeIn 0.2s ease-out;
        }
        .import-modal {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 24px;
          width: 94%;
          max-width: 580px;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.4);
          animation: modalSlideIn 0.25s ease-out;
          display: flex;
          flex-direction: column;
        }
        .import-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-light);
        }
        .import-modal-title {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary);
        }
        .import-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          font-size: 1.1rem;
        }
        .import-modal-close:hover {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.2);
          color: var(--danger-light);
        }
        .import-modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }
        .import-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border-light);
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .import-step-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 24px;
        }
        .import-step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border);
          transition: all 0.3s;
        }
        .import-step-dot.active {
          background: var(--accent);
          box-shadow: 0 0 12px rgba(59,130,246,0.4);
          width: 10px;
          height: 10px;
        }
        .import-step-dot.done {
          background: var(--success);
        }
        .import-step-line {
          width: 24px;
          height: 2px;
          background: var(--border);
          border-radius: 1px;
        }
        .import-step-line.done {
          background: var(--success);
        }
        .import-drop-zone {
          border: 2px dashed rgba(59,130,246,0.25);
          border-radius: 16px;
          padding: 40px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          background: rgba(59,130,246,0.03);
        }
        .import-drop-zone:hover {
          border-color: rgba(59,130,246,0.4);
          background: rgba(59,130,246,0.06);
        }
        .import-drop-zone.has-file {
          border-color: rgba(16,185,129,0.3);
          background: rgba(16,185,129,0.04);
        }
        .import-file-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(16,185,129,0.06);
          border: 1px solid rgba(16,185,129,0.15);
          margin-top: 16px;
        }
        .import-dataset-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .import-dataset-option {
          padding: 20px 16px;
          border-radius: 14px;
          border: 2px solid var(--border);
          background: transparent;
          cursor: pointer;
          text-align: center;
          transition: all 0.25s;
          color: var(--text-muted);
        }
        .import-dataset-option:hover {
          border-color: rgba(59,130,246,0.3);
          background: rgba(59,130,246,0.04);
        }
        .import-dataset-option.selected {
          border-color: var(--accent);
          background: rgba(59,130,246,0.08);
          color: var(--accent);
          box-shadow: 0 0 20px rgba(59,130,246,0.1);
        }
        .import-dataset-option-icon {
          width: 44px;
          height: 44px;
          margin: 0 auto 10px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .import-dataset-option-title {
          font-weight: 700;
          font-size: 0.88rem;
          margin-bottom: 4px;
        }
        .import-dataset-option-desc {
          font-size: 0.74rem;
          opacity: 0.7;
        }
        .import-preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
        }
        .import-preview-table th {
          text-align: left;
          padding: 10px 12px;
          background: rgba(59,130,246,0.06);
          border-bottom: 1px solid var(--border);
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 0.7rem;
          white-space: nowrap;
        }
        .import-preview-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-light);
          color: var(--text-primary);
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .import-preview-table tr:hover td {
          background: rgba(59,130,246,0.03);
        }
        .import-validation-list {
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid rgba(239,68,68,0.15);
          border-radius: 10px;
          padding: 12px;
          background: rgba(239,68,68,0.04);
        }
        .import-validation-item {
          font-size: 0.78rem;
          color: var(--danger-light);
          padding: 4px 0;
          display: flex;
          align-items: flex-start;
          gap: 6px;
          line-height: 1.4;
        }
        .import-validation-item::before {
          content: '';
          width: 4px;
          height: 4px;
          min-width: 4px;
          border-radius: 50%;
          background: var(--danger);
          margin-top: 6px;
        }
        .import-success-card {
          text-align: center;
          padding: 32px 16px;
        }
        .import-success-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(16,185,129,0.1);
          border: 2px solid rgba(16,185,129,0.2);
          box-shadow: 0 0 32px rgba(16,185,129,0.15);
        }
        .import-success-title {
          font-weight: 700;
          font-size: 1.1rem;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .import-success-desc {
          font-size: 0.82rem;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .import-loading-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          z-index: 10;
          border-radius: 24px;
        }
        @keyframes importSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .import-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(59,130,246,0.2);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: importSpin 0.8s linear infinite;
        }
        @media (max-width: 680px) {
          .import-card-wrap {
            padding: 20px;
          }
          .import-card-actions {
            flex-direction: column;
          }
          .import-btn-secondary, .import-btn-primary {
            width: 100%;
          }
          .import-dataset-options {
            grid-template-columns: 1fr;
          }
          .import-modal {
            width: 98%;
            max-height: 95vh;
          }
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ═══ Header ═══ */}
        <div style={{ ...fadeInUp, ...stagger(0) }}>
          <Card style={{ padding: '28px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.03,
              background: 'radial-gradient(circle at 30% 50%, var(--accent) 0%, transparent 50%), radial-gradient(circle at 70% 50%, var(--purple) 0%, transparent 50%)',
            }} />
            <div style={{
              width: 56, height: 56, borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', boxShadow: '0 8px 32px rgba(59,130,246,0.25)',
            }}>
              <Icon path={icons.settings} size={26} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Settings
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Manage your account preferences and data
            </p>
          </Card>
        </div>

        {/* ═══ Appearance ═══ */}
        <div style={{ ...fadeInUp, ...stagger(1) }}>
          <Card className="section-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.moon} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Appearance
              </h3>
            </div>
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: theme === 'dark' ? 'rgba(139,92,246,0.12)' : 'rgba(245,158,11,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={theme === 'dark' ? icons.moon : icons.sun} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Theme Mode</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Currently using <span style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{theme}</span> mode
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={toggleTheme}>
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            </div>
          </Card>
        </div>

        {/* ═══ Account ═══ */}
        <div style={{ ...fadeInUp, ...stagger(2) }}>
          <Card className="section-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.profile} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Account
              </h3>
            </div>

            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.profile} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Full Name</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {user?.name || 'Not set'}
                  </div>
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 999,
                background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
              }}>
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 14px' }} />

            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.send} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Email Address</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {user?.email || 'Not set'}
                  </div>
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 999,
                background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--success-light)',
              }}>
                Verified
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 14px' }} />

            {/* Change Password row */}
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.shield} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Change Password</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Update your account password securely
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { resetPw(); setPwOpen(true); }}>
                Change
              </Button>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 14px' }} />

            {/* Currency Preferences row */}
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.creditCard} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Currency Preferences</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Current: <span style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{currentLabel?.symbol} {currency}</span> — {currentLabel?.label}
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setSelectedCurrency(currency); setCurMsg({ type: '', text: '' }); setCurOpen(true); }}>
                Change
              </Button>
            </div>
          </Card>
        </div>

        {/* ═══ Data & Export Center ═══ */}
        <div style={{ ...fadeInUp, ...stagger(3) }}>
          <div className="export-section-wrap">
            <div className="export-section-header">
              <div className="export-section-icon">
                <Icon path={icons.reports} size={20} />
              </div>
              <div>
                <div className="export-section-title">Data & Export Center</div>
                <div className="export-section-subtitle">Import and export your financial data in multiple formats</div>
              </div>
            </div>

            {/* Hero Card: Complete Financial Data */}
            <div className="export-hero-wrap">
              <div className="export-hero-card">
                <div className="export-hero-icon">
                  <Icon path={icons.reports} size={26} />
                </div>
                <div className="export-hero-title">Complete Financial Data</div>
                <div className="export-hero-desc">All income, expenses, budgets, goals & investments in a single file</div>
                <div className="export-hero-format">
                  <button
                    className="export-format-pill active"
                    style={{ cursor: 'default' }}
                  >
                    <span className="export-format-dot" style={{ background: '#10b981' }} />
                    CSV
                  </button>
                </div>
                <button
                  className="export-hero-btn"
                  onClick={() => handleUniversalExport('comprehensive')}
                  disabled={exportingKey === 'comprehensive-csv'}
                >
                  {exportingKey === 'comprehensive-csv' ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export CSV
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2x2 Grid */}
            <div className="export-grid-2x2">

              {/* Expense Report */}
              <div className="export-card">
                <div className="export-card-header">
                  <div className="export-card-icon" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.1)' }}>
                    <Icon path={icons.expenses} size={20} />
                  </div>
                  <div>
                    <div className="export-card-title">Expense Report</div>
                    <div className="export-card-desc">Monthly expenses with category breakdown</div>
                  </div>
                </div>
                <div className="export-format-bar">
                  {['pdf', 'csv', 'xlsx'].map(f => (
                    <button
                      key={f}
                      className={`export-format-pill ${formats.expenses === f ? 'active' : ''}`}
                      onClick={() => setFormat('expenses', f)}
                    >
                      <span className="export-format-dot" style={{
                        background: f === 'pdf' ? '#ef4444' : f === 'csv' ? '#10b981' : '#14b8a6',
                      }} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="export-btn-primary"
                  onClick={() => handleUniversalExport('expenses')}
                  disabled={!formats.expenses || exportingKey === `expenses-${formats.expenses}`}
                >
                  {exportingKey === `expenses-${formats.expenses}` ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export {formats.expenses ? formats.expenses.toUpperCase() : ''}
                    </>
                  )}
                </button>
              </div>

              {/* Investment Report */}
              <div className="export-card">
                <div className="export-card-header">
                  <div className="export-card-icon" style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.1)' }}>
                    <Icon path={icons.investments} size={20} />
                  </div>
                  <div>
                    <div className="export-card-title">Investment Report</div>
                    <div className="export-card-desc">Portfolio performance & ROI analysis</div>
                  </div>
                </div>
                <div className="export-format-bar">
                  {['pdf', 'csv', 'xlsx'].map(f => (
                    <button
                      key={f}
                      className={`export-format-pill ${formats.investments === f ? 'active' : ''}`}
                      onClick={() => setFormat('investments', f)}
                    >
                      <span className="export-format-dot" style={{
                        background: f === 'pdf' ? '#ef4444' : f === 'csv' ? '#10b981' : '#14b8a6',
                      }} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="export-btn-primary"
                  onClick={() => handleUniversalExport('investments')}
                  disabled={!formats.investments || exportingKey === `investments-${formats.investments}`}
                >
                  {exportingKey === `investments-${formats.investments}` ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export {formats.investments ? formats.investments.toUpperCase() : ''}
                    </>
                  )}
                </button>
              </div>

              {/* Financial Report */}
              <div className="export-card">
                <div className="export-card-header">
                  <div className="export-card-icon" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.1)' }}>
                    <Icon path={icons.dashboard} size={20} />
                  </div>
                  <div>
                    <div className="export-card-title">Financial Report</div>
                    <div className="export-card-desc">Complete financial statement overview</div>
                  </div>
                </div>
                <div className="export-format-bar">
                  {['pdf', 'csv', 'xlsx'].map(f => (
                    <button
                      key={f}
                      className={`export-format-pill ${formats['financial-report'] === f ? 'active' : ''}`}
                      onClick={() => setFormat('financial-report', f)}
                    >
                      <span className="export-format-dot" style={{
                        background: f === 'pdf' ? '#ef4444' : f === 'csv' ? '#10b981' : '#14b8a6',
                      }} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="export-btn-primary"
                  onClick={() => handleUniversalExport('financial-report')}
                  disabled={!formats['financial-report'] || exportingKey === `financial-report-${formats['financial-report']}`}
                >
                  {exportingKey === `financial-report-${formats['financial-report']}` ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export {formats['financial-report'] ? formats['financial-report'].toUpperCase() : ''}
                    </>
                  )}
                </button>
              </div>

              {/* Goal Progress */}
              <div className="export-card">
                <div className="export-card-header">
                  <div className="export-card-icon" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.1)' }}>
                    <Icon path={icons.target} size={20} />
                  </div>
                  <div>
                    <div className="export-card-title">Goal Progress</div>
                    <div className="export-card-desc">Savings goals tracking & completion status</div>
                  </div>
                </div>
                <div className="export-format-bar">
                  {['pdf', 'csv', 'xlsx'].map(f => (
                    <button
                      key={f}
                      className={`export-format-pill ${formats.goals === f ? 'active' : ''}`}
                      onClick={() => setFormat('goals', f)}
                    >
                      <span className="export-format-dot" style={{
                        background: f === 'pdf' ? '#ef4444' : f === 'csv' ? '#10b981' : '#14b8a6',
                      }} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="export-btn-primary"
                  onClick={() => handleUniversalExport('goals')}
                  disabled={!formats.goals || exportingKey === `goals-${formats.goals}`}
                >
                  {exportingKey === `goals-${formats.goals}` ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export {formats.goals ? formats.goals.toUpperCase() : ''}
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Import Financial Data */}
            <div style={{ marginTop: '20px' }}>
              <div className="import-card-wrap">
                <div className="import-card-header">
                  <div className="import-card-icon">
                    <Icon path={icons.upload} size={24} />
                  </div>
                  <div>
                    <div className="import-card-title">Import Financial Data</div>
                    <div className="import-card-desc">
                      Upload CSV or Excel transaction datasets to automatically add income and expense records to your Smart Finance Insights account.
                    </div>
                  </div>
                </div>
                <div className="import-format-chips">
                  <span className="import-chip active">CSV</span>
                  <span className="import-chip active">XLSX</span>
                  <span className="import-chip active">Auto Validation</span>
                </div>
                <div className="import-card-actions">
                  <button className="import-btn-secondary" onClick={() => handleDownloadTemplate(importDatasetType || 'expense')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Sample Template
                  </button>
                  <button className="import-btn-primary" onClick={() => { resetImport(); setImportOpen(true); }}>
                    <Icon path={icons.upload} size={14} />
                    Import Dataset
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div style={{ marginTop: '4px' }}>
              <div className="export-danger-card">
                <div className="export-danger-info">
                  <div className="export-danger-icon">
                    <Icon path={icons.trash} size={20} />
                  </div>
                  <div>
                    <div className="export-danger-title">Clear All Data</div>
                    <div className="export-danger-desc">Permanently delete all your income, expenses, goals & investments</div>
                  </div>
                </div>
                <button
                  className="export-danger-btn"
                  onClick={handleClearData}
                  disabled={clearing}
                >
                  {clearing ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Icon path={icons.trash} size={14} />
                      Clear Data
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ═══ Security ═══ */}
        <div style={{ ...fadeInUp, ...stagger(4) }}>
          <Card className="section-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.shield} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Security
              </h3>
            </div>
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.shield} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Authentication</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    JWT token-based secure authentication
                  </div>
                </div>
              </div>
              <div style={{
                padding: '5px 14px', borderRadius: 999,
                background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)',
                fontSize: '0.78rem', fontWeight: 600, color: 'var(--success-light)',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                Active
              </div>
            </div>
          </Card>
        </div>

        {/* ═══ Help & Support ═══ */}
        <div style={{ ...fadeInUp, ...stagger(5) }}>
          <Card className="section-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(59,130,246,0.12))',
                border: '1px solid rgba(20,184,166,0.15)',
                boxShadow: '0 0 20px rgba(20,184,166,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.send} size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Help & Support
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.3 }}>
                  Share your experience, suggest improvements, or report issues to help us improve Smart Finance Insights.
                </p>
              </div>
            </div>

            {/* Intro Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(17,24,39,0.5) 0%, rgba(15,23,42,0.35) 100%)',
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: '18px',
              padding: '28px 24px',
              backdropFilter: 'blur(12px)',
              marginBottom: '20px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent 10%, rgba(20,184,166,0.2) 50%, transparent 90%)',
              }} />
              <div style={{
                width: 52, height: 52, margin: '0 auto 14px', borderRadius: 15,
                background: 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(59,130,246,0.1))',
                border: '1px solid rgba(20,184,166,0.12)',
                boxShadow: '0 0 28px rgba(20,184,166,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.send} size={22} />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                Enjoying Smart Finance Insights?
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
                Your feedback helps us build better features, fix issues, and create a smoother experience for everyone.
              </p>
            </div>

            {/* Quick Action Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div className="help-tile" onClick={() => { resetFb(); setFbRating(3); setFbOpen(true); }}>
                <div className="help-tile-icon" style={{
                  background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.12)',
                }}>
                  <Icon path={icons.savings} size={22} />
                </div>
                <div className="help-tile-title">Rate Experience</div>
                <div className="help-tile-desc">Rate your overall experience</div>
              </div>

              <div className="help-tile" onClick={() => { resetFb(); setFbCategory('Feature Request'); setFbOpen(true); }}>
                <div className="help-tile-icon" style={{
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.12)',
                }}>
                  <Icon path={icons.ai} size={22} />
                </div>
                <div className="help-tile-title">Send Suggestion</div>
                <div className="help-tile-desc">Share feature ideas and improvements</div>
              </div>

              <div className="help-tile" onClick={() => { resetFb(); setFbCategory('Bug Report'); setFbOpen(true); }}>
                <div className="help-tile-icon" style={{
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.12)',
                }}>
                  <Icon path={icons.alertCircle} size={22} />
                </div>
                <div className="help-tile-title">Report an Issue</div>
                <div className="help-tile-desc">Report technical or UI problems</div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div style={{ textAlign: 'center' }}>
              <button className="help-primary-btn" onClick={() => { resetFb(); setFbOpen(true); }}>
                <Icon path={icons.send} size={16} />
                Open Feedback Form
              </button>
            </div>
          </Card>
        </div>

        {/* ═══ Danger Zone ═══ */}
        <div style={{ ...fadeInUp, ...stagger(6) }}>
          <Card style={{
            padding: '24px 28px', border: '1px solid rgba(239,68,68,0.2)',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.03) 0%, rgba(127,29,29,0.02) 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.alertCircle} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Danger Zone
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Signing out will end your current session. You can sign back in anytime.
            </p>
            <button
              className="danger-btn"
              onClick={() => { logout(); navigate('/login'); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '14px 24px', borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, var(--danger), #b91c1c)',
                border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              <Icon path={icons.logout} size={18} />
              Sign Out of Account
            </button>
          </Card>
        </div>

      </div>

      {/* ═══ Password Modal ═══ */}
      <Modal open={pwOpen} onClose={() => { if (!pwLoading) { resetPw(); setPwOpen(false); } }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'rgba(20,184,166,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon path={icons.shield} size={17} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Change Password
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Update your account password
              </p>
            </div>
          </div>

          <form onSubmit={handlePwSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input className="pw-field" type={showPw ? 'text' : 'password'}
                    value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password" style={modalInput} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                    <Icon path={showPw ? icons.eyeOff : icons.eye} size={15} />
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input className="pw-field" type={showPw ? 'text' : 'password'}
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters" style={modalInput} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input className="pw-field" type={showPw ? 'text' : 'password'}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password" style={modalInput} />
                </div>
              </div>
            </div>

            {pwMsg.text && (
              <div style={{
                marginTop: '14px', padding: '9px 12px', borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem', fontWeight: 500,
                background: pwMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${pwMsg.type === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
                color: pwMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
              }}>
                {pwMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { resetPw(); setPwOpen(false); }}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                  fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                }}>
                Cancel
              </button>
              <button type="submit" disabled={pwLoading}
                style={{
                  padding: '8px 20px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                  fontWeight: 600, cursor: pwLoading ? 'not-allowed' : 'pointer', border: 'none',
                  background: 'var(--accent)', color: '#fff', opacity: pwLoading ? 0.6 : 1,
                }}>
                {pwLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ═══ Currency Modal ═══ */}
      <Modal open={curOpen} onClose={() => { if (!curLoading) setCurOpen(false); }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-glow)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon path={icons.creditCard} size={17} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Change Currency
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Choose how monetary values are displayed
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
            {currencyOptions.map((opt) => (
              <div
                key={opt.code}
                className={`cur-opt ${selectedCurrency === opt.code ? 'active' : ''}`}
                onClick={() => setSelectedCurrency(opt.code)}
              >
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: selectedCurrency === opt.code ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1.2 }}>
                  {opt.symbol}
                </div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '2px' }}>
                  {opt.code}
                </div>
              </div>
            ))}
          </div>

          {curMsg.text && (
            <div style={{
              marginTop: '14px', padding: '9px 12px', borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem', fontWeight: 500,
              background: curMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${curMsg.type === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
              color: curMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            }}>
              {curMsg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button onClick={() => setCurOpen(false)} disabled={curLoading}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)',
              }}>
              Cancel
            </button>
            <button onClick={handleCurSave} disabled={curLoading || selectedCurrency === currency}
              style={{
                padding: '8px 20px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                fontWeight: 600, cursor: curLoading || selectedCurrency === currency ? 'not-allowed' : 'pointer',
                border: 'none', background: 'var(--accent)', color: '#fff',
                opacity: curLoading || selectedCurrency === currency ? 0.6 : 1,
              }}>
              {curLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══ Feedback Modal ═══ */}
      <Modal open={fbOpen} onClose={() => { if (!fbLoading) { resetFb(); setFbOpen(false); } }}>
        <div style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(59,130,246,0.12))',
              border: '1px solid rgba(20,184,166,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon path={icons.send} size={17} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Send Feedback
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                We'd love to hear from you
              </p>
            </div>
          </div>

          <form onSubmit={handleFbSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category */}
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Category
                </label>
                <select
                  className="fb-field"
                  value={fbCategory}
                  onChange={(e) => setFbCategory(e.target.value)}
                  style={{ cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '36px' }}
                >
                  <option>General Feedback</option>
                  <option>Feature Request</option>
                  <option>Bug Report</option>
                  <option>UI/UX Suggestion</option>
                  <option>Performance Issue</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Rating */}
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Rating
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`fb-star ${(fbHoverRating || fbRating) >= star ? 'active' : ''}`}
                      onClick={() => setFbRating(star)}
                      onMouseEnter={() => setFbHoverRating(star)}
                      onMouseLeave={() => setFbHoverRating(0)}
                      style={{
                        background: 'none', border: 'none', padding: '4px',
                        fontSize: '1.5rem', lineHeight: 1,
                        color: (fbHoverRating || fbRating) >= star ? '#F59E0B' : 'var(--text-muted)',
                        transition: 'all 0.15s ease',
                        transform: (fbHoverRating || fbRating) >= star ? 'scale(1.15)' : 'scale(1)',
                        filter: (fbHoverRating || fbRating) >= star ? 'drop-shadow(0 0 4px rgba(245,158,11,0.4))' : 'none',
                      }}
                    >
                      ★
                    </button>
                  ))}
                  {fbRating > 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '6px' }}>
                      {fbRating === 1 ? 'Poor' : fbRating === 2 ? 'Fair' : fbRating === 3 ? 'Good' : fbRating === 4 ? 'Very Good' : 'Excellent'}
                    </span>
                  )}
                </div>
              </div>

              {/* Message */}
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Message
                </label>
                <textarea
                  className="fb-field"
                  rows={4}
                  value={fbMessage}
                  onChange={(e) => setFbMessage(e.target.value)}
                  placeholder="Tell us what you liked, what could be improved, or describe the issue you encountered..."
                  style={{ resize: 'vertical', minHeight: '90px' }}
                />
              </div>

              {/* Optional Email */}
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Contact Email <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <input
                  className="fb-field"
                  type="email"
                  value={fbEmail}
                  onChange={(e) => setFbEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {fbMsg.text && (
              <div style={{
                marginTop: '16px', padding: '10px 14px', borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem', fontWeight: 500,
                background: fbMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${fbMsg.type === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
                color: fbMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
              }}>
                {fbMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { resetFb(); setFbOpen(false); }}
                style={{
                  padding: '9px 20px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                  fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                }}>
                Cancel
              </button>
              <button type="submit" disabled={fbLoading}
                style={{
                  padding: '9px 22px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                  fontWeight: 600, cursor: fbLoading ? 'not-allowed' : 'pointer', border: 'none',
                  background: 'var(--accent)', color: '#fff', opacity: fbLoading ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                {fbLoading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon path={icons.send} size={14} />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Import Modal */}
      {importOpen && (
        <div className="import-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setImportOpen(false); resetImport(); } }}>
          <div className="import-modal" style={{ position: 'relative' }}>
            {importing && (
              <div className="import-loading-overlay">
                <div className="import-spinner" />
                <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>Importing data...</div>
              </div>
            )}
            <div className="import-modal-header">
              <div className="import-modal-title">
                {importStep === 5 && importResult?.success ? 'Import Complete' : 'Import Financial Data'}
              </div>
              <button className="import-modal-close" onClick={() => { setImportOpen(false); resetImport(); }}>
                &times;
              </button>
            </div>

            <div className="import-modal-body">
              {/* Step Indicator */}
              <div className="import-step-indicator">
                {[1, 2, 3, 4, 5].map(s => (
                  <>
                    <div key={s} className={`import-step-dot ${importStep === s ? 'active' : importStep > s ? 'done' : ''}`} />
                    {s < 5 && <div key={`line-${s}`} className={`import-step-line ${importStep > s ? 'done' : ''}`} />}
                  </>
                ))}
              </div>

              {/* Step 1: Choose File */}
              {importStep === 1 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 16, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Select a file to import
                  </div>
                  <div
                    className={`import-drop-zone ${importFile ? 'has-file' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={handleImportFileSelect}
                    />
                    {importFile ? (
                      <>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" style={{ margin: '0 auto 12px' }}>
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: 4 }}>
                          {importFile.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {(importFile.size / 1024).toFixed(1)} KB &middot; {importFileType.toUpperCase()} file
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--accent)', marginTop: 8, cursor: 'pointer' }}>
                          Click to change file
                        </div>
                      </>
                    ) : (
                      <>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 12px', opacity: 0.6 }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: 4 }}>
                          Click to browse files
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Supports CSV and XLSX files up to 10MB
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Select Dataset Type */}
              {importStep === 2 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 20, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    What type of data are you importing?
                  </div>
                  <div className="import-dataset-options">
                    <button
                      className={`import-dataset-option ${importDatasetType === 'expense' ? 'selected' : ''}`}
                      onClick={() => setImportDatasetType('expense')}
                    >
                      <div className="import-dataset-option-icon" style={{ background: 'rgba(244,63,94,0.12)' }}>
                        <Icon path={icons.expenses} size={22} />
                      </div>
                      <div className="import-dataset-option-title">Expense Dataset</div>
                      <div className="import-dataset-option-desc">Import expense transactions with categories</div>
                    </button>
                    <button
                      className={`import-dataset-option ${importDatasetType === 'income' ? 'selected' : ''}`}
                      onClick={() => setImportDatasetType('income')}
                    >
                      <div className="import-dataset-option-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
                        <Icon path={icons.income} size={22} />
                      </div>
                      <div className="import-dataset-option-title">Income Dataset</div>
                      <div className="import-dataset-option-desc">Import income records with sources</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Upload & Parse */}
              {importStep === 3 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 16, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Ready to parse your file
                  </div>
                  <div style={{
                    padding: 20, borderRadius: 14, background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.12)', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 600 }}>
                      {importFile?.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      {importFileType.toUpperCase()} &middot; {(importFile?.size / 1024).toFixed(1)} KB
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>
                      {importDatasetType === 'expense' ? 'Expense' : 'Income'} Dataset
                    </div>
                  </div>
                  <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                    Click <strong>Next</strong> to parse and preview your data. Required columns for {importDatasetType}:
                    <br />
                    {importDatasetType === 'expense'
                      ? <span style={{ color: 'var(--text-primary)' }}>date, amount, category, description</span>
                      : <span style={{ color: 'var(--text-primary)' }}>date, amount, source, description</span>
                    }
                  </div>
                </div>
              )}

              {/* Step 4: Preview Data */}
              {importStep === 4 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                      Data Preview ({importAllRows.length} rows)
                    </div>
                    {importPreview.length > 0 && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Showing first {importPreview.length} rows
                      </div>
                    )}
                  </div>

                  {importPreview.length > 0 ? (
                    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <table className="import-preview-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            {Object.keys(importPreview[0]).map(k => (
                              <th key={k}>{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((row, i) => (
                            <tr key={i}>
                              <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{i + 1}</td>
                              {Object.keys(importPreview[0]).map(k => (
                                <td key={k}>{row[k] != null ? String(row[k]) : ''}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No data found in the file
                    </div>
                  )}

                  {importErrors.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 600, color: 'var(--danger-light)', fontSize: '0.82rem', marginBottom: 8 }}>
                        Validation Errors ({importErrors.length})
                      </div>
                      <div className="import-validation-list">
                        {importErrors.map((err, i) => (
                          <div key={i} className="import-validation-item">{err}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Result */}
              {importStep === 5 && (
                <div className="import-success-card">
                  {importResult?.success ? (
                    <>
                      <div className="import-success-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <div className="import-success-title">Import Successful!</div>
                      <div className="import-success-desc">
                        <strong>{importResult.imported}</strong> {importDatasetType} transactions imported successfully.
                        {importResult.failed > 0 && (
                          <div style={{ marginTop: 8, color: 'var(--danger-light)' }}>
                            {importResult.failed} rows failed validation.
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Dashboard, reports, and analytics will refresh automatically.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="import-success-icon" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.1)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      </div>
                      <div className="import-success-title" style={{ color: 'var(--danger-light)' }}>Import Failed</div>
                      <div className="import-success-desc">
                        {importErrors.length > 0 ? (
                          <div className="import-validation-list" style={{ textAlign: 'left', marginTop: 12 }}>
                            {importErrors.map((err, i) => (
                              <div key={i} className="import-validation-item">{err}</div>
                            ))}
                          </div>
                        ) : (
                          'An error occurred during import. Please check your data and try again.'
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="import-modal-footer">
              {importStep > 1 && importStep < 5 && (
                <button className="import-btn-secondary" onClick={() => setImportStep(s => s - 1)}>
                  Back
                </button>
              )}
              {importStep < 4 && (
                <button
                  className="import-btn-primary"
                  onClick={handleImportNext}
                  disabled={(importStep === 1 && !importFile) || (importStep === 2 && !importDatasetType)}
                >
                  Next
                </button>
              )}
              {importStep === 4 && (
                <button
                  className="import-btn-primary"
                  onClick={handleImportNext}
                  disabled={importAllRows.length === 0}
                >
                  Review & Import ({importAllRows.length} rows)
                </button>
              )}
              {importStep === 5 && !importResult?.success && (
                <button className="import-btn-primary" onClick={() => { resetImport(); setImportStep(1); }}>
                  Try Again
                </button>
              )}
              {importStep === 5 && importResult?.success && (
                <button className="import-btn-primary" onClick={() => { setImportOpen(false); resetImport(); }}>
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </Layout>
    <ToastContainer />
  </>
  );
}
