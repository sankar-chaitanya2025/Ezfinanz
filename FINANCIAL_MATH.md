# EZFinanz: The Math & Financial Logic Explained

This document breaks down every mathematical formula and financial calculation used in the EZFinanz codebase. All of these calculations are deterministic and run purely on the backend to prevent frontend spoofing.

The logic is split into two primary engines:
1. **The Eligibility Engine** (`src/domain/eligibilityEngine.ts`): Determines *if* a user gets a loan, and the maximum amount they can afford.
2. **The Financial Calculator** (`src/domain/financialCalculator.ts`): Computes exact EMIs, fees, GST, and the Internal Rate of Return (IRR) for the selected loan.

---

## 1. The Underwriting Math (Eligibility Assessment)

When a user submits their financial details, we run strict rules to calculate their eligibility.

### Fixed Constants
*   **Annual Interest Rate**: 12% (`0.12`)
*   **Maximum Tenure**: 60 Months (5 Years)
*   **Max Debt-to-Income (DTI) Ratio**: 50%
*   **Minimum Monthly Income**: ₹15,000
*   **Minimum Credit Score**: 650

### Calculating the "Affordable EMI"
Before we can tell a user how much they can borrow, we must calculate how much debt they can safely handle every month. We use the **Debt-to-Income (DTI)** ratio.

`Max Allowed Total EMI` = `Monthly Income` × `Max DTI Percentage` (50%)

`Affordable EMI` = `Max Allowed Total EMI` - `Existing EMI Obligations`

**Example:**
*   Rahul earns **₹85,000/month**.
*   His Max Allowed Total EMI is 50% of ₹85,000 = **₹42,500**.
*   Rahul already pays a car loan EMI of **₹12,000**.
*   His Affordable EMI for a new EZFinanz loan is ₹42,500 - ₹12,000 = **₹30,500**.

*(If Affordable EMI ≤ 0, the user is immediately rejected for over-leverage).*

### Calculating Maximum Eligible Loan Amount (Present Value Formula)
Now that we know Rahul can afford to pay ₹30,500 every month for 60 months at a 12% annual interest rate, how much principal loan amount does that translate to today?

We use the standard Annuity Present Value (PV) formula:

$$P = \frac{E \times ((1 + r)^n - 1)}{r \times (1 + r)^n}$$

Where:
*   **$P$** = Maximum Eligible Principal Amount
*   **$E$** = Affordable EMI (₹30,500)
*   **$r$** = Monthly Interest Rate (12% / 12 = 1% or `0.01`)
*   **$n$** = Total Months (60)

Plugging in Rahul's numbers:
$$P = \frac{30500 \times ((1.01)^{60} - 1)}{0.01 \times (1.01)^{60}} \approx ₹13,71,123$$

The system rounds this and approves Rahul for a maximum loan of ~₹13.71 Lakhs.

---

## 2. Loan Terms Math (Generating the Final Quote)

When Rahul is approved for ₹13.71 Lakhs, he uses the UI slider to request exactly **₹3,00,000 over 24 months**. We now must calculate the exact terms.

### 2.1 The EMI Formula
To find the exact monthly payment for ₹3,00,000 over 24 months, we use the reducing-balance EMI formula:

$$E = \frac{P \times r \times (1 + r)^n}{(1 + r)^n - 1}$$

Where:
*   **$P$** = Requested Principal (₹3,00,000)
*   **$r$** = Monthly Rate (12% / 12 = 0.01)
*   **$n$** = Tenure (24 months)

$$E = \frac{300000 \times 0.01 \times (1.01)^{24}}{(1.01)^{24} - 1} = ₹14,122.05$$

**EMI: ₹14,122.05**

### 2.2 Processing Fees & Deductions
EZFinanz charges an upfront processing fee, which is deducted *before* disbursing the money to the user's bank account.

*   **Processing Fee (PF) Rate**: 2% of Principal
    *   PF = ₹3,00,000 × 0.02 = **₹6,000**
*   **GST on Processing Fee**: 18% of PF
    *   GST = ₹6,000 × 0.18 = **₹1,080**
*   **Total Upfront Charges**: PF + GST = **₹7,080**

### 2.3 Net Disbursement
This is the actual amount that hits Rahul's bank account (Penny Drop verification ensures it goes to the right place).

*   `Net Disbursement` = `Principal` - `Total Upfront Charges`
*   Net Disbursement = ₹3,00,000 - ₹7,080 = **₹2,92,920**

### 2.4 Total Repayment & Total Interest
How much will Rahul pay back in total over the 24 months?

*   `Total Repayment` = `EMI` × `Tenure`
    *   Total Repayment = ₹14,122.05 × 24 = **₹3,38,929.20**
*   `Total Interest` = `Total Repayment` - `Principal`
    *   Total Interest = ₹3,38,929.20 - ₹3,00,000 = **₹38,929.20**

---

## 3. Calculating the True Cost of the Loan: IRR (Internal Rate of Return)

While the *stated* interest rate is 12% annually, the *actual* cost to the borrower is higher because we deducted ₹7,080 in fees upfront. 

Rahul only received **₹2,92,920** in hand, but he is making payments as if he borrowed the full **₹3,00,000**.

To calculate the true Annualized IRR, the system solves for the discount rate ($r$) that makes the Net Present Value (NPV) equal to exactly zero.

$$0 = -NetDisbursement + \sum_{t=1}^{n} \frac{EMI}{(1+r)^t}$$

Since this equation cannot be algebraically rearranged to solve for $r$, `FinancialCalculator.calculateIRR()` uses an iterative root-finding algorithm (like the Bisection method or Newton-Raphson) to hone in on the exact monthly rate $r$. 

Once $r$ is found, we multiply it by 12 to get the Annualized IRR. 

For Rahul's loan, while the stated interest rate is **12%**, the actual IRR (true cost) will be closer to **~14.5%**. This IRR value is saved directly to the `loan_terms` database table to ensure compliance with transparent lending regulations.
