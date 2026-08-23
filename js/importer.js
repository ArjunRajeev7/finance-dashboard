/* ============================================================
   importer.js — generic CSV/Excel import modal, reused by
   Stocks [IND/US], Mutual Funds, and Dividends pages.
   ============================================================ */

const Importer = {};

let _xlsxLoadPromise = null;
function loadXlsxLib() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxLoadPromise) return _xlsxLoadPromise;
  _xlsxLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Could not load the spreadsheet library — check your internet connection and try again'));
    document.head.appendChild(s);
  });
  return _xlsxLoadPromise;
}

// Returns an array of row objects keyed by header name (first row = headers).
Importer.parseFile = async function (file) {
  const XLSX = await loadXlsxLib();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

// Case/whitespace-insensitive lookup of a value from a parsed row object,
// since uploaded headers won't always match our exact casing.
Importer.getField = function (row, ...names) {
  const keys = Object.keys(row);
  for (const wanted of names) {
    const found = keys.find(k => k.trim().toLowerCase() === wanted.trim().toLowerCase());
    if (found !== undefined && row[found] !== '') return row[found];
  }
  return undefined;
};

// Normalizes a cell value (JS Date from Excel, or a string) into 'YYYY-MM-DD'.
// Returns null if it can't confidently parse the value.
Importer.normalizeDate = function (value) {
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    // Excel serial date fallback (days since 1899-12-30)
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
};

/**
 * opts:
 *   title: string
 *   columns: [{ label, aliases: [names to match], required: bool, hint: string }]
 *   templateFilename: string
 *   sampleRow: [values matching columns order] — used for the downloadable template
 *   onImport: async (rows) => { success: number, errors: string[] }
 */
Importer.openModal = function (opts) {
  const helpKey = 'import-help-' + Math.random().toString(36).slice(2, 8);
  const colListHtml = opts.columns.map(c =>
    `<li style="margin-bottom:4px;"><b>${c.label}</b>${c.required ? '' : ' <span style="color:var(--text-faint);">(optional)</span>'}${c.hint ? ' — ' + c.hint : ''}</li>`
  ).join('');

  const overlay = openModal(
    `${opts.title} <button class="info-trigger" data-info-key="${helpKey}" title="What's needed for import">i</button>`,
    `
    <p style="font-size:12.5px; color:var(--text-muted); margin-top:0;">Upload a .csv or .xlsx file. The first row must be column headers — click the <b>i</b> above for the exact list.</p>
    <div class="form-field" style="margin-bottom:12px;">
      <input type="file" id="importFileInput" accept=".csv,.xlsx,.xls" />
    </div>
    <div id="importStatus" style="font-size:12.5px; margin-bottom:12px; min-height:1.4em;"></div>
    <button class="ghost" id="downloadTemplateBtn">Download template</button>
    `,
    (overlay) => {
      registerInfoContent(helpKey, `
        <div style="font-weight:600; margin-bottom:8px; white-space:nowrap;">Required columns for import</div>
        <ul style="margin:0; padding-left:18px; font-size:11.5px; max-width:320px; white-space:normal;">${colListHtml}</ul>
        <div style="margin-top:8px; font-size:10.5px; color:var(--text-faint); white-space:normal; max-width:320px;">Column name matching ignores case and extra spaces. Dates can be actual Excel date cells or text like 2024-01-15.</div>
      `);
      wireInfoTriggers(overlay);

      overlay.querySelector('#importFileInput').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const statusEl = overlay.querySelector('#importStatus');
        statusEl.innerHTML = '<span style="color:var(--text-muted);">Parsing file…</span>';
        try {
          const rows = await Importer.parseFile(file);
          if (!rows.length) throw new Error('No rows found in the file');
          const result = await opts.onImport(rows);
          let html = `<span style="color:var(--gain);">Imported ${result.success} row(s).</span>`;
          if (result.errors.length) {
            html += `<br><span style="color:var(--loss);">${result.errors.length} row(s) skipped:</span>
              <ul style="margin:4px 0 0; padding-left:18px; color:var(--loss); font-size:11px;">
                ${result.errors.slice(0, 8).map(e => `<li>${e}</li>`).join('')}
                ${result.errors.length > 8 ? `<li>…and ${result.errors.length - 8} more</li>` : ''}
              </ul>`;
          }
          statusEl.innerHTML = html;
        } catch (err) {
          statusEl.innerHTML = `<span style="color:var(--loss);">${err.message}</span>`;
        }
      };

      overlay.querySelector('#downloadTemplateBtn').onclick = () => {
        const header = opts.columns.map(c => c.label).join(',');
        const sample = (opts.sampleRow || []).join(',');
        const csv = header + '\n' + sample + '\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = opts.templateFilename || 'import-template.csv';
        a.click();
      };
    }
  );
  return overlay;
};

window.Importer = Importer;
