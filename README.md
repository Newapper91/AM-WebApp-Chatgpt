# Mortgage & Amortization Calculator

A local, no-install mortgage calculator covering loan basics, PITI, DTI,
cash-to-close, a full amortization schedule, extra-payment savings, a
down-payment scenario comparison, an affordability estimator, and a
refinance / discount-points break-even tool.

## How to run it

No installation, build step, or internet connection is required.

1. Open the `mortgage-calculator` folder.
2. Double-click `index.html` (or right-click → Open With → your browser).

That's it — everything runs locally in your browser using plain HTML,
CSS, and JavaScript. Your numbers are never sent anywhere.

**Optional (only if double-clicking causes browser security warnings):**
some browsers restrict file:// pages slightly. If you ever run into that,
you can serve the folder locally instead. From a terminal inside the
`mortgage-calculator` folder:

```
python3 -m http.server 8000
```

then open `http://localhost:8000` in your browser. This is optional —
opening `index.html` directly works in virtually all cases.

## What's inside

```
mortgage-calculator/
├── index.html          All page markup — six tabs (described below)
├── css/
│   └── styles.css      All styling (the "ledger" visual theme)
└── js/
    ├── calculations.js   Core formulas: payment, LTV, PMI, DTI, closing costs
    ├── amortization.js   Month-by-month schedule generator + comparisons
    ├── affordability.js  "How much house can I afford?" solver
    ├── refinance.js       Refinance and discount-points break-even math
    ├── scenarios.js      Down-payment scenario comparison engine
    ├── formatters.js     Currency / percent / date display helpers
    ├── export.js         CSV export of the amortization schedule
    ├── ui.js              Renders all results, tables, and charts to the page
    └── main.js            Wires inputs to calculations and re-renders on change
```

Everything recalculates live as you type — there's no "Calculate" button
to press.

## The six tabs

1. **Calculator** — Enter purchase price, down payment ($ or %), rate,
   term (including a custom term), start date, property tax, insurance,
   HOA, and PMI (auto-estimated or manually overridden). See your loan
   amount, LTV, full monthly PITI breakdown, total interest/total paid,
   payoff date, PMI removal date, front-end/back-end DTI, and a
   cash-to-close breakdown (down payment + closing costs + prepaid
   escrow). Closing costs can be entered as a percent of price or a flat
   dollar amount.

2. **Amortization Schedule** — The full month-by-month (or year-by-year)
   schedule, plus a balance-over-time chart. Toggle between monthly and
   annual views, and export the schedule to CSV (opens directly in Excel,
   Numbers, or Google Sheets).

3. **Extra Payments** — Add a recurring monthly extra payment, a one-time
   lump sum on a specific date, and/or a recurring annual extra payment
   (e.g. from a tax refund or bonus). Compare the "with extra payments"
   schedule against the baseline: time saved, interest saved, and new
   payoff date, with a cumulative-interest comparison chart.

4. **Scenario Comparison** — Compare 5% / 10% / 20% down payment presets
   (or any custom set of down payments you add) side-by-side: loan
   amount, LTV, monthly P&I, estimated PMI, full PITI, payoff date, total
   interest, and total paid.

5. **Affordability** — Enter your gross monthly income, other monthly
   debts, target DTI, rate, term, and estimated tax/insurance rates to
   get an estimated maximum home price, corresponding loan amount, down
   payment, and resulting monthly payment breakdown.

6. **Refinance & Points** — Compare your current loan against a new rate/
   term to see monthly savings, lifetime interest difference, and
   break-even point on refinance costs. The Points calculator shows the
   break-even time for buying discount points to lower your rate. A
   "Use loan amount & rate from Calculator tab" button carries values
   over from the main tab.

## Notes on accuracy

- PMI is auto-estimated at roughly 0.55% of the loan balance per year
  when the down payment is below 20%, and is automatically dropped once
  the loan balance reaches 80% LTV (configurable). You can override the
  PMI amount manually if your lender quotes you a different figure.
- All calculations use standard amortization formulas. This tool is for
  planning and estimation — always confirm final numbers with your
  lender, as actual loan terms, fees, and PMI rates vary.

## Extending this into a full app later

The calculation logic (`calculations.js`, `amortization.js`,
`affordability.js`, `refinance.js`, `scenarios.js`) is plain,
dependency-free JavaScript with no DOM references, so it can be reused
as-is in a future Node/React/mobile version — only `ui.js` and `main.js`
(the DOM-binding layer) would need to be replaced.

## ChatGPT version notes

- Restored support for multiple one-time extra principal payments. Use the `+ Add one-time payment` button to add separate payments in different months.
- Refinance comparison now uses the original loan amount and original term to keep the current P&I payment fixed, while the current balance is used as the refinance amount.
- Refinance comparison can optionally include the monthly, one-time, and annual extra payments from the Calculator tab.
