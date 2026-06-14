/**
 * amortization.js
 * ----------------
 * Generates month-by-month amortization schedules.
 *
 * generateSchedule(params) builds ONE schedule. To compare "normal" vs.
 * "with extra payments", call it twice with different `extra*` settings
 * (see ui.js / main.js for how the two schedules are built and compared).
 */

const Amortization = {

  /**
   * @param {Object} params
   * @param {number} params.loanAmount        Starting principal balance
   * @param {number} params.annualRatePct     Annual interest rate, e.g. 6.5
   * @param {number} params.termYears         Loan term in years (15/20/30/...)
   * @param {Date}   params.startDate         Date of the FIRST payment's month
   * @param {number} params.purchasePrice     Used for LTV / PMI tracking
   * @param {number} params.annualPMI         Annual PMI dollar amount (0 if none)
   * @param {number} params.pmiRemovalLTV     LTV% at which PMI is dropped (default 80)
   * @param {number} [params.extraMonthly]    Extra principal paid every month
   * @param {Array<Object>} [params.oneTimeExtras]  Array of { amount, date: Date|null }
   * @param {Object} [params.oneTimeExtra]    Backward-compatible single { amount, date: Date|null }
   * @param {Object} [params.annualExtra]     { amount, month: 1-12|null }
   * @param {Date}   [params.extraStartDate]  Extras only apply on/after this date
   *
   * @returns {Array<Object>} one row per payment, each row:
   *   { month, date, payment, principal, extraPrincipal, totalPrincipal,
   *     interest, pmi, balance, cumulativeInterest, cumulativePrincipal, ltv }
   */
  generateSchedule(params) {
    const {
      loanAmount,
      annualRatePct,
      termYears,
      startDate,
      purchasePrice,
      annualPMI = 0,
      pmiRemovalLTV = 80,
      extraMonthly = 0,
      oneTimeExtras = [],
      oneTimeExtra = { amount: 0, date: null },
      annualExtra = { amount: 0, month: null },
      extraStartDate = null,
    } = params;

    const normalizedOneTimeExtras = [
      ...(Array.isArray(oneTimeExtras) ? oneTimeExtras : []),
      ...(oneTimeExtra && oneTimeExtra.amount > 0 ? [oneTimeExtra] : []),
    ];

    const r = Calc.monthlyRate(annualRatePct);
    const basePayment = Calc.monthlyPI(loanAmount, annualRatePct, termYears);
    // Hard safety cap so a bad input (e.g. extra payment that increases the
    // balance somehow) can never create an infinite loop.
    const scheduledMonths = termYears * 12;
    const HARD_CAP = scheduledMonths + 12 * 60; // up to 60 extra years of slack

    let balance = loanAmount;
    let cumulativeInterest = 0;
    let cumulativePrincipal = 0;
    let pmiActive = annualPMI > 0;
    const schedule = [];

    for (let m = 1; m <= HARD_CAP; m++) {
      if (balance <= 0.005) break;

      const date = Calc.addMonths(startDate, m - 1);
      const interestPayment = balance * r;
      let principalPayment = basePayment - interestPayment;

      // Final payment may overshoot the remaining balance slightly.
      if (principalPayment > balance) principalPayment = balance;

      // ---- Extra payments ----
      let extra = 0;
      const extrasApply = !extraStartDate || date >= extraStartDate;
      if (extrasApply) {
        extra += extraMonthly;
        for (const oneTime of normalizedOneTimeExtras) {
          if (oneTime.amount > 0 && oneTime.date && Calc.sameMonth(date, oneTime.date)) {
            extra += oneTime.amount;
          }
        }
        if (annualExtra.amount > 0 && annualExtra.month && (date.getMonth() + 1) === annualExtra.month) {
          extra += annualExtra.amount;
        }
      }

      // Don't let principal + extra exceed the remaining balance.
      let totalPrincipal = principalPayment + extra;
      if (totalPrincipal > balance) {
        totalPrincipal = balance;
        extra = Math.max(0, totalPrincipal - principalPayment);
        if (extra === 0) principalPayment = totalPrincipal;
      }

      balance = Math.max(balance - totalPrincipal, 0);
      cumulativeInterest += interestPayment;
      cumulativePrincipal += totalPrincipal;

      // ---- PMI tracking ----
      // PMI is charged for the month if it was still active going into the
      // payment; it drops off once the ENDING balance reaches the removal LTV.
      let pmiThisMonth = pmiActive ? annualPMI / 12 : 0;
      const endingLTV = (balance / purchasePrice) * 100;
      if (pmiActive && endingLTV <= pmiRemovalLTV) {
        pmiActive = false;
      }

      schedule.push({
        month: m,
        date,
        payment: interestPayment + principalPayment + extra,
        principal: principalPayment,
        extraPrincipal: extra,
        totalPrincipal,
        interest: interestPayment,
        pmi: pmiThisMonth,
        balance,
        cumulativeInterest,
        cumulativePrincipal,
        ltv: endingLTV,
      });
    }

    return schedule;
  },

  /**
   * Compares a "baseline" schedule (no extra payments) against a schedule
   * that includes extra payments, and summarizes the savings.
   */
  compareSchedules(baseSchedule, extraSchedule) {
    const baseMonths = baseSchedule.length;
    const extraMonths = extraSchedule.length;
    const baseTotalInterest = baseSchedule.length
      ? baseSchedule[baseSchedule.length - 1].cumulativeInterest : 0;
    const extraTotalInterest = extraSchedule.length
      ? extraSchedule[extraSchedule.length - 1].cumulativeInterest : 0;

    const monthsSaved = baseMonths - extraMonths;

    return {
      baseMonths,
      extraMonths,
      monthsSaved,
      yearsSaved: monthsSaved / 12,
      interestSaved: baseTotalInterest - extraTotalInterest,
      baseTotalInterest,
      extraTotalInterest,
      basePayoffDate: baseSchedule.length ? baseSchedule[baseSchedule.length - 1].date : null,
      extraPayoffDate: extraSchedule.length ? extraSchedule[extraSchedule.length - 1].date : null,
    };
  },

  /** Find the first row where LTV drops to/below `threshold` (e.g. 80). Returns null if never. */
  findPMIRemovalRow(schedule, threshold = 80) {
    return schedule.find(row => row.ltv <= threshold) || null;
  },

  /** Roll a monthly schedule up into one row per calendar year (for a compact summary table). */
  toAnnualSummary(schedule) {
    const years = [];
    let current = null;
    for (const row of schedule) {
      const yearLabel = row.date.getFullYear();
      if (!current || current.year !== yearLabel) {
        if (current) years.push(current);
        current = {
          year: yearLabel,
          principal: 0,
          interest: 0,
          extra: 0,
          pmi: 0,
          payments: 0,
          endingBalance: row.balance,
          startMonth: row.month,
        };
      }
      current.principal += row.principal;
      current.interest += row.interest;
      current.extra += row.extraPrincipal;
      current.pmi += row.pmi;
      current.payments += row.payment + row.pmi;
      current.endingBalance = row.balance;
      current.endMonth = row.month;
    }
    if (current) years.push(current);
    return years;
  },
};

window.Amortization = Amortization;
