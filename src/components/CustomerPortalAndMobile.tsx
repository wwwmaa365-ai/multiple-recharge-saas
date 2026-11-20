import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import {
  Smartphone,
  Tv,
  Zap,
  Flame,
  Droplets,
  Wifi,
  PhoneCall,
  Shield,
  Wallet,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Monitor,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  SimulatedTenantContext,
  buildRedactedAdapterPayload,
} from '../services/tenantEngine';

interface CustomerPortalAndMobileProps {
  currentUser: FirebaseUser | null;
  selectedTenant: SimulatedTenantContext;
  liveTenantOwnedByUser: boolean;
}

type ServiceCategory =
  | 'mobile_prepaid'
  | 'mobile_postpaid'
  | 'dth'
  | 'electricity'
  | 'gas'
  | 'water'
  | 'broadband'
  | 'landline'
  | 'insurance';

export interface ExecutedTransactionRecord {
  txId: string;
  tenantId: string;
  serviceType: ServiceCategory;
  operatorCode: string;
  circleCode: string;
  targetNumber: string;
  amountInr: number;
  status: 'Initiated' | 'Processing' | 'Pending' | 'Successful' | 'Failed' | 'Refunded';
  apiProvider: string;
  redactedResponse: string;
  idempotencyKey: string;
  createdAtIso: string;
}

const MOBILE_PLANS = [
  { amount: 199, validity: '28 Days', data: '1.5 GB/Day', desc: 'Unlimited Voice + 100 SMS/Day' },
  { amount: 299, validity: '28 Days', data: '2 GB/Day', desc: 'True 5G Unlimited + 100 SMS/Day' },
  { amount: 479, validity: '56 Days', data: '1.5 GB/Day', desc: 'Unlimited Voice + Roaming' },
  { amount: 719, validity: '84 Days', data: '2 GB/Day', desc: '84 Days Unlimited + OTT Bundle' },
  { amount: 2999, validity: '365 Days', data: '2.5 GB/Day', desc: 'Annual Flagship Plan' },
];

export function CustomerPortalAndMobile({
  currentUser,
  selectedTenant,
  liveTenantOwnedByUser,
}: CustomerPortalAndMobileProps) {
  const [viewportMode, setViewportMode] = useState<'web' | 'android' | 'ios'>('web');
  const [activeService, setActiveService] = useState<ServiceCategory>('mobile_prepaid');
  const [walletBalanceInr, setWalletBalanceInr] = useState<number>(3450);
  const [topupAmountInr, setTopupAmountInr] = useState<number>(1000);

  // Recharge / Bill Input State
  const [targetNumber, setTargetNumber] = useState<string>('9830054321');
  const [operatorCode, setOperatorCode] = useState<string>('JIO_PREPAID');
  const [circleCode, setCircleCode] = useState<string>('WEST_BENGAL');
  const [amountInr, setAmountInr] = useState<number>(299);
  const [fetchedBillInfo, setFetchedBillInfo] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Transaction Engine Ledger & Duplicate Prevention State
  const [transactions, setTransactions] = useState<ExecutedTransactionRecord[]>([
    {
      txId: `TX_${selectedTenant.tenantId.toUpperCase()}_8810`,
      tenantId: selectedTenant.tenantId,
      serviceType: 'mobile_prepaid',
      operatorCode: 'AIRTEL_PREPAID',
      circleCode: 'WEST_BENGAL',
      targetNumber: '9876543210',
      amountInr: 299,
      status: 'Successful',
      apiProvider: selectedTenant.apiProviderName,
      redactedResponse: '{"providerStatus":"SUCCESS","operatorRef":"AIR9928172"}',
      idempotencyKey: '9876543210_AIRTEL_PREPAID_299',
      createdAtIso: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);

  // Automatic Operator & Circle Detection on Mobile Number Input (Requirement 4)
  const handleNumberChange = (val: string) => {
    setTargetNumber(val);
    if (activeService === 'mobile_prepaid' || activeService === 'mobile_postpaid') {
      if (val.startsWith('9830') || val.startsWith('9831')) {
        setOperatorCode('AIRTEL_PREPAID');
        setCircleCode('KOLKATA_WB');
      } else if (val.startsWith('700') || val.startsWith('891')) {
        setOperatorCode('JIO_PREPAID');
        setCircleCode('WEST_BENGAL');
      } else if (val.startsWith('905') || val.startsWith('9836')) {
        setOperatorCode('VI_PREPAID');
        setCircleCode('WEST_BENGAL');
      }
    }
  };

  const handleFetchDthOrBbpsInfo = () => {
    if (targetNumber.trim().length < 5) {
      setFetchedBillInfo('Enter a valid Subscriber ID / Consumer Number first.');
      return;
    }
    setFetchedBillInfo(
      `Verified Consumer: SANJIT ENTERPRISE · Due Amount: ₹${amountInr} · Due Date: 28 Nov 2026`
    );
  };

  const handleAddMoneyToCustomerWallet = async () => {
    if (topupAmountInr <= 0) return;
    const nextBalance = walletBalanceInr + topupAmountInr;
    setWalletBalanceInr(nextBalance);
    setFeedbackBanner({
      type: 'success',
      message: `Added ₹${topupAmountInr.toLocaleString('en-IN')} via ${selectedTenant.businessName} isolated UPI Payment Gateway. New Customer Wallet Balance: ₹${nextBalance.toLocaleString('en-IN')}.`,
    });
  };

  // Requirement 7: Reliable Recharge Transaction Engine
  const handleExecuteRechargeOrBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);

    // 1. Check Tenant Subscription Expiry Gatekeeper (Requirement 10)
    const txId = `tx_${Date.now()}`;
    const adapterCheck = buildRedactedAdapterPayload(
      selectedTenant,
      targetNumber,
      operatorCode,
      amountInr,
      txId
    );

    if (!adapterCheck.canExecute) {
      setFeedbackBanner({
        type: 'error',
        message: adapterCheck.blockReason || 'Execution halted by tenant policy.',
      });
      return;
    }

    // 2. Duplicate Recharge Prevention (Idempotency Check - Requirement 7)
    const idempotencyKey = `${selectedTenant.tenantId}_${targetNumber}_${operatorCode}_${amountInr}`;
    const existingPendingOrRecent = transactions.find(
      (t) =>
        t.idempotencyKey === idempotencyKey &&
        (t.status === 'Initiated' || t.status === 'Processing' || t.status === 'Pending')
    );
    if (existingPendingOrRecent) {
      setFeedbackBanner({
        type: 'warning',
        message: `Duplicate Recharge Prevented: An active transaction (${existingPendingOrRecent.txId}) for ${targetNumber} (₹${amountInr}) is already in ${existingPendingOrRecent.status} state. Wallet is not debited twice.`,
      });
      return;
    }

    // 3. Check Customer Wallet Balance
    if (walletBalanceInr < amountInr) {
      setFeedbackBanner({
        type: 'error',
        message: `Insufficient customer wallet balance (₹${walletBalanceInr}). Please add money before initiating a ₹${amountInr} recharge.`,
      });
      return;
    }

    // 4. Debit Customer Wallet & Create Transaction in "Pending" state (Never fake instant success without provider webhook confirmation)
    const newBalance = walletBalanceInr - amountInr;
    setWalletBalanceInr(newBalance);

    const newRecord: ExecutedTransactionRecord = {
      txId,
      tenantId: selectedTenant.tenantId,
      serviceType: activeService,
      operatorCode,
      circleCode,
      targetNumber,
      amountInr,
      status: 'Pending',
      apiProvider: selectedTenant.apiProviderName,
      redactedResponse: JSON.stringify(adapterCheck.redactedPayload),
      idempotencyKey,
      createdAtIso: new Date().toISOString(),
    };

    setTransactions((prev) => [newRecord, ...prev]);

    // Persist to Firestore if authenticated and tenant exists in Firestore
    if (currentUser && liveTenantOwnedByUser) {
      const isBbps = !['mobile_prepaid', 'mobile_postpaid', 'dth'].includes(activeService);
      if (isBbps) {
        const path = `tenants/${selectedTenant.tenantId}/bill_payments/${txId}`;
        try {
          await setDoc(doc(db, 'tenants', selectedTenant.tenantId, 'bill_payments', txId), {
            billTxId: txId,
            tenantId: selectedTenant.tenantId,
            userUid: currentUser.uid,
            bbpsCategory: activeService,
            billerId: operatorCode.slice(0, 80),
            consumerNumber: targetNumber.slice(0, 60),
            customerName: (currentUser.displayName || 'Customer').slice(0, 120),
            amountInr,
            bbpsReferenceNo: `BBPS_${Date.now()}`,
            status: 'Pending',
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
        }
      } else {
        const path = `tenants/${selectedTenant.tenantId}/recharge_transactions/${txId}`;
        try {
          await setDoc(doc(db, 'tenants', selectedTenant.tenantId, 'recharge_transactions', txId), {
            txId,
            tenantId: selectedTenant.tenantId,
            userUid: currentUser.uid,
            actorRole: 'customer',
            serviceType: activeService,
            operatorCode: operatorCode.slice(0, 50),
            circleCode: circleCode.slice(0, 50),
            targetNumber: targetNumber.slice(0, 40),
            amountInr,
            status: 'Pending',
            apiProvider: selectedTenant.apiProviderName.slice(0, 80),
            redactedApiResponse: JSON.stringify(adapterCheck.redactedPayload).slice(0, 500),
            idempotencyKey: idempotencyKey.slice(0, 128),
            createdAt: serverTimestamp(),
            completedAt: 'AWAITING_PROVIDER_WEBHOOK',
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
        }
      }
    }

    setFeedbackBanner({
      type: 'warning',
      message: `Transaction ${txId} initiated via ${selectedTenant.apiProviderName}. Status: PENDING provider callback verification. Use the Webhook Reconciliation controls below to simulate verified provider confirmation or failure/refund.`,
    });
  };

  // Requirement 7: Provider Callback Verification & Idempotent Refund Handling
  const handleProviderWebhookCallback = (
    txId: string,
    outcome: 'Successful' | 'Failed'
  ) => {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.txId !== txId) return tx;
        // Terminal state guard: Never deduct or refund twice
        if (tx.status === 'Successful' || tx.status === 'Refunded') {
          return tx;
        }
        if (outcome === 'Successful') {
          setFeedbackBanner({
            type: 'success',
            message: `Verified Provider Webhook for ${txId}: Marked SUCCESSFUL with Operator Reference OP_${Date.now()}.`,
          });
          return {
            ...tx,
            status: 'Successful',
            redactedResponse: `{"webhookVerified":true,"status":"SUCCESS","operatorRef":"OP_${Date.now()}"}`,
          };
        } else {
          // Automatic idempotent refund to customer wallet
          setWalletBalanceInr((b) => b + tx.amountInr);
          setFeedbackBanner({
            type: 'warning',
            message: `Provider reported FAILURE for ${txId}. Automatically credited single idempotent REFUND of ₹${tx.amountInr} back to customer wallet.`,
          });
          return {
            ...tx,
            status: 'Refunded',
            redactedResponse: `{"webhookVerified":true,"status":"FAILED_AUTO_REFUNDED","refundedInr":${tx.amountInr}}`,
          };
        }
      })
    );
  };

  const handleDownloadReceipt = (tx: ExecutedTransactionRecord) => {
    const content = [
      `================================================`,
      `        ${selectedTenant.businessName.toUpperCase()}`,
      `        Domain: ${selectedTenant.customDomain}`,
      `================================================`,
      `Transaction ID  : ${tx.txId}`,
      `Tenant ID       : ${tx.tenantId}`,
      `Service Type    : ${tx.serviceType.toUpperCase()}`,
      `Operator / Bill : ${tx.operatorCode} (${tx.circleCode})`,
      `Subscriber No   : ${tx.targetNumber}`,
      `Amount (INR)    : Rs. ${tx.amountInr}`,
      `Status          : ${tx.status.toUpperCase()}`,
      `Timestamp       : ${tx.createdAtIso}`,
      `================================================`,
      `Powered by Recharge Expres Multi-Tenant Engine`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${tx.txId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Switch between Customer Website (App 5), Android App (App 3), and iOS App (App 4) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold font-mono text-sm shrink-0"
            style={{ backgroundColor: selectedTenant.primaryColor }}
          >
            {selectedTenant.logoText.slice(0, 2)}
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Automatic Domain Branding: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedTenant.customDomain}</span>
            </div>
            <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
              {selectedTenant.businessName} — Customer Web, Android &amp; iOS Experience
            </h2>
          </div>
        </div>

        {/* Viewport Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg self-start">
          {[
            { id: 'web', label: 'Customer Website (App 5)', icon: Monitor },
            { id: 'android', label: 'Android App (App 3)', icon: Smartphone },
            { id: 'ios', label: 'iOS App (App 4)', icon: Smartphone },
          ].map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setViewportMode(mode.id as 'web' | 'android' | 'ios')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  viewportMode === mode.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
              : feedbackBanner.type === 'warning'
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200'
              : 'bg-red-50/80 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : feedbackBanner.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="underline cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>
      )}

      {/* Main Layout container adapting to Web vs Mobile Android/iOS preview */}
      <div
        className={`mx-auto transition-all ${
          viewportMode === 'web'
            ? 'w-full'
            : 'max-w-[420px] border-4 border-slate-800 dark:border-slate-700 rounded-3xl p-4 bg-white dark:bg-slate-900 shadow-xl'
        }`}
      >
        {viewportMode !== 'web' && (
          <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-xl text-white text-xs font-mono" style={{ backgroundColor: selectedTenant.primaryColor }}>
            <span>{viewportMode === 'android' ? 'ANDROID APK v2.4' : 'iOS IPA v2.4'}</span>
            <span className="font-bold">{selectedTenant.logoText}</span>
            <span>₹{walletBalanceInr.toLocaleString('en-IN')}</span>
          </div>
        )}

        <div className={`grid grid-cols-1 ${viewportMode === 'web' ? 'lg:grid-cols-12' : ''} gap-6`}>
          {/* Left Column: Service Selector & Recharge/BBPS Form */}
          <div className={`${viewportMode === 'web' ? 'lg:col-span-7' : ''} space-y-5`}>
            {/* 8 Service Categories Grid (Mobile, DTH, Electricity, Gas, Water, Broadband, Landline, Insurance) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Select Recharge or Authorized BBPS Utility Service
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { id: 'mobile_prepaid', label: 'Mobile Prepaid', icon: Smartphone },
                  { id: 'mobile_postpaid', label: 'Mobile Postpaid', icon: Smartphone },
                  { id: 'dth', label: 'DTH Recharge', icon: Tv },
                  { id: 'electricity', label: 'Electricity', icon: Zap },
                  { id: 'gas', label: 'Piped / LPG Gas', icon: Flame },
                  { id: 'water', label: 'Water Bill', icon: Droplets },
                  { id: 'broadband', label: 'Broadband', icon: Wifi },
                  { id: 'landline', label: 'Landline', icon: PhoneCall },
                  { id: 'insurance', label: 'Insurance', icon: Shield },
                ].map((srv) => {
                  const Icon = srv.icon;
                  const active = activeService === srv.id;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => {
                        setActiveService(srv.id as ServiceCategory);
                        setFetchedBillInfo('');
                      }}
                      className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                        active
                          ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px] leading-tight">{srv.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Service Execution Form */}
            <form
              onSubmit={handleExecuteRechargeOrBill}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white capitalize">
                  {activeService.replace('_', ' ')} Payment
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  Adapter: {selectedTenant.apiAdapterType}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {activeService.startsWith('mobile')
                      ? 'Mobile Number (Auto-Detects Operator)'
                      : activeService === 'dth'
                      ? 'DTH Subscriber ID / VC Number'
                      : 'BBPS Consumer / Policy Number'}
                  </label>
                  <input
                    type="text"
                    required
                    value={targetNumber}
                    onChange={(e) => handleNumberChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Operator / Authorized Biller
                  </label>
                  <select
                    value={operatorCode}
                    onChange={(e) => setOperatorCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                  >
                    {activeService.startsWith('mobile') ? (
                      <>
                        <option value="JIO_PREPAID">Reliance Jio Telecom</option>
                        <option value="AIRTEL_PREPAID">Bharti Airtel</option>
                        <option value="VI_PREPAID">Vodafone Idea (Vi)</option>
                        <option value="BSNL_TOPUP">BSNL Mobile</option>
                      </>
                    ) : activeService === 'dth' ? (
                      <>
                        <option value="TATAPLAY_DTH">Tata Play DTH</option>
                        <option value="AIRTEL_DTH">Airtel Digital TV</option>
                        <option value="DISHTV_DTH">Dish TV India</option>
                        <option value="D2H_DTH">Videocon d2h</option>
                      </>
                    ) : (
                      <>
                        <option value="WBSEDCL_BBPS">WBSEDCL Electricity (BBPS)</option>
                        <option value="CESC_KOLKATA">CESC Limited Electricity</option>
                        <option value="INDANE_LPG_BBPS">Indane Gas (IndianOil BBPS)</option>
                        <option value="KMC_WATER_BBPS">Municipal Water Supply</option>
                        <option value="BSNL_FTTH_BBPS">BSNL Bharat Fiber Broadband</option>
                        <option value="LIC_INDIA_BBPS">LIC Insurance Premium</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Telecom Circle / Region
                  </label>
                  <input
                    type="text"
                    value={circleCode}
                    onChange={(e) => setCircleCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Amount (INR)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      required
                      min={10}
                      value={amountInr}
                      onChange={(e) => setAmountInr(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                    />
                    {!activeService.startsWith('mobile_prepaid') && (
                      <button
                        type="button"
                        onClick={handleFetchDthOrBbpsInfo}
                        className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap cursor-pointer"
                      >
                        Fetch Bill
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {fetchedBillInfo && (
                <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-xs font-mono text-indigo-900 dark:text-indigo-200">
                  {fetchedBillInfo}
                </div>
              )}

              {/* Browse Prepaid Plans Strip */}
              {activeService === 'mobile_prepaid' && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Browse Circle Recharge Plans (Click to Select)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {MOBILE_PLANS.map((p) => (
                      <button
                        key={p.amount}
                        type="button"
                        onClick={() => setAmountInr(p.amount)}
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          amountInr === p.amount
                            ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/50'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-xs font-bold text-slate-900 dark:text-white">
                          <span>₹{p.amount}</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{p.data}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Validity: {p.validity} · {p.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                style={{ backgroundColor: selectedTenant.primaryColor }}
                className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white hover:opacity-95 transition-opacity cursor-pointer"
              >
                Confirm &amp; Execute Recharge (₹{amountInr})
              </button>
            </form>
          </div>

          {/* Right Column: Customer Wallet & Transaction Reconciliation Engine */}
          <div className={`${viewportMode === 'web' ? 'lg:col-span-5' : ''} space-y-5`}>
            {/* Customer Isolated Wallet Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Customer Wallet Balance</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                    ₹{walletBalanceInr.toLocaleString('en-IN')}
                  </div>
                </div>
                <Wallet className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <input
                  type="number"
                  value={topupAmountInr}
                  onChange={(e) => setTopupAmountInr(Number(e.target.value) || 0)}
                  className="w-28 px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleAddMoneyToCustomerWallet}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Money via UPI
                </button>
              </div>
            </div>

            {/* Transaction Ledger & Webhook Callback Verifier */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Transaction Engine &amp; Webhook Reconciliation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Recharges start in <code className="font-mono">Pending</code> state until verified provider callback confirmation. Download receipts or trigger provider webhooks below.
                </p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {transactions.map((tx) => (
                  <div
                    key={tx.txId}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {tx.targetNumber} · ₹{tx.amountInr}
                      </span>
                      <span
                        className={`font-mono font-semibold uppercase ${
                          tx.status === 'Successful'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.status === 'Pending'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
                      <span>{tx.txId}</span>
                      <span>{tx.operatorCode}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                      {tx.status === 'Pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleProviderWebhookCallback(tx.txId, 'Successful')}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-500 cursor-pointer"
                          >
                            Verify Success Webhook
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProviderWebhookCallback(tx.txId, 'Failed')}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-red-600 text-white rounded hover:bg-red-500 cursor-pointer"
                          >
                            Simulate Fail &amp; Auto-Refund
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">
                          Terminal State Locked
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(tx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
