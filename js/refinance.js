/**
 * refinance.js — ChatGPT version
 * --------------------------------
 * Fixes the refinance comparison so the current loan is modeled like a real
 * existing mortgage:
 *   - current P&I payment is based on the ORIGINAL loan amount/rate/term
 *   - current remaining balance is paid down using that fixed payment
 *   - changing the current balance no longer "recasts" the current loan
 *   - optional extra payments are applied on top of the fixed current payment
 */

const Refinance = {

  /**
   * Compare your existing loan against a hypothetical refinance.
   *
   * @param {Object} p
   * @param {number} p.originalLoanAmount
   * @param {number} p.originalTermYears
   * @param {number} p.currentRatePct
   * @param {number} p.currentBalance
   * @param {number} p.currentRemainingMonths
   * @param {number} p.newRatePct
   * @param {number} p.newTermYears
   * @param {number} p.refinanceCosts
   * @param {Object} [p.extras]
   */
  compare(p) {
    const originalLoanAmount = Number(p.originalLoanAmount) || 0;
    const currentBalance = Math.max(Number(p.currentBalance) || 0, 0);
    const originalTermYears = Math.max(Number(p.originalTermYears) || 0, 0);
    const currentRemainingMonths = Math.max(Number(p.currentRemainingMonths) || 1, 1);

    // Current payment should be the payment from the original mortgage.
    // Fallback keeps the calculator usable if older UI code does not pass original loan fields.
    const currentPayment = originalLoanAmount > 0 && originalTermYears > 0
      ? Calc.monthlyPI(originalLoanAmount, p.currentRatePct, originalTermYears)
      : Calc.monthlyPI(currentBalance, p.currentRatePct, currentRemainingMonths / 12);

    // New payment is calculated from the balance being refinanced.
    const newPayment = Calc.monthlyPI(currentBalance, p.newRatePct, p.newTermYears);

    const monthlySavings = currentPayment - newPayment;
    const breakEvenMonths = monthlySavings > 0 ? p.refinanceCosts / monthlySavings : null;

    const usingExtras = !!(p.extras && p.extras.startDate);

    const currentSchedule = this._generateFixedPaymentSchedule({
      loanAmount: currentBalance,
      annualRatePct: p.currentRatePct,
      fixedPayment: currentPayment,
      startDate: usingExtras ? p.extras.startDate : new Date(),
      maxMonths: Math.max(currentRemainingMonths + 12, 12 * 60),
      extras: usingExtras ? p.extras : null,
    });

    let newSchedule;
    if (usingExtras) {
      newSchedule = Amortization.generateSchedule({
        loanAmount: currentBalance,
        annualRatePct: p.newRatePct,
        termYears: p.newTermYears,
        startDate: p.extras.startDate,
        purchasePrice: currentBalance || 1,
        extraMonthly: p.extras.extraMonthly || 0,
        oneTimeExtras: p.extras.oneTimeExtras || [],
        annualExtra: p.extras.annualExtra || { amount: 0, month: null },
        extraStartDate: p.extras.extraStartDate || null,
      });
    } else {
      newSchedule = Amortization.generateSchedule({
        loanAmount: currentBalance,
        annualRatePct: p.newRatePct,
        termYears: p.newTermYears,
        startDate: new Date(),
        purchasePrice: currentBalance || 1,
      });
    }

    const totalInterestCurrent = currentSchedule.length
      ? currentSchedule[currentSchedule.length - 1].cumulativeInterest
      : 0;
    const totalInterestNew = newSchedule.length
      ? newSchedule[newSchedule.length - 1].cumulativeInterest
      : 0;

    return {
      currentPayment,
      newPayment,
      monthlySavings,
      totalInterestCurrent,
      totalInterestNew,
      lifetimeInterestDifference: totalInterestCurrent - totalInterestNew,
      breakEvenMonths,
      breakEvenYears: breakEvenMonths !== null ? breakEvenMonths / 12 : null,
      usingExtras,
      currentPayoffMonths: currentSchedule.length,
      newPayoffMonths: newSchedule.length,
    };
  },

  /**
   * Pay down a current loan using a fixed existing payment.
   * This is intentionally separate from Amortization.generateSchedule(), because
   * that function recalculates the payment from loanAmount + term. For an existing
   * loan, the payment is already set by the original note.
   */
  _generateFixedPaymentSchedule({ loanAmount, annualRatePct, fixedPayment, startDate, maxMonths, extras }) {
    const r = Calc.monthlyRate(annualRatePct);
    let balance = Math.max(Number(loanAmount) || 0, 0);
    let cumulativeInterest = 0;
    let cumulativePrincipal = 0;
    const schedule = [];

    const extraMonthly = extras?.extraMonthly || 0;
    const oneTimeExtras = extras?.oneTimeExtras || [];
    const annualExtra = extras?.annualExtra || { amount: 0, month: null };
    const extraStartDate = extras?.extraStartDate || null;
    const firstDate = startDate || new Date();
    const HARD_CAP = Math.max(Math.ceil(maxMonths || 0), 12 * 60);

    for (let m = 1; m <= HARD_CAP; m++) {
      if (balance <= 0.005) break;

      const date = Calc.addMonths(firstDate, m - 1);
      const interestPayment = balance * r;

      let principalPayment = fixedPayment - interestPayment;
      if (principalPayment < 0) principalPayment = 0;
      if (principalPayment > balance) principalPayment = balance;

      let extra = 0;
      const extrasApply = !extraStartDate || date >= extraStartDate;
      if (extrasApply) {
        extra += extraMonthly;
        for (const ote of oneTimeExtras) {
          if (ote && ote.amount > 0 && ote.date && Calc.sameMonth(date, ote.date)) {
            extra += ote.amount;
          }
        }
        if (annualExtra.amount > 0 && annualExtra.month && (date.getMonth() + 1) === annualExtra.month) {
          extra += annualExtra.amount;
        }
      }

      let totalPrincipal = principalPayment + extra;
      if (totalPrincipal > balance) {
        totalPrincipal = balance;
        extra = Math.max(0, totalPrincipal - principalPayment);
        if (extra === 0) principalPayment = totalPrincipal;
      }

      // Safety: if the payment cannot even cover the interest and there are no
      // effective extras, stop instead of looping forever with a growing balance.
      if (totalPrincipal <= 0 && interestPayment > 0) {
        cumulativeInterest += interestPayment;
        schedule.push({
          month: m,
          date,
          payment: fixedPayment,
          principal: 0,
          extraPrincipal: 0,
          totalPrincipal: 0,
          interest: interestPayment,
          balance,
          cumulativeInterest,
          cumulativePrincipal,
        });
        break;
      }

      balance = Math.max(balance - totalPrincipal, 0);
      cumulativeInterest += interestPayment;
      cumulativePrincipal += totalPrincipal;

      schedule.push({
        month: m,
        date,
        payment: interestPayment + principalPayment + extra,
        principal: principalPayment,
        extraPrincipal: extra,
        totalPrincipal,
        interest: interestPayment,
        balance,
        cumulativeInterest,
        cumulativePrincipal,
      });
    }

    return schedule;
  },

  /** Buying discount points break-even. */
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
