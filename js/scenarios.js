/**
 * scenarios.js
 * -------------
 * Computes summary metrics for a single "scenario" - a what-if combination
 * of down payment %, interest rate, term, and extra monthly payment - using
 * shared assumptions (purchase price, taxes, insurance, HOA, PMI rules).
 *
 * Used by the "Scenario Comparison" tab to show several what-ifs side by
 * side (e.g. 5% vs 10% vs 20% down).
 */

const Scenarios = {

  /**
   * @param {Object} shared   Inputs common to all scenarios:
   *   { purchasePrice, annualTax, annualInsurance, monthlyHOA,
   *     manualAnnualPMI, startDate, pmiRemovalLTV }
   * @param {Object} override Scenario-specific inputs:
   *   { label, downPaymentPct, annualRatePct, termYears, extraMonthly }
   *
   * @returns {Object} a flat summary suitable for a comparison table row.
   */
  compute(shared, override) {
    const downPayment = Calc.downPaymentFromPercent(shared.purchasePrice, override.downPaymentPct);
    const loanAmount = Calc.loanAmount(shared.purchasePrice, downPayment);
    const ltv = Calc.ltv(loanAmount, shared.purchasePrice);
    const monthlyPI = Calc.monthlyPI(loanAmount, override.annualRatePct, override.termYears);
    const annualPMI = Calc.estimatePMI(loanAmount, override.downPaymentPct, shared.manualAnnualPMI);
    const monthlyTax = shared.annualTax / 12;
    const monthlyInsurance = shared.annualInsurance / 12;
    const monthlyPITI = monthlyPI + monthlyTax + monthlyInsurance + (annualPMI / 12) + shared.monthlyHOA;

    // Full schedule (no extras) - needed for accurate lifetime totals
    const baseSchedule = Amortization.generateSchedule({
      loanAmount,
      annualRatePct: override.annualRatePct,
      termYears: override.termYears,
      startDate: shared.startDate,
      purchasePrice: shared.purchasePrice,
      annualPMI,
      pmiRemovalLTV: shared.pmiRemovalLTV,
    });

    // Schedule WITH this scenario's extra monthly payment
    const extraSchedule = override.extraMonthly > 0
      ? Amortization.generateSchedule({
          loanAmount,
          annualRatePct: override.annualRatePct,
          termYears: override.termYears,
          startDate: shared.startDate,
          purchasePrice: shared.purchasePrice,
          annualPMI,
          pmiRemovalLTV: shared.pmiRemovalLTV,
          extraMonthly: override.extraMonthly,
        })
      : baseSchedule;

    const last = extraSchedule[extraSchedule.length - 1];
    const totalInterest = last ? last.cumulativeInterest : 0;
    const totalPrincipalPaid = last ? last.cumulativePrincipal : 0;
    const totalPMIPaid = extraSchedule.reduce((sum, row) => sum + row.pmi, 0);
    const totalPaid = totalInterest + totalPrincipalPaid + totalPMIPaid;

    return {
      label: override.label,
      downPayment,
      downPaymentPct: override.downPaymentPct,
      loanAmount,
      ltv,
      annualRatePct: override.annualRatePct,
      termYears: override.termYears,
      extraMonthly: override.extraMonthly,
      monthlyPI,
      monthlyPITI,
      annualPMI,
      payoffDate: last ? last.date : null,
      payoffMonths: extraSchedule.length,
      totalInterest,
      totalPaid,
    };
  },
};

window.Scenarios = Scenarios;
