/**
 * affordability.js
 * -----------------
 * "How much house can I afford?" estimator.
 *
 * Given income, debts, a target back-end DTI, and assumptions about
 * down payment %, rate, term, tax rate, insurance, HOA and PMI, this
 * performs a binary search over purchase price to find the largest price
 * whose total monthly housing payment keeps back-end DTI at or below the
 * target.
 *
 * A binary search is used (rather than solving algebraically) because
 * property tax and PMI both scale with price/loan amount, which makes a
 * direct formula messy. Binary search keeps the logic simple, transparent,
 * and easy to verify by hand - 60 iterations converges to well under a
 * cent of precision on realistic price ranges.
 */

const Affordability = {

  /**
   * @param {Object} p
   * @param {number} p.grossMonthlyIncome
   * @param {number} p.otherMonthlyDebts
   * @param {number} p.targetBackEndDTI   e.g. 36 (%)
   * @param {number} p.downPaymentPct     e.g. 10 (%)
   * @param {number} p.annualRatePct
   * @param {number} p.termYears
   * @param {number} p.propertyTaxRatePct annual property tax as % of price, e.g. 1.1
   * @param {number} p.annualInsurance    flat annual estimate, dollars
   * @param {number} p.monthlyHOA
   * @param {number} [p.manualAnnualPMI]  optional override
   * @returns {Object} { maxPrice, maxLoanAmount, monthlyPI, monthlyTax,
   *                      monthlyInsurance, monthlyPMI, totalMonthlyHousing,
   *                      backEndDTI, frontEndDTI }
   */
  estimateMaxPrice(p) {
    const {
      grossMonthlyIncome,
      otherMonthlyDebts,
      targetBackEndDTI,
      downPaymentPct,
      annualRatePct,
      termYears,
      propertyTaxRatePct,
      annualInsurance,
      monthlyHOA,
      manualAnnualPMI,
    } = p;

    const targetHousingPayment = Math.max(
      (grossMonthlyIncome * (targetBackEndDTI / 100)) - otherMonthlyDebts,
      0
    );

    // Binary search bounds: $0 to a generous upper bound based on income.
    let lo = 0;
    let hi = Math.max(grossMonthlyIncome * 300, 100000); // generous ceiling
    let best = 0;

    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const housing = this._housingPaymentForPrice(mid, p);
      if (housing <= targetHousingPayment) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const maxPrice = best;
    const downPayment = Calc.downPaymentFromPercent(maxPrice, downPaymentPct);
    const loanAmount = Calc.loanAmount(maxPrice, downPayment);
    const monthlyPI = Calc.monthlyPI(loanAmount, annualRatePct, termYears);
    const monthlyTax = (maxPrice * (propertyTaxRatePct / 100)) / 12;
    const monthlyInsurance = annualInsurance / 12;
    const annualPMI = Calc.estimatePMI(loanAmount, downPaymentPct, manualAnnualPMI);
    const monthlyPMI = annualPMI / 12;
    const totalMonthlyHousing = monthlyPI + monthlyTax + monthlyInsurance + monthlyPMI + monthlyHOA;

    return {
      maxPrice,
      maxLoanAmount: loanAmount,
      downPayment,
      monthlyPI,
      monthlyTax,
      monthlyInsurance,
      monthlyPMI,
      monthlyHOA,
      totalMonthlyHousing,
      frontEndDTI: Calc.frontEndDTI(totalMonthlyHousing, grossMonthlyIncome),
      backEndDTI: Calc.backEndDTI(totalMonthlyHousing, otherMonthlyDebts, grossMonthlyIncome),
    };
  },

  /** Internal helper: total monthly housing payment for a hypothetical price. */
  _housingPaymentForPrice(price, p) {
    const downPayment = Calc.downPaymentFromPercent(price, p.downPaymentPct);
    const loanAmount = Calc.loanAmount(price, downPayment);
    const pAndI = Calc.monthlyPI(loanAmount, p.annualRatePct, p.termYears);
    const monthlyTax = (price * (p.propertyTaxRatePct / 100)) / 12;
    const monthlyInsurance = p.annualInsurance / 12;
    const annualPMI = Calc.estimatePMI(loanAmount, p.downPaymentPct, p.manualAnnualPMI);
    return pAndI + monthlyTax + monthlyInsurance + (annualPMI / 12) + p.monthlyHOA;
  },
};

window.Affordability = Affordability;
