/**
 * calculations.js
 * ----------------
 * Pure mortgage math. No DOM access here on purpose - these functions take
 * plain numbers/objects and return plain numbers/objects. That makes them
 * easy to unit test, reuse in a future backend, or port into a React app.
 *
 * All monetary values are plain numbers (dollars). All rates are stored as
 * PERCENTAGES (e.g. 6.5 means 6.5%), and converted to decimals inside the
 * functions that need them.
 */

const Calc = {

  /** Convert an annual percentage rate to a decimal monthly rate. */
  monthlyRate(annualRatePct) {
    return (annualRatePct / 100) / 12;
  },

  /** Loan amount = purchase price - down payment. Never negative. */
  loanAmount(purchasePrice, downPaymentAmount) {
    return Math.max(purchasePrice - downPaymentAmount, 0);
  },

  /** Down payment as a percent of purchase price. */
  downPaymentPercent(downPaymentAmount, purchasePrice) {
    return purchasePrice > 0 ? (downPaymentAmount / purchasePrice) * 100 : 0;
  },

  /** Down payment amount from a target percent of purchase price. */
  downPaymentFromPercent(purchasePrice, percent) {
    return purchasePrice * (percent / 100);
  },

  /**
   * Loan-to-Value ratio (%) = loan amount / purchase price.
   * This is the "as of closing" LTV. Each amortization row recomputes this
   * using the *current balance* vs. the *original purchase price*.
   */
  ltv(loanAmount, purchasePrice) {
    return purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  },

  /**
   * Standard fixed-rate mortgage payment formula (Principal & Interest only):
   *
   *   M = P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
   *
   * Where:
   *   P = principal (loan amount)
   *   r = monthly interest rate (decimal)
   *   n = number of monthly payments (term in years * 12)
   *
   * If r is 0 (a 0% loan), this degrades to a simple even split: P / n.
   */
  monthlyPI(principal, annualRatePct, termYears) {
    const r = this.monthlyRate(annualRatePct);
    const n = termYears * 12;
    if (n <= 0 || principal <= 0) return 0;
    if (r === 0) return principal / n;
    const factor = Math.pow(1 + r, n);
    return (principal * r * factor) / (factor - 1);
  },

  /**
   * Estimate annual PMI (Private Mortgage Insurance).
   * PMI typically applies when the down payment is under 20% (LTV > 80%).
   *
   * - If `manualAnnualPMI` is provided (a number >= 0), it overrides the estimate.
   * - Otherwise, if down payment % >= 20, PMI is $0.
   * - Otherwise, PMI is estimated as a percentage of the LOAN amount per year.
   *   0.55% is a commonly-cited "typical" annual PMI rate (real rates vary
   *   roughly 0.3% - 1.5% based on credit score, LTV, and loan type).
   */
  estimatePMI(loanAmount, downPaymentPct, manualAnnualPMI) {
    if (manualAnnualPMI !== null && manualAnnualPMI !== undefined && !Number.isNaN(manualAnnualPMI)) {
      return Math.max(manualAnnualPMI, 0);
    }
    if (downPaymentPct >= 20) return 0;
    const ASSUMED_PMI_RATE = 0.0055; // 0.55% of loan amount per year
    return loanAmount * ASSUMED_PMI_RATE;
  },

  /**
   * Estimated closing costs.
   * method: 'percent' -> value is a % of purchase price (typical range 2-5%)
   * method: 'dollar'  -> value is a flat dollar amount
   */
  closingCosts(purchasePrice, method, value) {
    if (method === 'percent') return purchasePrice * (value / 100);
    return Math.max(value, 0);
  },

  /**
   * Estimated cash needed at closing.
   *   = down payment
   *   + closing costs
   *   + prepaid escrow (property tax + insurance for `prepaidMonths` months,
   *     a common lender "cushion" requirement, often ~2 months)
   *
   * HOA dues are generally NOT collected into escrow at closing, so they are
   * intentionally excluded from this estimate.
   */
  cashToClose({ downPayment, closingCosts, monthlyTax, monthlyInsurance, prepaidMonths }) {
    const escrowPrepaid = (monthlyTax + monthlyInsurance) * prepaidMonths;
    return {
      downPayment,
      closingCosts,
      escrowPrepaid,
      total: downPayment + closingCosts + escrowPrepaid,
    };
  },

  /** Front-end DTI (%) = housing payment (PITI) / gross monthly income. */
  frontEndDTI(piti, grossMonthlyIncome) {
    return grossMonthlyIncome > 0 ? (piti / grossMonthlyIncome) * 100 : 0;
  },

  /** Back-end DTI (%) = (housing payment + other monthly debts) / gross monthly income. */
  backEndDTI(piti, otherMonthlyDebts, grossMonthlyIncome) {
    return grossMonthlyIncome > 0 ? ((piti + otherMonthlyDebts) / grossMonthlyIncome) * 100 : 0;
  },

  /**
   * Total monthly housing payment (PITI + PMI + HOA).
   *   PITI = Principal & Interest + Taxes + Insurance
   * PMI and HOA are tracked separately so the schedule can drop PMI once
   * LTV reaches the removal threshold.
   */
  monthlyPITI({ pAndI, monthlyTax, monthlyInsurance }) {
    return pAndI + monthlyTax + monthlyInsurance;
  },

  /** Add `months` calendar months to a Date, returning a new Date. */
  addMonths(date, months) {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setDate(1); // avoid month-length overflow issues (e.g. Jan 31 + 1mo)
    d.setMonth(d.getMonth() + months);
    // Clamp the day back to the last valid day of the resulting month
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  },

  /** True if two Dates fall in the same calendar month & year. */
  sameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  },
};

// Make available to other scripts (loaded via plain <script> tags, no bundler)
window.Calc = Calc;
