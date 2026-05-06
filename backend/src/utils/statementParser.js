/**
 * Deterministic transaction extractor for common Canadian bank statement formats.
 * Supports RBC, TD, BMO, Scotiabank, Desjardins, and generic tabular PDFs.
 * No AI required.
 */

// ─── Date normalisation ───────────────────────────────────────────────────────

const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseDate(raw, contextYear) {
  const s = raw.trim().replace(/\.$/, '');
  const y = contextYear || new Date().getFullYear();

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;

  // DD/MM/YYYY or MM/DD/YYYY — treat DD<=12 ambiguity as DD/MM for Canadian banks
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [, a, b, yr] = m;
    // If a > 12 it must be a day
    const [dd, mm] = parseInt(a) > 12 ? [a, b] : [b, a];
    return `${yr}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // MM/DD/YY or DD/MM/YY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (m) {
    const yr = parseInt(m[3]) + (parseInt(m[3]) > 50 ? 1900 : 2000);
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }

  // "Jan 15" / "Jan. 15" / "15 Jan" / "Jan 15, 2024"
  m = s.match(/^([A-Za-z]{3})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/i);
  if (m) {
    const mo = MONTH_MAP[m[1].toLowerCase().slice(0, 3)];
    if (mo) return `${m[3] || y}-${mo}-${m[2].padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\.?(?:,?\s*(\d{4}))?$/i);
  if (m) {
    const mo = MONTH_MAP[m[2].toLowerCase().slice(0, 3)];
    if (mo) return `${m[3] || y}-${mo}-${m[1].padStart(2, '0')}`;
  }

  return null;
}

function parseAmount(raw) {
  if (!raw) return null;
  const s = raw.toString().trim();
  // Parentheses = negative (debit in some formats)
  const negative = s.startsWith('(') && s.endsWith(')') || s.startsWith('-');
  const cleaned = s.replace(/[()$CAD\s,]/g, '').replace(/^-/, '');
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return null;
  return negative ? -num : num;
}

// ─── Line-based parser ────────────────────────────────────────────────────────

/**
 * Detect the year that appears most frequently in the text (for statements
 * that print dates without a year like "Jan 15").
 */
function detectYear(text) {
  const matches = text.match(/\b(20\d{2})\b/g) || [];
  if (!matches.length) return new Date().getFullYear();
  const freq = {};
  for (const y of matches) freq[y] = (freq[y] || 0) + 1;
  return parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
}

/**
 * Master date pattern — used to find date candidates at the start of a line.
 * Intentionally broad; parseDate() validates the value.
 */
const DATE_RE = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|[A-Za-z]{3}\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+[A-Za-z]{3}\.?)/;

/**
 * Amount pattern — matches values like 1,234.56  (1,234.56)  -1234.56  $45.00
 */
const AMOUNT_RE = /\(?\$?-?[\d,]+\.\d{2}\)?/;

function extractTransactionLines(text) {
  const year = detectYear(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const transactions = [];
  let prevDate = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;

    const dateStr = parseDate(dateMatch[0], year);
    if (!dateStr) continue;

    // Find all amount-like tokens in this line
    const amounts = [...line.matchAll(new RegExp(AMOUNT_RE.source, 'g'))].map((m) => m[0]);
    if (!amounts.length) {
      // Date line with no amount — might be a continuation line; look at next line
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        const nextAmounts = [...next.matchAll(new RegExp(AMOUNT_RE.source, 'g'))].map((m) => m[0]);
        if (nextAmounts.length) {
          const desc = line.slice(dateMatch[0].length).trim() + ' ' + next.slice(0, next.indexOf(nextAmounts[0])).trim();
          const merchant = cleanMerchant(desc);
          if (merchant) {
            const amount = pickTransactionAmount(nextAmounts);
            if (amount !== null) {
              transactions.push({ date: dateStr, merchant, amount, currency: 'CAD' });
              i++; // consumed next line
            }
          }
        }
      }
      continue;
    }

    const rest = line.slice(dateMatch[0].length);
    const firstAmountIdx = rest.search(new RegExp(AMOUNT_RE.source));
    const desc = firstAmountIdx >= 0 ? rest.slice(0, firstAmountIdx) : rest;
    const merchant = cleanMerchant(desc);
    if (!merchant) continue;

    const amount = pickTransactionAmount(amounts);
    if (amount === null) continue;

    transactions.push({ date: dateStr, merchant, amount, currency: detectCurrency(line) });
    prevDate = dateStr;
  }

  return transactions;
}

/**
 * Heuristic: prefer the second-to-last amount (the transaction amount column)
 * over the last (running balance). Falls back to the last if only one exists.
 */
function pickTransactionAmount(amounts) {
  if (!amounts.length) return null;
  const parsed = amounts.map(parseAmount).filter((a) => a !== null);
  if (!parsed.length) return null;
  // If multiple amounts, skip the last (likely balance) and use the one before
  if (parsed.length >= 2) return parsed[parsed.length - 2];
  return parsed[0];
}

function detectCurrency(line) {
  if (/\bUSD\b/.test(line)) return 'USD';
  if (/\bEUR\b/.test(line)) return 'EUR';
  if (/\bGBP\b/.test(line)) return 'GBP';
  return 'CAD';
}

const JUNK_RE = /^[\d\s.,*#\-–—/\\|]+$|^(page|total|balance|subtotal|opening|closing|previous|new\s+balance|interest|credit\s+limit|available|minimum\s+payment|statement\s+date)/i;

function cleanMerchant(raw) {
  const s = raw
    .replace(/\s+/g, ' ')
    .replace(/[*#]{2,}/g, '')   // strip masked digits  ** ****
    .replace(/\d{4,}/g, '')      // strip long digit runs (account numbers)
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!s || s.length < 3 || JUNK_RE.test(s)) return null;
  // Title-case
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── CSV / delimiter-based fallback ──────────────────────────────────────────

function extractCsvTransactions(text, year) {
  const transactions = [];
  const lines = text.split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    const cols = line.split(/[,\t;|]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) continue;

    // Try each column as a date
    let dateStr = null;
    let dateColIdx = -1;
    for (let i = 0; i < Math.min(cols.length, 3); i++) {
      dateStr = parseDate(cols[i], year);
      if (dateStr) { dateColIdx = i; break; }
    }
    if (!dateStr) continue;

    // Remaining columns: find amounts and description
    const remaining = cols.filter((_, i) => i !== dateColIdx);
    const amounts = remaining.map(parseAmount).filter((a) => a !== null);
    if (!amounts.length) continue;

    const desc = remaining.find((c) => isNaN(parseFloat(c.replace(/[,$]/g, ''))) && c.length > 2) || '';
    const merchant = cleanMerchant(desc);
    if (!merchant) continue;

    const amount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    transactions.push({ date: dateStr, merchant, amount, currency: 'CAD' });
  }
  return transactions;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract transactions from raw PDF text without AI.
 * Returns an array of { date, merchant, amount, currency, raw_description }.
 */
export function parseStatementText(text) {
  const year = detectYear(text);

  // Try line-based first (handles most bank PDFs)
  let transactions = extractTransactionLines(text);

  // If too few results, try CSV/delimiter fallback (some exports are CSV-like)
  if (transactions.length < 3) {
    const csvTxns = extractCsvTransactions(text, year);
    if (csvTxns.length > transactions.length) transactions = csvTxns;
  }

  // Deduplicate
  const seen = new Set();
  const deduped = [];
  for (const t of transactions) {
    const key = `${t.date}|${t.merchant}|${t.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...t, raw_description: t.merchant });
  }

  return deduped;
}
