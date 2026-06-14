/**
 * export.js
 * ----------
 * Builds a CSV file from an amortization schedule and triggers a browser
 * download. CSV opens directly in Excel, Google Sheets, Numbers, etc., so
 * a separate "Excel" format isn't needed.
 */

const Exporter = {

  /**
   * @param {Array<Object>} schedule  rows from Amortization.generateSchedule
   * @param {string} filename
   */
  downloadScheduleCSV(schedule, filename = 'amortization-schedule.csv') {
    const headers = [
      'Month', 'Date', 'Payment', 'Principal', 'Extra Principal',
      'Interest', 'PMI', 'Total Principal', 'Remaining Balance',
      'Cumulative Interest', 'Cumulative Principal', 'LTV %',
    ];

    const rows = schedule.map(row => [
      row.month,
      this._formatDate(row.date),
      row.payment.toFixed(2),
      row.principal.toFixed(2),
      row.extraPrincipal.toFixed(2),
      row.interest.toFixed(2),
      row.pmi.toFixed(2),
      row.totalPrincipal.toFixed(2),
      row.balance.toFixed(2),
      row.cumulativeInterest.toFixed(2),
      row.cumulativePrincipal.toFixed(2),
      row.ltv.toFixed(2),
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(this._csvEscape).join(','))
      .join('\r\n');

    this._download(csv, filename, 'text/csv;charset=utf-8;');
  },

  _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  _csvEscape(value) {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  },

  _download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

window.Exporter = Exporter;
