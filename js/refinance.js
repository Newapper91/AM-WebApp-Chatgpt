/**
 * refinance.js
 * -------------
 * Two related "is this worth it" calculators:
 *
 *  1. Refinance comparison: compare your CURRENT remaining loan to a
 *     hypothetical NEW loan (new rate/term/closing costs) and find the
 *     break-even point.
 *
 *  2. Buying points: compare your loan's rate WITHOUT points to the same
 *     loan WITH a lower rate bought via discount points, and find the
 *     break-even point.
 *
 * Both use the same core idea: divide the up-front cost by the monthly
 * savings to get "months to break even".
 */

const Refinance = {

  /**
   * @param {Object} p
   * @param {number} p.currentBalance     remaining balance to refinance
   * @param {number} p.currentRatePct     rate on the CURRENT loan
   * @param {number} p.currentRemainingMonths  months left on current loan, used only as a fallback estimate
   * @param {number} p.currentMonthlyPayment  actual current P&I payment, if known
   * @param {number} p.newRatePct         rate on the NEW loan
   * @param {number} p.newTermYears       term of the NEW loan (restarts amortization)
   * @param {number} p.refinanceCosts     closing costs for the new loan ($)
   * @param {number} p.originalLoanAmount original loan amount from the Calculator tab
   * @param {number} p.originalTermYears  original term from the Calculator tab
   * @param {Date}   p.originalStartDate  original first-payment date
   * @param {number} p.purchasePrice      purchase price, used only for schedule metadata
   * @param {boolean} p.includeExtraPayments whether to include Calculator-tab extra payments
   */
  compare(p) {
    const originalLoanAmount = p.originalLoanAmount > 0 ? p.originalLoanAmount : p.currentBalance;
    const originalTermYears = p.originalTermYears > 0 ? p.originalTermYears : (p.currentRemainingMonths / 12);
    const originalStartDate = p.originalStartDate || new Date();
    const purchasePrice = p.purchasePrice > 0 ? p.purchasePrice : originalLoanAmount;
    const originalTermMonths = Math.max(1, Math.round(originalTermYears * 12));
    const currentRemainingMonths = Math.max(1, Math.round(p.currentRemainingMonths));
    const elapsedMonths = Math.min(originalTermMonths, Math.max(0, originalTermMonths - currentRemainingMonths));
    const refiStartDate = Calc.addMonths(originalStartDate, elapsedMonths);

    const fallbackPayment = Calc.monthlyPI(p.currentBalance, p.currentRatePct, p.currentRemainingMonths / 12);
    const currentPayment = p.currentMonthlyPayment > 0 ? p.currentMonthlyPayment : fallbackPayment;
    const newPayment = Calc.monthlyPI(p.currentBalance, p.newRatePct, p.newTermYears);

    const monthlySavings = currentPayment - newPayment;

    const extraArgs = p.includeExtraPayments ? {
      extraMonthly: p.extraMonthly || 0,
      oneTimeExtra: p.oneTimeExtra || { amount: 0, date: null },
      annualExtra: p.annualExtra || { amount: 0, month: null },
      extraStartDate: p.extraStartDate || null,
    } : {};

    const originalBaseSchedule = Amortization.generateSchedule({
      loanAmount: originalLoanAmount,
      annualRatePct: p.currentRatePct,
      termYears: originalTermYears,
      startDate: originalStartDate,
      purchasePrice,
      annualPMI: 0,
      pmiRemovalLTV: 80,
    });

    const originalComparisonSchedule = p.includeExtraPayments
      ? Amortization.generateSchedule({
          loanAmount: originalLoanAmount,
          annualRatePct: p.currentRatePct,
          termYears: originalTermYears,
          startDate: originalStartDate,
          purchasePrice,
          annualPMI: 0,
          pmiRemovalLTV: 80,
          ...extraArgs,
        })
      : originalBaseSchedule;

    const currentFutureSchedule = Amortization.generateSchedule({
      loanAmount: p.currentBalance,
      annualRatePct: p.currentRatePct,
      termYears: currentRemainingMonths / 12,
      startDate: refiStartDate,
      purchasePrice,
      annualPMI: 0,
      pmiRemovalLTV: 80,
      basePaymentOverride: currentPayment,
      ...extraArgs,
    });

    const newFutureSchedule = Amortization.generateSchedule({
      loanAmount: p.currentBalance,
      annualRatePct: p.newRatePct,
      termYears: p.newTermYears,
      startDate: refiStartDate,
      purchasePrice,
      annualPMI: 0,
      pmiRemovalLTV: 80,
      ...extraArgs,
    });

    const originalTotalInterest = this.totalInterest(originalBaseSchedule);
    const interestPaidToDate = this.interestThrough(originalComparisonSchedule, elapsedMonths);
    const totalInterestCurrent = p.includeExtraPayments
      ? interestPaidToDate + this.totalInterest(currentFutureSchedule)
      : originalTotalInterest;
    const totalInterestNew = interestPaidToDate + this.totalInterest(newFutureSchedule);

    const breakEvenMonths = monthlySavings > 0 ? p.refinanceCosts / monthlySavings : null;

    return {
      currentPayment,
      newPayment,
      monthlySavings,
      totalInterestCurrent,
      totalInterestNew,
      lifetimeInterestDifference: totalInterestCurrent - totalInterestNew,
      breakEvenMonths,
      breakEvenYears: breakEvenMonths !== null ? breakEvenMonths / 12 : null,
      currentPayoffMonths: currentFutureSchedule.length,
      newPayoffMonths: newFutureSchedule.length,
      elapsedMonths,
      interestPaidToDate,
    };
  },

  totalInterest(schedule) {
    return schedule.length ? schedule[schedule.length - 1].cumulativeInterest : 0;
  },

  interestThrough(schedule, months) {
    return schedule
      .slice(0, Math.max(0, Math.min(months, schedule.length)))
      .reduce((sum, row) => sum + row.interest, 0);
  },

  /**
   * Pay down an existing balance with a fixed current payment. This is used
   * for refinance comparisons where the existing mortgage payment should stay
   * static even when the remaining balance changes.
   */
  remainingPayoff({ balance, annualRatePct, monthlyPayment }) {
    const r = Calc.monthlyRate(annualRatePct);
    let remaining = Math.max(balance, 0);
    let totalInterest = 0;
    let months = 0;

    if (remaining <= 0) return { months: 0, totalInterest: 0 };
    if (monthlyPayment <= 0) return { months: Infinity, totalInterest: Infinity };

    while (remaining > 0.005 && months < 1200) {
      const interest = remaining * r;
      if (monthlyPayment <= interest) {
        return { months: Infinity, totalInterest: Infinity };
      }

      const principal = Math.min(monthlyPayment - interest, remaining);
      totalInterest += interest;
      remaining -= principal;
      months += 1;
    }

    return { months, totalInterest };
  },

  /**
   * Buying discount points break-even.
   * 1 "point" = 1% of the loan amount, paid up front, in exchange for a
   * lower interest rate.
   *
   * @param {Object} p
   * @param {number} p.loanAmount
   * @param {number} p.termYears
   * @param {number} p.originalRatePct   rate WITHOUT points
   * @param {number} p.discountedRatePct rate WITH points (lower)
   * @param {number} p.points            number of points purchased (e.g. 1.5)
   */
  pointsBreakEven(p) {
    const cost = p.loanAmount * (p.points / 100);
    const originalPayment = Calc.monthlyPI(p.loanAmount, p.originalRatePct, p.termYears);
    const discountedPayment = Calc.monthlyPI(p.loanAmount, p.discountedRatePct, p.termYears);
    const monthlySavings = originalPayment - discountedPayment;
    const breakEvenMonths = monthlySavings > 0 ? cost / monthlySavings : null;

    return {
      cost,
      originalPayment,
      discountedPayment,
      monthlySavings,
      breakEvenMonths,
      breakEvenYears: breakEvenMonths !== null ? breakEvenMonths / 12 : null,
    };
  },
};

window.Refinance = Refinance;
