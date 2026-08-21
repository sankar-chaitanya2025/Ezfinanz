'use client'

import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EmiTermSelectorProps {
  applicationId: string
  initialAmount: number
  initialTenure: number
  interestRate?: number
}

// Simple PMT calculation
function calculateEMI(principal: number, ratePerAnnum: number, months: number) {
  const r = ratePerAnnum / 12 / 100;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function EmiTermSelector({ applicationId, initialAmount, initialTenure, interestRate = 18 }: EmiTermSelectorProps) {
  const [amount, setAmount] = useState<number>(initialAmount)
  const [tenure, setTenure] = useState<number>(initialTenure)

  const emi = Math.round(calculateEMI(amount, interestRate, tenure))
  const totalRepayment = Math.round(emi * tenure)
  const totalInterest = Math.round(totalRepayment - amount)
  const processingFee = Math.round(amount * 0.02)
  const gst = Math.round(processingFee * 0.18)
  const netDisbursement = Math.round(amount - processingFee - gst)

  return (
    <div className="space-y-6">
      <input type="hidden" name="applicationId" value={applicationId} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="requestedAmount">Final Amount (₹)</Label>
          <Input 
            id="requestedAmount"
            type="number" 
            name="requestedAmount" 
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min="10000"
            max={initialAmount}
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="requestedTenure">Tenure (Months)</Label>
          <select 
            id="requestedTenure"
            name="requestedTenure" 
            value={tenure}
            onChange={(e) => setTenure(Number(e.target.value))}
            required 
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {[6, 12, 18, 24, 36, 48, 60].map(t => <option key={t} value={t}>{t} Months</option>)}
          </select>
        </div>
      </div>

      <Card className="bg-muted/40 shadow-none border-emerald-200/60">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-semibold">Loan Breakdown Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground font-medium">Interest Rate (IRR)</p>
              <p className="font-bold">{interestRate}% p.a.</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Monthly EMI</p>
              <p className="font-bold text-emerald-600 text-lg">₹{emi.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Processing Fee (2%)</p>
              <p className="font-bold">₹{processingFee.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">GST on Fee (18%)</p>
              <p className="font-bold">₹{gst.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Total Interest</p>
              <p className="font-bold">₹{totalInterest.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Total Repayment</p>
              <p className="font-bold">₹{totalRepayment.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center bg-emerald-50/50 p-3 rounded-lg dark:bg-emerald-950/20">
            <span className="font-bold">Net Disbursement</span>
            <span className="font-black text-emerald-600 text-xl">₹{netDisbursement.toLocaleString('en-IN')}</span>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
        Calculate & Accept Terms
      </Button>
    </div>
  )
}
