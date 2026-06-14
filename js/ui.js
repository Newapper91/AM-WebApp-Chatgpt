/**
 * ui.js
 * ------
 * All DOM rendering lives here. Functions take already-computed data
 * (from calculations.js / amortization.js / etc.) and update the page.
 * No mortgage math happens in this file - see main.js for the glue that
 * gathers inputs, calls the calculation modules, and passes results here.
 */

const UI = {

  /* ----------------------------------------------------------------
   * TABS
   * ---------------------------------------------------------------- */
  initTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  },

  /* ----------------------------------------------------------------
   * VALIDATION MESSAGES
   * ---------------------------------------------------------------- */
  renderValidationErrors(errors) {
    const box = document.getElementById('validationErrors');
    if (!errors || errors.length === 0) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = `<strong>Some values were adjusted so the calculator could keep working:</strong>
      <ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
  },

  /* ----------------------------------------------------------------
   * SUMMARY TAB
   * ---------------------------------------------------------------- */
  renderSummary(state) {
    document.getElementById('out-loanAmount').textContent = Fmt.currency(state.loanAmount);
    document.getElementById('out-downPayment').textContent = Fmt.currency(state.inputs.downPaymentAmount);
    document.getElementById('out-downPaymentPct').textContent = Fmt.percent(state.downPaymentPct, 2);
    document.getElementById('out-ltv').textContent = Fmt.percent(state.ltv, 2);

    document.getElementById('out-monthlyPITI').textContent = Fmt.currency(state.monthlyPITI);

    const breakdown = document.getElementById('paymentBreakdown');
    breakdown.innerHTML = '';
    const rows = [
      ['Principal & interest', state.monthlyPI],
      ['Property tax', state.monthlyTax],
      ['Homeowners insurance', state.monthlyInsurance],
    ];
    if (state.monthlyPMI > 0) rows.push(['PMI (estimated)', state.monthlyPMI]);
    if (state.inputs.hoaMonthly > 0) rows.push(['HOA', state.inputs.hoaMonthly]);
    rows.forEach(([label, val]) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${label}</span><span>${Fmt.currency(val)}</span>`;
      breakdown.appendChild(li);
    });

    document.getElementById('out-totalInterest').textContent = Fmt.currencyRounded(state.totalInterestBase);
    document.getElementById('out-totalPaid').textContent = Fmt.currencyRounded(state.totalPaidBase);
    document.getElementById('out-payoffDate').textContent = Fmt.monthYear(state.payoffDateBase);

    if (state.pmiRemovalRow) {
      document.getElementById('out-pmiRemoval').textContent = Fmt.monthYear(state.pmiRemovalRow.date);
    } else if (state.monthlyPMI > 0) {
      document.getElementById('out-pmiRemoval').textContent = 'After loan term';
    } else {
      document.getElementById('out-pmiRemoval').textContent = 'N/A (no PMI)';
    }

    document.getElementById('out-frontDTI').textContent = Fmt.percent(state.frontDTI, 1);
    document.getElementById('out-backDTI').textContent = Fmt.percent(state.backDTI, 1);

    const ctcList = document.getElementById('cashToCloseBreakdown');
    ctcList.innerHTML = '';
    [
      ['Down payment', state.cashToClose.downPayment],
      ['Estimated closing costs', state.cashToClose.closingCosts],
      [`Prepaid escrow (${state.inputs.prepaidMonths} mo. tax + insurance)`, state.cashToClose.escrowPrepaid],
    ].forEach(([label, val]) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${label}</span><span>${Fmt.currency(val)}</span>`;
      ctcList.appendChild(li);
    });
    document.getElementById('out-cashToClose').textContent = Fmt.currencyRounded(state.cashToClose.total);

    this.renderWarnings(state.warnings);
  },

  renderWarnings(warnings) {
    const card = document.getElementById('warningsCard');
    const list = document.getElementById('warningsList');
    if (!warnings || warnings.length === 0) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    list.innerHTML = warnings.map(w => `<li>${w}</li>`).join('');
  },

  /* ----------------------------------------------------------------
   * AMORTIZATION SCHEDULE TABLE
   * Renders either an annual summary (one row per year) or a full
   * monthly table, depending on `monthly`.
   * ---------------------------------------------------------------- */
  renderScheduleTable(schedule, { monthly }) {
    const table = document.getElementById('scheduleTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (monthly) {
      thead.innerHTML = `<tr>
        <th>#</th><th>Date</th><th>Payment</th><th>Principal</th><th>Extra</th>
        <th>Interest</th><th>PMI</th><th>Balance</th><th>Cum. Interest</th><th>Cum. Principal</th><th>LTV</th>
      </tr>`;
      tbody.innerHTML = schedule.map(row => `<tr>
        <td>${row.month}</td>
        <td>${Fmt.monthYear(row.date)}</td>
        <td>${Fmt.currency(row.payment + row.pmi)}</td>
        <td>${Fmt.currency(row.principal)}</td>
        <td>${Fmt.currency(row.extraPrincipal)}</td>
        <td>${Fmt.currency(row.interest)}</td>
        <td>${Fmt.currency(row.pmi)}</td>
        <td>${Fmt.currency(row.balance)}</td>
        <td>${Fmt.currency(row.cumulativeInterest)}</td>
        <td>${Fmt.currency(row.cumulativePrincipal)}</td>
        <td>${Fmt.percent(row.ltv, 1)}</td>
      </tr>`).join('');
    } else {
      const annual = Amortization.toAnnualSummary(schedule);
      thead.innerHTML = `<tr>
        <th>Year</th><th>Months</th><th>Total Paid</th><th>Principal</th><th>Extra Principal</th>
        <th>Interest</th><th>PMI</th><th>Ending Balance</th>
      </tr>`;
      tbody.innerHTML = annual.map(y => `<tr class="year-row">
        <td>${y.year}</td>
        <td>${y.startMonth}–${y.endMonth}</td>
        <td>${Fmt.currencyRounded(y.payments)}</td>
        <td>${Fmt.currencyRounded(y.principal)}</td>
        <td>${Fmt.currencyRounded(y.extra)}</td>
        <td>${Fmt.currencyRounded(y.interest)}</td>
        <td>${Fmt.currencyRounded(y.pmi)}</td>
        <td>${Fmt.currencyRounded(y.endingBalance)}</td>
      </tr>`).join('');
    }
  },

  /* ----------------------------------------------------------------
   * EXTRA PAYMENT COMPARISON TAB
   * ---------------------------------------------------------------- */
  renderComparison(state) {
    const baseLast = state.baseSchedule[state.baseSchedule.length - 1];
    const extraLast = state.extraSchedule[state.extraSchedule.length - 1];
    const cmp = state.comparison;

    document.getElementById('cmp-base-payoff').textContent = Fmt.monthYear(baseLast?.date);
    document.getElementById('cmp-base-term').textContent = Fmt.yearsMonths(cmp.baseMonths);
    document.getElementById('cmp-base-interest').textContent = Fmt.currencyRounded(cmp.baseTotalInterest);
    document.getElementById('cmp-base-total').textContent = Fmt.currencyRounded(
      cmp.baseTotalInterest + (baseLast ? baseLast.cumulativePrincipal : 0)
    );

    document.getElementById('cmp-extra-payoff').textContent = Fmt.monthYear(extraLast?.date);
    document.getElementById('cmp-extra-term').textContent = Fmt.yearsMonths(cmp.extraMonths);
    document.getElementById('cmp-extra-interest').textContent = Fmt.currencyRounded(cmp.extraTotalInterest);
    document.getElementById('cmp-extra-total').textContent = Fmt.currencyRounded(
      cmp.extraTotalInterest + (extraLast ? extraLast.cumulativePrincipal : 0)
    );

    const banner = document.getElementById('savingsBanner');
    const hasExtra = state.hasExtraPayments;
    if (!hasExtra) {
      banner.innerHTML = `<h3>No extra payments configured</h3>
        <p class="hint">Add an extra monthly, one-time, or recurring annual payment on the Calculator tab to see your savings here.</p>`;
    } else if (cmp.monthsSaved <= 0) {
      banner.innerHTML = `<h3>Extra payments configured</h3>
        <p class="hint">With these extra payments, the loan still pays off on schedule (no early payoff was detected - double check your extra payment amounts).</p>`;
    } else {
      banner.innerHTML = `
        <h3>With extra payments, you could save:</h3>
        <div class="summary-grid">
          <div class="stat"><span class="stat-label">Time saved</span><span class="stat-value">${Fmt.yearsMonths(cmp.monthsSaved)}</span></div>
          <div class="stat"><span class="stat-label">Interest saved</span><span class="stat-value">${Fmt.currencyRounded(cmp.interestSaved)}</span></div>
          <div class="stat"><span class="stat-label">New payoff date</span><span class="stat-value">${Fmt.monthYear(cmp.extraPayoffDate)}</span></div>
        </div>`;
    }
  },

  /* ----------------------------------------------------------------
   * SVG BALANCE-OVER-TIME CHART
   * series: [{ label, color, schedule }]
   * ---------------------------------------------------------------- */
  renderBalanceChart(containerEl, series) {
    const W = 800, H = 280;
    const padL = 70, padR = 20, padT = 20, padB = 36;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const maxBalance = Math.max(...series.map(s => s.schedule[0]?.balance || 0), 1);
    const maxMonths = Math.max(...series.map(s => s.schedule.length), 1);

    const x = m => padL + (m / maxMonths) * innerW;
    const y = bal => padT + innerH - (bal / maxBalance) * innerH;

    const buildPath = (schedule) => {
      // Include a starting point at month 0 = full loan amount
      let d = `M ${x(0)} ${y(schedule[0] ? schedule[0].balance + schedule[0].totalPrincipal : maxBalance)}`;
      schedule.forEach(row => {
        d += ` L ${x(row.month)} ${y(row.balance)}`;
      });
      return d;
    };

    // Y-axis gridlines (4 horizontal lines)
    const gridLines = [];
    for (let i = 0; i <= 4; i++) {
      const val = (maxBalance / 4) * i;
      const yy = y(val);
      gridLines.push(`<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#E4DCCB" stroke-width="1" />`);
      gridLines.push(`<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#5B6B73" font-family="IBM Plex Mono, monospace">${Fmt.currencyRounded(val)}</text>`);
    }

    // X-axis labels (years)
    const xLabels = [];
    const totalYears = Math.ceil(maxMonths / 12);
    const step = totalYears > 20 ? 5 : (totalYears > 10 ? 2 : 1);
    for (let yr = 0; yr <= totalYears; yr += step) {
      const m = yr * 12;
      if (m > maxMonths) continue;
      xLabels.push(`<text x="${x(m)}" y="${H - padB + 18}" text-anchor="middle" font-size="11" fill="#5B6B73" font-family="IBM Plex Mono, monospace">Yr ${yr}</text>`);
    }

    const paths = series.map(s =>
      `<path d="${buildPath(s.schedule)}" fill="none" stroke="${s.color}" stroke-width="2.5" />`
    ).join('');

    const svg = `
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Loan balance over time">
        ${gridLines.join('')}
        ${xLabels.join('')}
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#5B6B73" stroke-width="1" />
        <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#5B6B73" stroke-width="1" />
        ${paths}
      </svg>`;

    containerEl.innerHTML = svg;

    // Legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.innerHTML = series.map(s =>
      `<span><span class="swatch" style="background:${s.color}"></span>${s.label}</span>`
    ).join('');
    containerEl.appendChild(legend);
  },

  /* ----------------------------------------------------------------
   * SCENARIO COMPARISON TABLE
   * ---------------------------------------------------------------- */
  renderScenarioTable(scenarios, results) {
    const table = document.getElementById('scenarioTable');

    const headerCells = scenarios.map((s, i) => `
      <th class="scenario-input-cell">
        <input type="text" data-field="label" data-idx="${i}" value="${s.label}" />
        ${scenarios.length > 1 ? `<button type="button" class="btn btn-remove btn-small" data-remove="${i}" style="margin-top:6px;">Remove</button>` : ''}
      </th>`).join('');

    const inputRow = (fieldLabel, field, type = 'number', step = '0.01', extra = '') => `
      <tr>
        <td class="row-label">${fieldLabel}</td>
        ${scenarios.map((s, i) => `
          <td class="scenario-input-cell">
            <input type="${type}" step="${step}" data-field="${field}" data-idx="${i}" value="${s[field]}" ${extra} />
          </td>`).join('')}
      </tr>`;

    const termSelectRow = () => `
      <tr>
        <td class="row-label">Loan term (years)</td>
        ${scenarios.map((s, i) => `
          <td class="scenario-input-cell">
            <select data-field="termYears" data-idx="${i}">
              ${[15, 20, 30].map(t => `<option value="${t}" ${s.termYears === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </td>`).join('')}
      </tr>`;

    const outputRow = (label, formatFn, key) => `
      <tr>
        <td class="row-label">${label}</td>
        ${results.map(r => `<td>${formatFn(r[key])}</td>`).join('')}
      </tr>`;

    table.innerHTML = `
      <thead>
        <tr><th>Scenario</th>${headerCells}</tr>
      </thead>
      <tbody>
        ${inputRow('Down payment %', 'downPaymentPct', 'number', '0.5')}
        ${inputRow('Interest rate %', 'annualRatePct', 'number', '0.01')}
        ${termSelectRow()}
        ${inputRow('Extra monthly payment ($)', 'extraMonthly', 'number', '10')}
        ${outputRow('Down payment', Fmt.currencyRounded, 'downPayment')}
        ${outputRow('Loan amount', Fmt.currencyRounded, 'loanAmount')}
        ${outputRow('LTV', v => Fmt.percent(v, 1), 'ltv')}
        ${outputRow('Monthly P&I', Fmt.currency, 'monthlyPI')}
        ${outputRow('Est. PMI / year', Fmt.currencyRounded, 'annualPMI')}
        ${outputRow('Full monthly PITI+', Fmt.currency, 'monthlyPITI')}
        ${outputRow('Payoff date', Fmt.monthYear, 'payoffDate')}
        ${outputRow('Total interest', Fmt.currencyRounded, 'totalInterest')}
        ${outputRow('Total paid', Fmt.currencyRounded, 'totalPaid')}
      </tbody>`;
  },

  /* ----------------------------------------------------------------
   * CUMULATIVE INTEREST CHART (Extra Payments tab)
   * Same idea as renderBalanceChart, but plots cumulative interest paid
   * (starting at $0) instead of remaining balance. The gap between the
   * two lines visually represents the interest saved.
   * ---------------------------------------------------------------- */
  renderInterestChart(containerEl, series) {
    const W = 800, H = 280;
    const padL = 70, padR = 20, padT = 20, padB = 36;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const maxInterest = Math.max(
      ...series.map(s => (s.schedule.length ? s.schedule[s.schedule.length - 1].cumulativeInterest : 0)),
      1
    );
    const maxMonths = Math.max(...series.map(s => s.schedule.length), 1);

    const x = m => padL + (m / maxMonths) * innerW;
    const y = v => padT + innerH - (v / maxInterest) * innerH;

    const buildPath = (schedule) => {
      let d = `M ${x(0)} ${y(0)}`;
      schedule.forEach(row => { d += ` L ${x(row.month)} ${y(row.cumulativeInterest)}`; });
      return d;
    };

    const gridLines = [];
    for (let i = 0; i <= 4; i++) {
      const val = (maxInterest / 4) * i;
      const yy = y(val);
      gridLines.push(`<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#E4DCCB" stroke-width="1" />`);
      gridLines.push(`<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#5B6B73" font-family="IBM Plex Mono, monospace">${Fmt.currencyRounded(val)}</text>`);
    }

    const xLabels = [];
    const totalYears = Math.ceil(maxMonths / 12);
    const step = totalYears > 20 ? 5 : (totalYears > 10 ? 2 : 1);
    for (let yr = 0; yr <= totalYears; yr += step) {
      const m = yr * 12;
      if (m > maxMonths) continue;
      xLabels.push(`<text x="${x(m)}" y="${H - padB + 18}" text-anchor="middle" font-size="11" fill="#5B6B73" font-family="IBM Plex Mono, monospace">Yr ${yr}</text>`);
    }

    const paths = series.map(s =>
      `<path d="${buildPath(s.schedule)}" fill="none" stroke="${s.color}" stroke-width="2.5" />`
    ).join('');

    const svg = `
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cumulative interest paid over time">
        ${gridLines.join('')}
        ${xLabels.join('')}
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#5B6B73" stroke-width="1" />
        <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#5B6B73" stroke-width="1" />
        ${paths}
      </svg>`;

    containerEl.innerHTML = svg;

    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.innerHTML = series.map(s =>
      `<span><span class="swatch" style="background:${s.color}"></span>${s.label}</span>`
    ).join('');
    containerEl.appendChild(legend);
  },

  /* ----------------------------------------------------------------
   * AFFORDABILITY TAB
   * ---------------------------------------------------------------- */
  renderAffordability(result) {
    document.getElementById('aff-maxPrice').textContent = Fmt.currencyRounded(result.maxPrice);
    document.getElementById('aff-loanAmount').textContent = Fmt.currencyRounded(result.maxLoanAmount);
    document.getElementById('aff-downPayment').textContent = Fmt.currencyRounded(result.downPayment);
    document.getElementById('aff-monthlyPI').textContent = Fmt.currency(result.monthlyPI);
    document.getElementById('aff-monthlyTax').textContent = Fmt.currency(result.monthlyTax);
    document.getElementById('aff-monthlyInsurance').textContent = Fmt.currency(result.monthlyInsurance);
    document.getElementById('aff-monthlyPMI').textContent = Fmt.currency(result.monthlyPMI);
    document.getElementById('aff-totalHousing').textContent = Fmt.currency(result.totalMonthlyHousing);
    document.getElementById('aff-dti').textContent =
      `${Fmt.percent(result.frontEndDTI, 1)} / ${Fmt.percent(result.backEndDTI, 1)}`;
  },

  /* ----------------------------------------------------------------
   * REFINANCE COMPARISON
   * ---------------------------------------------------------------- */
  renderRefinance(result) {
    document.getElementById('refi-currentPayment').textContent = Fmt.currency(result.currentPayment);
    document.getElementById('refi-newPayment').textContent = Fmt.currency(result.newPayment);
    document.getElementById('refi-monthlySavings').textContent = Fmt.currency(result.monthlySavings);
    document.getElementById('refi-breakEven').textContent = result.breakEvenMonths !== null
      ? Fmt.yearsMonths(result.breakEvenMonths)
      : 'Never (new payment is not lower)';
    document.getElementById('refi-currentInterest').textContent = Fmt.currencyRounded(result.totalInterestCurrent);
    document.getElementById('refi-newInterest').textContent = Fmt.currencyRounded(result.totalInterestNew);
    document.getElementById('refi-lifetimeDiff').textContent = Fmt.currencyRounded(result.lifetimeInterestDifference);
  },

  /* ----------------------------------------------------------------
   * BUYING POINTS BREAK-EVEN
   * ---------------------------------------------------------------- */
  renderPoints(result) {
    document.getElementById('pts-cost').textContent = Fmt.currencyRounded(result.cost);
    document.getElementById('pts-monthlySavings').textContent = Fmt.currency(result.monthlySavings);
    document.getElementById('pts-breakEven').textContent = result.breakEvenMonths !== null
      ? Fmt.yearsMonths(result.breakEvenMonths)
      : 'Never (no monthly savings at this rate)';
  },
};

window.UI = UI;
