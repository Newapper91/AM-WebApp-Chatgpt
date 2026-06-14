/**
 * main.js
 * --------
 * Glue code. This file is the only one that:
 *   - Reads values out of <input> elements
 *   - Decides WHEN to recalculate (event listeners)
 *   - Calls into Calc / Amortization / Affordability / Refinance / Scenarios
 *   - Hands the results to UI.render*() functions
 *
 * If you want to add a new input or output, this is the file to edit.
 */

(function () {
  const $ = (id) => document.getElementById(id);

  /* ================================================================
   * SMALL HELPERS
   * ================================================================ */

  /** Round to 2 decimal places (avoids floating-point noise in inputs). */
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  /** Default loan start date = the 1st of next month. */
  function defaultStartDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /** "2031-04-12" -> Date(2031, 3, 12). Returns null for empty input. */
  function parseDateInput(value) {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  /** "2031-04" (from <input type="month">) -> Date(2031, 3, 1). */
  function parseMonthInput(value) {
    if (!value) return null;
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) return null;
    return new Date(y, m - 1, 1);
  }

  /** Date -> "2031-04-12" for <input type="date">. */
  function toDateInputValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }


  function syncOneTimeExtrasFromDOM() {
    const rows = Array.from(document.querySelectorAll('#oneTimeExtrasList .one-time-extra-row'));
    oneTimeExtras = rows.map((row) => ({
      amount: Fmt.num(row.querySelector('[data-one-time-amount]')?.value),
      date: row.querySelector('[data-one-time-date]')?.value || '',
    }));
  }

  function renderOneTimeExtras() {
    const list = $('oneTimeExtrasList');
    if (!list) return;
    if (!oneTimeExtras.length) oneTimeExtras.push({ amount: 0, date: '' });

    list.innerHTML = '';
    oneTimeExtras.forEach((extra, idx) => {
      const row = document.createElement('div');
      row.className = 'field-row one-time-extra-row';
      row.innerHTML = `
        <div class="field">
          <div class="input-prefix">
            <span>$</span>
            <input type="number" data-one-time-amount data-idx="${idx}" min="0" step="100" value="${extra.amount || 0}" aria-label="One-time extra payment amount" />
          </div>
        </div>
        <div class="field">
          <input type="month" data-one-time-date data-idx="${idx}" value="${extra.date || ''}" aria-label="One-time extra payment month" />
        </div>
        <div class="field one-time-extra-actions">
          <button type="button" class="btn btn-danger btn-small" data-remove-one-time="${idx}" ${oneTimeExtras.length === 1 ? 'disabled' : ''}>Remove</button>
        </div>
      `;
      list.appendChild(row);
    });
  }

  /* ================================================================
   * DOWN PAYMENT $ <-> % SYNC
   * Whichever field the user edits drives the other. Editing the
   * purchase price keeps the PERCENT fixed and recalculates the dollar
   * amount (so "10% down" stays "10% down" as the price changes).
   * ================================================================ */
  let syncing = false;

  // Dynamic list of one-time extra principal payments.
  // Each item is { amount: number|string, date: 'YYYY-MM' }.
  let oneTimeExtras = [{ amount: 0, date: '' }];

  function syncAmountFromPercent() {
    if (syncing) return;
    syncing = true;
    const price = Fmt.num($('purchasePrice').value);
    const pct = Fmt.num($('downPaymentPercent').value);
    $('downPaymentAmount').value = round2(price * (pct / 100));
    syncing = false;
  }

  function syncPercentFromAmount() {
    if (syncing) return;
    syncing = true;
    const price = Fmt.num($('purchasePrice').value);
    const amount = Fmt.num($('downPaymentAmount').value);
    $('downPaymentPercent').value = price > 0 ? round2((amount / price) * 100) : 0;
    syncing = false;
  }

  /* ================================================================
   * READ INPUTS FROM THE FORM
   * ================================================================ */
  function getLoanInputs() {
    const termSelect = $('loanTermYears').value;
    const termYears = termSelect === 'custom'
      ? Fmt.num($('customTermYears').value, 30)
      : Fmt.num(termSelect, 30);

    const closingCostMethod = document
      .querySelector('input[name="closingCostMethod"]:checked').value;

    return {
      purchasePrice: Fmt.num($('purchasePrice').value),
      downPaymentAmount: Fmt.num($('downPaymentAmount').value),
      interestRate: Fmt.num($('interestRate').value),
      termYears,
      loanStartDate: parseDateInput($('loanStartDate').value) || defaultStartDate(),

      propertyTaxAnnual: Fmt.num($('propertyTaxAnnual').value),
      homeInsuranceAnnual: Fmt.num($('homeInsuranceAnnual').value),
      hoaMonthly: Fmt.num($('hoaMonthly').value),
      pmiRemovalLTV: Fmt.num($('pmiRemovalLTV').value, 80),
      pmiOverrideEnabled: $('pmiOverrideEnabled').checked,
      pmiAnnualManual: Fmt.num($('pmiAnnualManual').value),

      extraMonthly: Fmt.num($('extraMonthly').value),
      oneTimeExtras: oneTimeExtras
        .map((o) => ({ amount: Fmt.num(o.amount), date: parseMonthInput(o.date) }))
        .filter((o) => o.amount > 0 && o.date),
      annualExtraAmount: Fmt.num($('annualExtraAmount').value),
      annualExtraMonth: Fmt.num($('annualExtraMonth').value, 1),
      extraStartDate: parseMonthInput($('extraStartDate').value),

      closingCostMethod,
      closingCostValue: Fmt.num($('closingCostValue').value),
      prepaidMonths: Fmt.num($('prepaidMonths').value, 2),

      grossMonthlyIncome: Fmt.num($('grossMonthlyIncome').value),
      otherMonthlyDebts: Fmt.num($('otherMonthlyDebts').value),
    };
  }

  /* ================================================================
   * INPUT VALIDATION
   * Clamps obviously-bad values to safe ranges and returns a list of
   * human-readable messages explaining what was changed, so a typo
   * (or an empty field) never crashes the calculator or produces
   * nonsense like a negative loan amount.
   * ================================================================ */
  function validateInputs(raw) {
    const errors = [];
    const inputs = { ...raw };

    if (!(inputs.purchasePrice > 0)) {
      errors.push('Purchase price must be greater than $0 — using $1.');
      inputs.purchasePrice = 1;
    }
    if (inputs.downPaymentAmount < 0) {
      errors.push('Down payment cannot be negative — using $0.');
      inputs.downPaymentAmount = 0;
    }
    if (inputs.downPaymentAmount > inputs.purchasePrice) {
      errors.push('Down payment cannot exceed the purchase price — capping it at the purchase price.');
      inputs.downPaymentAmount = inputs.purchasePrice;
    }
    if (inputs.interestRate < 0) {
      errors.push('Interest rate cannot be negative — using 0%.');
      inputs.interestRate = 0;
    }
    if (inputs.interestRate > 30) {
      errors.push('An interest rate over 30% looks like a typo — capping at 30%.');
      inputs.interestRate = 30;
    }
    if (!(inputs.termYears > 0)) {
      errors.push('Loan term must be at least 1 year — using 1 year.');
      inputs.termYears = 1;
    }
    if (inputs.termYears > 50) {
      errors.push('A loan term over 50 years looks like a typo — capping at 50 years.');
      inputs.termYears = 50;
    }
    if (inputs.pmiRemovalLTV < 50 || inputs.pmiRemovalLTV > 100) {
      inputs.pmiRemovalLTV = Math.min(100, Math.max(50, inputs.pmiRemovalLTV));
    }
    if (inputs.prepaidMonths < 0) inputs.prepaidMonths = 0;
    if (inputs.prepaidMonths > 24) inputs.prepaidMonths = 24;

    // Anything that should simply never be negative.
    [
      'propertyTaxAnnual', 'homeInsuranceAnnual', 'hoaMonthly', 'pmiAnnualManual',
      'extraMonthly', 'annualExtraAmount',
      'grossMonthlyIncome', 'otherMonthlyDebts', 'closingCostValue',
    ].forEach((key) => {
      if (inputs[key] < 0) inputs[key] = 0;
    });

    return { inputs, errors };
  }

  /* ================================================================
   * MAIN RECOMPUTE — runs on every change to the Calculator form
   * ================================================================ */
  let lastState = null;

  function recompute() {
    const raw = getLoanInputs();
    const { inputs, errors } = validateInputs(raw);
    UI.renderValidationErrors(errors);

    const downPayment = inputs.downPaymentAmount;
    const loanAmount = Calc.loanAmount(inputs.purchasePrice, downPayment);
    const downPaymentPct = Calc.downPaymentPercent(downPayment, inputs.purchasePrice);
    const ltv = Calc.ltv(loanAmount, inputs.purchasePrice);
    const monthlyPI = Calc.monthlyPI(loanAmount, inputs.interestRate, inputs.termYears);

    // PMI: manual override (any value, including $0 to force "no PMI"),
    // otherwise auto-estimated whenever down payment is under 20%.
    const annualPMI = inputs.pmiOverrideEnabled
      ? inputs.pmiAnnualManual
      : Calc.estimatePMI(loanAmount, downPaymentPct, null);
    const monthlyPMI = annualPMI / 12;

    const monthlyTax = inputs.propertyTaxAnnual / 12;
    const monthlyInsurance = inputs.homeInsuranceAnnual / 12;
    const monthlyPITI = Calc.monthlyPITI({ pAndI: monthlyPI, monthlyTax, monthlyInsurance })
      + monthlyPMI + inputs.hoaMonthly;

    // ---- Baseline schedule (no extra payments) ----
    const baseSchedule = Amortization.generateSchedule({
      loanAmount,
      annualRatePct: inputs.interestRate,
      termYears: inputs.termYears,
      startDate: inputs.loanStartDate,
      purchasePrice: inputs.purchasePrice,
      annualPMI,
      pmiRemovalLTV: inputs.pmiRemovalLTV,
    });

    // ---- Schedule with extra payments (only built if any are set) ----
    const hasExtraPayments = inputs.extraMonthly > 0
      || inputs.oneTimeExtras.length > 0
      || inputs.annualExtraAmount > 0;

    const extraSchedule = hasExtraPayments
      ? Amortization.generateSchedule({
          loanAmount,
          annualRatePct: inputs.interestRate,
          termYears: inputs.termYears,
          startDate: inputs.loanStartDate,
          purchasePrice: inputs.purchasePrice,
          annualPMI,
          pmiRemovalLTV: inputs.pmiRemovalLTV,
          extraMonthly: inputs.extraMonthly,
          oneTimeExtras: inputs.oneTimeExtras,
          annualExtra: { amount: inputs.annualExtraAmount, month: inputs.annualExtraMonth },
          extraStartDate: inputs.extraStartDate,
        })
      : baseSchedule;

    const comparison = Amortization.compareSchedules(baseSchedule, extraSchedule);
    const pmiRemovalRow = Amortization.findPMIRemovalRow(baseSchedule, inputs.pmiRemovalLTV);

    const frontDTI = Calc.frontEndDTI(monthlyPITI, inputs.grossMonthlyIncome);
    const backDTI = Calc.backEndDTI(monthlyPITI, inputs.otherMonthlyDebts, inputs.grossMonthlyIncome);

    const closingCosts = Calc.closingCosts(inputs.purchasePrice, inputs.closingCostMethod, inputs.closingCostValue);
    const cashToClose = Calc.cashToClose({
      downPayment,
      closingCosts,
      monthlyTax,
      monthlyInsurance,
      prepaidMonths: inputs.prepaidMonths,
    });

    // ---- Warnings: high LTV / high DTI ----
    const warnings = [...errors];
    if (ltv > 97) {
      warnings.push(`Your loan-to-value ratio is ${Fmt.percent(ltv, 1)}. Most conventional lenders cap LTV around 97% (3% minimum down payment).`);
    } else if (ltv > 80) {
      warnings.push(`Your loan-to-value ratio is ${Fmt.percent(ltv, 1)}, which is above 80% — PMI applies until your balance reaches ${Fmt.percent(inputs.pmiRemovalLTV, 0)} LTV.`);
    }
    if (inputs.grossMonthlyIncome > 0) {
      if (frontDTI > 28) {
        warnings.push(`Front-end DTI is ${Fmt.percent(frontDTI, 1)} — many lenders prefer housing costs at or below 28% of gross income.`);
      }
      if (backDTI > 43) {
        warnings.push(`Back-end DTI is ${Fmt.percent(backDTI, 1)} — many conventional loan programs cap total debt around 43–45% of gross income.`);
      }
    }

    const last = baseSchedule[baseSchedule.length - 1];

    lastState = {
      inputs,
      loanAmount,
      downPaymentPct,
      ltv,
      monthlyPI,
      monthlyPMI,
      monthlyTax,
      monthlyInsurance,
      monthlyPITI,
      baseSchedule,
      extraSchedule,
      comparison,
      hasExtraPayments,
      pmiRemovalRow,
      totalInterestBase: last ? last.cumulativeInterest : 0,
      totalPaidBase: loanAmount + (last ? last.cumulativeInterest : 0),
      payoffDateBase: last ? last.date : inputs.loanStartDate,
      frontDTI,
      backDTI,
      cashToClose,
      warnings,
    };

    UI.renderSummary(lastState);
    renderScheduleTab();
    renderExtraTab();
  }

  /* ================================================================
   * AMORTIZATION SCHEDULE TAB
   * ================================================================ */
  const scheduleView = { variant: 'normal', monthly: false };

  function renderScheduleTab() {
    if (!lastState) return;
    const schedule = scheduleView.variant === 'extra' ? lastState.extraSchedule : lastState.baseSchedule;
    UI.renderScheduleTable(schedule, { monthly: scheduleView.monthly });

    const series = [{ label: 'Normal schedule', color: '#5B6B73', schedule: lastState.baseSchedule }];
    if (lastState.hasExtraPayments) {
      series.push({ label: 'With extra payments', color: '#5C8A6E', schedule: lastState.extraSchedule });
    }
    UI.renderBalanceChart($('balanceChartWrap'), series);
  }

  /* ================================================================
   * EXTRA PAYMENTS TAB
   * ================================================================ */
  function renderExtraTab() {
    if (!lastState) return;
    UI.renderComparison(lastState);

    const series = [
      { label: 'Normal schedule', color: '#5B6B73', schedule: lastState.baseSchedule },
      { label: 'With extra payments', color: '#5C8A6E', schedule: lastState.extraSchedule },
    ];
    UI.renderInterestChart($('extraChartWrap'), series);
  }

  /* ================================================================
   * SCENARIO COMPARISON TAB
   * ================================================================ */
  let scenarios = [];

  function defaultScenarios() {
    const inputs = getLoanInputs();
    const term = [15, 20, 30].includes(inputs.termYears) ? inputs.termYears : 30;
    return [5, 10, 20].map((pct) => ({
      label: `${pct}% down`,
      downPaymentPct: pct,
      annualRatePct: inputs.interestRate,
      termYears: term,
      extraMonthly: 0,
    }));
  }

  function renderScenarios() {
    const { inputs } = validateInputs(getLoanInputs());
    const shared = {
      purchasePrice: inputs.purchasePrice,
      annualTax: inputs.propertyTaxAnnual,
      annualInsurance: inputs.homeInsuranceAnnual,
      monthlyHOA: inputs.hoaMonthly,
      manualAnnualPMI: inputs.pmiOverrideEnabled ? inputs.pmiAnnualManual : null,
      startDate: inputs.loanStartDate,
      pmiRemovalLTV: inputs.pmiRemovalLTV,
    };
    const results = scenarios.map((s) => Scenarios.compute(shared, s));
    UI.renderScenarioTable(scenarios, results);
  }

  /* ================================================================
   * AFFORDABILITY TAB
   * ================================================================ */
  function recomputeAffordability() {
    const params = {
      grossMonthlyIncome: Fmt.num($('aff-grossMonthlyIncome').value),
      otherMonthlyDebts: Fmt.num($('aff-otherMonthlyDebts').value),
      targetBackEndDTI: Fmt.num($('aff-targetDTI').value, 36),
      downPaymentPct: Fmt.num($('aff-downPaymentPct').value),
      annualRatePct: Fmt.num($('aff-interestRate').value),
      termYears: Fmt.num($('aff-termYears').value, 30),
      propertyTaxRatePct: Fmt.num($('aff-propertyTaxRate').value),
      annualInsurance: Fmt.num($('aff-annualInsurance').value),
      monthlyHOA: Fmt.num($('aff-monthlyHOA').value),
    };
    const result = Affordability.estimateMaxPrice(params);
    UI.renderAffordability(result);
  }

  /* ================================================================
   * REFINANCE & POINTS TAB
   * ================================================================ */
  function recomputeRefinance() {
    const { inputs } = validateInputs(getLoanInputs());
    const includeExtras = $('refiIncludeExtras')?.checked;
    const extras = includeExtras ? {
      startDate: new Date(),
      extraMonthly: inputs.extraMonthly,
      oneTimeExtras: inputs.oneTimeExtras,
      annualExtra: { amount: inputs.annualExtraAmount, month: inputs.annualExtraMonth },
      extraStartDate: inputs.extraStartDate,
    } : null;

    const result = Refinance.compare({
      originalLoanAmount: Fmt.num($('refi-originalLoanAmount').value),
      originalTermYears: Math.max(1, Fmt.num($('refi-originalTermYears').value, 30)),
      currentBalance: Fmt.num($('refi-currentBalance').value),
      currentRatePct: Fmt.num($('refi-currentRate').value),
      currentRemainingMonths: Math.max(1, Fmt.num($('refi-currentRemainingYears').value, 29) * 12),
      newRatePct: Fmt.num($('refi-newRate').value),
      newTermYears: Math.max(1, Fmt.num($('refi-newTermYears').value, 30)),
      refinanceCosts: Fmt.num($('refi-costs').value),
      extras,
    });
    UI.renderRefinance(result);
  }

  function recomputePoints() {
    const result = Refinance.pointsBreakEven({
      loanAmount: Fmt.num($('pts-loanAmount').value),
      termYears: Math.max(1, Fmt.num($('pts-termYears').value, 30)),
      originalRatePct: Fmt.num($('pts-originalRate').value),
      discountedRatePct: Fmt.num($('pts-discountedRate').value),
      points: Fmt.num($('pts-points').value),
    });
    UI.renderPoints(result);
  }

  /* ================================================================
   * WIRE UP EVENT LISTENERS
   * ================================================================ */
  function init() {
    // Default the loan start date to the 1st of next month if not set.
    if (!$('loanStartDate').value) {
      $('loanStartDate').value = toDateInputValue(defaultStartDate());
    }

    UI.initTabs();
    renderOneTimeExtras();

    // ---- Down payment $ <-> % sync ----
    $('downPaymentAmount').addEventListener('input', syncPercentFromAmount);
    $('downPaymentPercent').addEventListener('input', syncAmountFromPercent);
    $('purchasePrice').addEventListener('input', syncAmountFromPercent);
    // ^ keeps down-payment % fixed and recalculates the $ amount as price changes

    // ---- PMI manual override toggle ----
    $('pmiOverrideEnabled').addEventListener('change', () => {
      $('pmiManualWrap').hidden = !$('pmiOverrideEnabled').checked;
    });

    // ---- Closing cost method toggle (% vs $) ----
    document.querySelectorAll('input[name="closingCostMethod"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const method = document.querySelector('input[name="closingCostMethod"]:checked').value;
        const price = Fmt.num($('purchasePrice').value);
        const current = Fmt.num($('closingCostValue').value);
        if (method === 'dollar') {
          // Convert the current % value into an equivalent $ amount.
          $('closingCostValue').value = round2(price * (current / 100));
          $('closingCostUnit').textContent = '$';
        } else {
          // Convert the current $ value back into a % of price.
          $('closingCostValue').value = price > 0 ? round2((current / price) * 100) : 3;
          $('closingCostUnit').textContent = '%';
        }
      });
    });

    // ---- Loan term: show/hide custom term field ----
    $('loanTermYears').addEventListener('change', () => {
      $('customTermWrap').hidden = $('loanTermYears').value !== 'custom';
    });

    // ---- Multiple one-time extra payments ----
    $('addOneTimeExtraBtn').addEventListener('click', () => {
      syncOneTimeExtrasFromDOM();
      oneTimeExtras.push({ amount: 0, date: '' });
      renderOneTimeExtras();
      recompute();
    });
    $('oneTimeExtrasList').addEventListener('input', () => {
      syncOneTimeExtrasFromDOM();
      recompute();
    });
    $('oneTimeExtrasList').addEventListener('change', () => {
      syncOneTimeExtrasFromDOM();
      recompute();
    });
    $('oneTimeExtrasList').addEventListener('click', (e) => {
      const idx = e.target.dataset.removeOneTime;
      if (idx === undefined) return;
      syncOneTimeExtrasFromDOM();
      oneTimeExtras.splice(Number(idx), 1);
      renderOneTimeExtras();
      recompute();
    });

    // ---- Any change on the Calculator form recomputes everything ----
    // (Specific handlers above run first and update sibling fields;
    // this delegated listener then picks up the final values.)
    $('loanForm').addEventListener('input', recompute);
    $('loanForm').addEventListener('change', recompute);

    // ---- Amortization Schedule tab controls ----
    $('scheduleVariant').addEventListener('change', () => {
      scheduleView.variant = $('scheduleVariant').value;
      renderScheduleTab();
    });
    $('toggleMonthlyBtn').addEventListener('click', () => {
      scheduleView.monthly = !scheduleView.monthly;
      $('toggleMonthlyBtn').textContent = scheduleView.monthly ? 'Show annual summary' : 'Show monthly detail';
      renderScheduleTab();
    });
    $('exportCsvBtn').addEventListener('click', () => {
      if (!lastState) return;
      const schedule = scheduleView.variant === 'extra' ? lastState.extraSchedule : lastState.baseSchedule;
      const filename = scheduleView.variant === 'extra'
        ? 'amortization-schedule-with-extra-payments.csv'
        : 'amortization-schedule.csv';
      Exporter.downloadScheduleCSV(schedule, filename);
    });

    // ---- Scenario Comparison tab ----
    scenarios = defaultScenarios();
    $('presetDownPaymentsBtn').addEventListener('click', () => {
      scenarios = defaultScenarios();
      renderScenarios();
    });
    $('addScenarioBtn').addEventListener('click', () => {
      const template = scenarios[scenarios.length - 1] || defaultScenarios()[0];
      scenarios.push({ ...template, label: `Scenario ${scenarios.length + 1}` });
      renderScenarios();
    });
    // Use 'change' (fires on blur / Enter / select) rather than 'input' so the
    // whole table doesn't re-render — and steal focus — on every keystroke.
    $('scenarioTable').addEventListener('change', (e) => {
      const idx = e.target.dataset.idx;
      const field = e.target.dataset.field;
      if (idx === undefined || !field) return;
      const i = Number(idx);
      if (field === 'label') {
        scenarios[i].label = e.target.value;
      } else if (field === 'termYears') {
        scenarios[i].termYears = Fmt.num(e.target.value, 30);
      } else {
        scenarios[i][field] = Fmt.num(e.target.value, 0);
      }
      renderScenarios();
    });
    $('scenarioTable').addEventListener('click', (e) => {
      if (e.target.dataset.remove !== undefined && e.target.dataset.remove !== '') {
        scenarios.splice(Number(e.target.dataset.remove), 1);
        renderScenarios();
      }
    });

    // ---- Affordability tab ----
    $('affordForm').addEventListener('input', recomputeAffordability);
    $('affordForm').addEventListener('change', recomputeAffordability);

    // ---- Refinance & Points tab ----
    const refiTab = $('tab-refi');
    refiTab.addEventListener('input', () => { recomputeRefinance(); recomputePoints(); });
    refiTab.addEventListener('change', () => { recomputeRefinance(); recomputePoints(); });

    $('refiUseLoanBtn').addEventListener('click', () => {
      const { inputs } = validateInputs(getLoanInputs());
      const loanAmount = Calc.loanAmount(inputs.purchasePrice, inputs.downPaymentAmount);
      $('refi-originalLoanAmount').value = round2(loanAmount);
      $('refi-originalTermYears').value = inputs.termYears;
      $('refi-currentBalance').value = round2(loanAmount);
      $('refi-currentRate').value = inputs.interestRate;
      $('refi-currentRemainingYears').value = inputs.termYears;
      $('pts-loanAmount').value = round2(loanAmount);
      $('pts-termYears').value = inputs.termYears;
      $('pts-originalRate').value = inputs.interestRate;
      recomputeRefinance();
      recomputePoints();
    });

    // ---- Initial render of everything ----
    recompute();
    renderScenarios();
    recomputeAffordability();
    recomputeRefinance();
    recomputePoints();
  }

  init();
})();
