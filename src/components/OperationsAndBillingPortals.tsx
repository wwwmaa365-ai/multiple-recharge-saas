/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  Store,
  Wallet,
  Percent,
  Send,
  CheckCircle2,
  Users,
  Shield,
  MessageSquare,
  Bell,
  Mail,
  Smartphone,
  CreditCard,
  FileText,
  Download,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  SimulatedTenantContext,
  checkSubscriptionGatekeeper,
} from '../services/tenantEngine';

interface OperationsAndBillingPortalsProps {
  tenant: SimulatedTenantContext;
  currentUser: FirebaseUser | null;
  activePortal: 'retailer_portal' | 'staff_portal' | 'subscription_system';
  onUpdateTenantSubscription?: (
    tenantId: string,
    status: SimulatedTenantContext['subscriptionStatus'],
    planLabel: string
  ) => void;
}

interface RetailerRecord {
  retailerId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  city: string;
  kycStatus: 'pending' | 'approved' | 'rejected';
  walletBalanceInr: number;
  commissionTier: 'silver' | 'gold' | 'platinum';
  commissionEarnedInr: number;
}

interface FundRequestItem {
  requestId: string;
  retailerName: string;
  amountInr: number;
  bankRefUtr: string;
  paymentMode: 'IMPS' | 'NEFT' | 'UPI_B2B';
  status: 'Pending Approval' | 'Approved & Credited';
  createdAt: string;
}

interface StaffMemberItem {
  staffId: string;
  fullName: string;
  email: string;
  roleId: string;
  roleLabel: string;
  department: 'operations' | 'support' | 'finance' | 'tech';
  permissions: string[];
  isActive: boolean;
}

interface SupportTicketItem {
  ticketId: string;
  subject: string;
  category: 'recharge_dispute' | 'wallet_credit' | 'api_error' | 'billing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  customerMobile: string;
  transactionRef: string;
  resolutionNote: string;
}

interface NotificationDispatchLog {
  id: string;
  eventTrigger:
    | 'ACCOUNT_REGISTRATION'
    | 'OTP_VERIFICATION'
    | 'SUBSCRIPTION_EXPIRY'
    | 'RECHARGE_STATUS'
    | 'REFUND_CREDIT'
    | 'WALLET_ADDITION';
  channels: ('SMS' | 'EMAIL' | 'WHATSAPP' | 'FIREBASE_FCM')[];
  recipient: string;
  messagePreview: string;
  deliveryState: 'DELIVERED' | 'QUEUED';
  timestamp: string;
}

interface SubscriptionPlanConfig {
  planId: 'monthly' | 'quarterly' | 'yearly';
  name: string;
  priceInr: number;
  durationDays: number;
  trialDays: number;
  discountPercent: number;
  features: string[];
}

interface InvoiceItem {
  invoiceId: string;
  invoiceNumber: string;
  tenantName: string;
  planName: string;
  amountInr: number;
  taxInr: number;
  totalInr: number;
  status: 'paid' | 'issued';
  issuedDate: string;
  dueDate: string;
}

export const OperationsAndBillingPortals: React.FC<OperationsAndBillingPortalsProps> = ({
  tenant,
  currentUser,
  activePortal,
  onUpdateTenantSubscription,
}) => {
  const [statusBanner, setStatusBanner] = useState<string>('');

  // ============================================================================
  // 1. RETAILER PORTAL STATE (APP 6)
  // ============================================================================
  const [retailerSubTab, setRetailerSubTab] = useState<
    'b2b_terminal' | 'network_directory' | 'fund_requests'
  >('b2b_terminal');

  const [retailers, setRetailers] = useState<RetailerRecord[]>([
    {
      retailerId: `ret_${tenant.tenantId}_101`,
      shopName: 'Maa Durga Telecom & Cyber Point',
      ownerName: 'Ramesh Mondal',
      phone: '9831044512',
      city: 'Kolkata',
      kycStatus: 'approved',
      walletBalanceInr: 18450,
      commissionTier: 'gold',
      commissionEarnedInr: 1420.5,
    },
    {
      retailerId: `ret_${tenant.tenantId}_102`,
      shopName: 'Subham Mobile & Bill Hub',
      ownerName: 'Subham Chatterjee',
      phone: '9830198811',
      city: 'Durgapur',
      kycStatus: 'approved',
      walletBalanceInr: 9240,
      commissionTier: 'platinum',
      commissionEarnedInr: 895.0,
    },
    {
      retailerId: `ret_${tenant.tenantId}_103`,
      shopName: 'New Digital Seva Kendra',
      ownerName: 'Arup Das',
      phone: '9748112233',
      city: 'Siliguri',
      kycStatus: 'pending',
      walletBalanceInr: 0,
      commissionTier: 'silver',
      commissionEarnedInr: 0,
    },
  ]);

  const [newShopName, setNewShopName] = useState<string>('');
  const [newRetailerOwner, setNewRetailerOwner] = useState<string>('');
  const [newRetailerPhone, setNewRetailerPhone] = useState<string>('');
  const [newRetailerCity, setNewRetailerCity] = useState<string>('Asansol');
  const [newRetailerTier, setNewRetailerTier] = useState<'silver' | 'gold' | 'platinum'>('gold');

  // B2B Quick Recharge Terminal
  const [b2bNumber, setB2bNumber] = useState<string>('9830556677');
  const [b2bOperator, setB2bOperator] = useState<string>('JIO_PREPAID');
  const [b2bAmount, setB2bAmount] = useState<number>(349);
  const [b2bCommissionRate] = useState<number>(2.5); // 2.5% retailer margin
  const [b2bTransactions, setB2bTransactions] = useState<
    {
      txId: string;
      number: string;
      operator: string;
      amount: number;
      commissionInr: number;
      netDebitInr: number;
      status: string;
      timestamp: string;
    }[]
  >([
    {
      txId: 'B2B_TX_8812',
      number: '9831044512',
      operator: 'AIRTEL_PREPAID',
      amount: 299,
      commissionInr: 7.18,
      netDebitInr: 291.82,
      status: 'COMMISSION_CREDITED',
      timestamp: '10 mins ago',
    },
  ]);

  // Retailer Fund Requests
  const [fundRequests, setFundRequests] = useState<FundRequestItem[]>([
    {
      requestId: 'FREQ_901',
      retailerName: 'Maa Durga Telecom & Cyber Point',
      amountInr: 10000,
      bankRefUtr: 'UTR412988392011',
      paymentMode: 'IMPS',
      status: 'Pending Approval',
      createdAt: 'Today, 11:20 AM',
    },
  ]);
  const [reqAmountInr, setReqAmountInr] = useState<number>(5000);
  const [reqUtr, setReqUtr] = useState<string>('UTR55290184712');
  const [reqMode, setReqMode] = useState<'IMPS' | 'NEFT' | 'UPI_B2B'>('IMPS');

  // ============================================================================
  // 2. STAFF, RBAC, SUPPORT & NOTIFICATIONS STATE (APP 7)
  // ============================================================================
  const [staffSubTab, setStaffSubTab] = useState<
    'staff_rbac' | 'support_desk' | 'notification_center'
  >('staff_rbac');

  const [staffList, setStaffList] = useState<StaffMemberItem[]>([
    {
      staffId: `stf_${tenant.tenantId}_01`,
      fullName: 'Ananya Sen',
      email: `ops@${tenant.customDomain}`,
      roleId: 'role_ops_lead',
      roleLabel: 'Operations & API Manager',
      department: 'operations',
      permissions: ['VIEW_TRANSACTIONS', 'RETRY_RECHARGE_WEBHOOK', 'APPROVE_RETAILER_KYC'],
      isActive: true,
    },
    {
      staffId: `stf_${tenant.tenantId}_02`,
      fullName: 'Vikram Roy',
      email: `support@${tenant.customDomain}`,
      roleId: 'role_support_exec',
      roleLabel: 'Dispute & Ticket Executive',
      department: 'support',
      permissions: ['MANAGE_TICKETS', 'INITIATE_REFUND_AUDIT', 'SEND_CUSTOMER_ALERT'],
      isActive: true,
    },
  ]);

  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffEmail, setNewStaffEmail] = useState<string>('');
  const [newStaffDept, setNewStaffDept] = useState<
    'operations' | 'support' | 'finance' | 'tech'
  >('support');

  const [tickets, setTickets] = useState<SupportTicketItem[]>([
    {
      ticketId: `tkt_${tenant.tenantId}_401`,
      subject: 'Amount debited via UPI but recharge pending verification',
      category: 'recharge_dispute',
      priority: 'high',
      status: 'open',
      customerMobile: '9830011223',
      transactionRef: 'TXN_771029',
      resolutionNote: 'Awaiting operator callback or manual refund trigger.',
    },
    {
      ticketId: `tkt_${tenant.tenantId}_402`,
      subject: 'Retailer IMPS load UTR verification request',
      category: 'wallet_credit',
      priority: 'medium',
      status: 'in_progress',
      customerMobile: '9831044512',
      transactionRef: 'FREQ_901',
      resolutionNote: 'Finance team verifying bank statement entry.',
    },
  ]);

  const [notificationConfig, setNotificationConfig] = useState({
    smsGatewayProvider: 'MSG91 / Fast2SMS DLT Route',
    smsSenderId: 'RCHEXP',
    emailSmtpHost: 'smtp.rechargeexpres.in',
    whatsappProvider: 'Meta Cloud WhatsApp Business API',
    fcmProjectId: 'gen-lang-client-0023810059',
  });

  const [notificationLogs, setNotificationLogs] = useState<NotificationDispatchLog[]>([
    {
      id: 'NTF_101',
      eventTrigger: 'ACCOUNT_REGISTRATION',
      channels: ['SMS', 'EMAIL', 'WHATSAPP'],
      recipient: '+91 9830012345',
      messagePreview: `Welcome to ${tenant.businessName}. Your tenant workspace is active.`,
      deliveryState: 'DELIVERED',
      timestamp: '15 mins ago',
    },
    {
      id: 'NTF_102',
      eventTrigger: 'RECHARGE_STATUS',
      channels: ['SMS', 'FIREBASE_FCM'],
      recipient: '+91 9876543210',
      messagePreview: 'Recharge of ₹299 for 9876543210 verified via Telecom Operator.',
      deliveryState: 'DELIVERED',
      timestamp: '8 mins ago',
    },
    {
      id: 'NTF_103',
      eventTrigger: 'SUBSCRIPTION_EXPIRY',
      channels: ['EMAIL', 'WHATSAPP'],
      recipient: `admin@${tenant.customDomain}`,
      messagePreview: 'SaaS subscription renewal reminder: 5 days remaining.',
      deliveryState: 'DELIVERED',
      timestamp: '2 mins ago',
    },
  ]);

  // ============================================================================
  // 3. SUBSCRIPTION MANAGEMENT & GST BILLING STATE (APP 8)
  // ============================================================================
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([
    {
      planId: 'monthly',
      name: 'Monthly White-Label SaaS',
      priceInr: 499,
      durationDays: 30,
      trialDays: 7,
      discountPercent: 0,
      features: [
        'Branded Customer Website + Custom Domain',
        'Individual Encrypted Recharge API Vault',
        'Customer & Retailer Wallet Ledger',
      ],
    },
    {
      planId: 'quarterly',
      name: 'Quarterly Growth SaaS',
      priceInr: 1299,
      durationDays: 90,
      trialDays: 14,
      discountPercent: 10,
      features: [
        'Everything in Monthly + Android APK/AAB Builder',
        'Multi-Format Recharge Adapter (REST/Cyrus/Ezulix)',
        'Priority BBPS Utility Bill Categories',
      ],
    },
    {
      planId: 'yearly',
      name: 'Yearly Enterprise White-Label',
      priceInr: 4999,
      durationDays: 365,
      trialDays: 14,
      discountPercent: 15,
      features: [
        'Full 8-Portal Suite (Web, Android, iOS, Retailer, Staff)',
        'Unlimited Retailers & Custom Operator Commission Slabs',
        'Dedicated Custom Domain SSL & Automated Backups',
      ],
    },
  ]);

  const [promoCodeInput, setPromoCodeInput] = useState<string>('WELCOME15');
  const [appliedPromoDiscount, setAppliedPromoDiscount] = useState<number>(15);

  const [invoices, setInvoices] = useState<InvoiceItem[]>([
    {
      invoiceId: `inv_${tenant.tenantId}_2026_01`,
      invoiceNumber: 'INV-RX-2026-0084',
      tenantName: tenant.businessName,
      planName: tenant.subscriptionPlan,
      amountInr: 4236,
      taxInr: 763,
      totalInr: 4999,
      status: 'paid',
      issuedDate: '2026-01-15',
      dueDate: '2026-01-15',
    },
  ]);

  const gatekeeper = checkSubscriptionGatekeeper(tenant);

  // ============================================================================
  // HANDLERS: RETAILER PORTAL
  // ============================================================================
  const handleRegisterRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim() || !newRetailerOwner.trim() || !newRetailerPhone.trim()) return;

    const retailerId = `ret_${tenant.tenantId}_${Date.now()}`;
    const newRecord: RetailerRecord = {
      retailerId,
      shopName: newShopName.trim(),
      ownerName: newRetailerOwner.trim(),
      phone: newRetailerPhone.trim(),
      city: newRetailerCity.trim(),
      kycStatus: 'pending',
      walletBalanceInr: 0,
      commissionTier: newRetailerTier,
      commissionEarnedInr: 0,
    };

    if (currentUser) {
      const path = `tenants/${tenant.tenantId}/retailers/${retailerId}`;
      try {
        await setDoc(doc(db, 'tenants', tenant.tenantId, 'retailers', retailerId), {
          retailerId,
          tenantId: tenant.tenantId,
          ownerUid: currentUser.uid,
          shopName: newRecord.shopName.slice(0, 140),
          phone: newRecord.phone.slice(0, 30),
          kycStatus: 'pending',
          commissionTier: newRecord.commissionTier,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    setRetailers((prev) => [newRecord, ...prev]);
    setNewShopName('');
    setNewRetailerOwner('');
    setNewRetailerPhone('');
    setStatusBanner(
      `Retailer "${newRecord.shopName}" onboarded under tenant ${tenant.tenantId} (Status: Pending KYC Approval).`
    );
  };

  const handleApproveRetailerKyc = (retailerId: string) => {
    setRetailers((prev) =>
      prev.map((r) =>
        r.retailerId === retailerId
          ? { ...r, kycStatus: 'approved', walletBalanceInr: r.walletBalanceInr || 2500 }
          : r
      )
    );
    setStatusBanner(`Retailer ${retailerId} KYC approved and B2B terminal activated.`);
  };

  const handleExecuteB2BRecharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatekeeper.allowedNewTransactions) {
      setStatusBanner(gatekeeper.bannerMessage);
      return;
    }
    if (!tenant.apiConnected) {
      setStatusBanner(
        `API_INTEGRATION_PENDING: ${tenant.businessName} has not connected an active Recharge API provider yet.`
      );
      return;
    }

    const commissionInr = Number(((b2bAmount * b2bCommissionRate) / 100).toFixed(2));
    const netDebitInr = Number((b2bAmount - commissionInr).toFixed(2));

    const activeRetailer = retailers[0];
    if (activeRetailer && activeRetailer.walletBalanceInr < netDebitInr) {
      setStatusBanner('Insufficient Retailer B2B Wallet Balance. Please submit a Fund Request.');
      return;
    }

    setRetailers((prev) =>
      prev.map((r, idx) =>
        idx === 0
          ? {
              ...r,
              walletBalanceInr: Number((r.walletBalanceInr - netDebitInr).toFixed(2)),
              commissionEarnedInr: Number((r.commissionEarnedInr + commissionInr).toFixed(2)),
            }
          : r
      )
    );

    const txId = `B2B_TX_${Math.floor(1000 + Math.random() * 9000)}`;
    setB2bTransactions((prev) => [
      {
        txId,
        number: b2bNumber,
        operator: b2bOperator,
        amount: b2bAmount,
        commissionInr,
        netDebitInr,
        status: 'WEBHOOK_VERIFIED_SUCCESS',
        timestamp: 'Just now',
      },
      ...prev,
    ]);

    setStatusBanner(
      `B2B Recharge ${txId} processed via ${tenant.apiProviderName}. Retailer commission ₹${commissionInr} credited (Net Debit: ₹${netDebitInr}).`
    );
  };

  const handleCreateFundRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const requestId = `FREQ_${Math.floor(100 + Math.random() * 900)}`;
    setFundRequests((prev) => [
      {
        requestId,
        retailerName: retailers[0]?.shopName || 'Maa Durga Telecom',
        amountInr: reqAmountInr,
        bankRefUtr: reqUtr,
        paymentMode: reqMode,
        status: 'Pending Approval',
        createdAt: 'Just now',
      },
      ...prev,
    ]);
    setStatusBanner(
      `Retailer Fund Request ${requestId} for ₹${reqAmountInr.toLocaleString('en-IN')} (${reqMode} UTR: ${reqUtr}) submitted to Client Admin.`
    );
  };

  const handleApproveFundRequest = (req: FundRequestItem) => {
    setFundRequests((prev) =>
      prev.map((item) =>
        item.requestId === req.requestId
          ? { ...item, status: 'Approved & Credited' }
          : item
      )
    );
    setRetailers((prev) =>
      prev.map((r, idx) =>
        idx === 0 ? { ...r, walletBalanceInr: r.walletBalanceInr + req.amountInr } : r
      )
    );
    setStatusBanner(
      `Fund Request ${req.requestId} verified. ₹${req.amountInr.toLocaleString('en-IN')} credited to retailer wallet.`
    );
  };

  // ============================================================================
  // HANDLERS: STAFF, RBAC & NOTIFICATIONS PORTAL
  // ============================================================================
  const handleAddStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) return;

    const staffId = `stf_${tenant.tenantId}_${Date.now()}`;
    const roleId = `role_${newStaffDept}_specialist`;
    const newStaff: StaffMemberItem = {
      staffId,
      fullName: newStaffName.trim(),
      email: newStaffEmail.trim(),
      roleId,
      roleLabel: `${newStaffDept.toUpperCase()} Specialist`,
      department: newStaffDept,
      permissions:
        newStaffDept === 'operations'
          ? ['VIEW_TRANSACTIONS', 'VERIFY_WEBHOOKS']
          : newStaffDept === 'finance'
          ? ['APPROVE_FUND_REQUESTS', 'EXPORT_GST_LEDGER']
          : ['MANAGE_TICKETS', 'DISPATCH_NOTIFICATIONS'],
      isActive: true,
    };

    if (currentUser) {
      const path = `tenants/${tenant.tenantId}/staff/${staffId}`;
      try {
        await setDoc(doc(db, 'tenants', tenant.tenantId, 'staff', staffId), {
          staffId,
          tenantId: tenant.tenantId,
          ownerUid: currentUser.uid,
          fullName: newStaff.fullName.slice(0, 120),
          email: newStaff.email.slice(0, 160),
          roleId: newStaff.roleId,
          department: newStaff.department,
          isActive: true,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    setStaffList((prev) => [newStaff, ...prev]);
    setNewStaffName('');
    setNewStaffEmail('');
    setStatusBanner(
      `Staff member "${newStaff.fullName}" assigned to ${newStaff.department.toUpperCase()} with isolated tenant RBAC permissions.`
    );
  };

  const handleResolveTicket = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.ticketId === ticketId
          ? {
              ...t,
              status: 'resolved',
              resolutionNote: 'Verified with telecom operator log & notified customer via SMS/FCM.',
            }
          : t
      )
    );
    setStatusBanner(`Support Ticket ${ticketId} marked RESOLVED and customer notification dispatched.`);
  };

  const handleDispatchTestNotification = (
    trigger: NotificationDispatchLog['eventTrigger']
  ) => {
    const newLog: NotificationDispatchLog = {
      id: `NTF_${Math.floor(200 + Math.random() * 799)}`,
      eventTrigger: trigger,
      channels: ['SMS', 'EMAIL', 'WHATSAPP', 'FIREBASE_FCM'],
      recipient: `customer@${tenant.customDomain}`,
      messagePreview: `[${tenant.logoText}] Automated ${trigger} alert dispatched across DLT SMS, SMTP, WhatsApp & Firebase Push.`,
      deliveryState: 'DELIVERED',
      timestamp: 'Just now',
    };
    setNotificationLogs((prev) => [newLog, ...prev]);
    setStatusBanner(`Multi-channel ${trigger} alert dispatched via SMS, Email, WhatsApp, and FCM.`);
  };

  // ============================================================================
  // HANDLERS: SUBSCRIPTION MANAGEMENT & GST INVOICING
  // ============================================================================
  const handleUpdatePlanPrice = (planId: 'monthly' | 'quarterly' | 'yearly', priceInr: number) => {
    setPlans((prev) =>
      prev.map((p) => (p.planId === planId ? { ...p, priceInr: Math.max(99, priceInr) } : p))
    );
  };

  const handleRenewOrActivateSubscription = async (plan: SubscriptionPlanConfig) => {
    const discountMultiplier = (100 - appliedPromoDiscount) / 100;
    const finalTotalInr = Math.round(plan.priceInr * discountMultiplier);
    const baseAmountInr = Math.round(finalTotalInr / 1.18);
    const gstTaxInr = finalTotalInr - baseAmountInr;

    const paymentId = `subpay_${tenant.tenantId}_${Date.now()}`;
    const invoiceId = `inv_${tenant.tenantId}_${Date.now()}`;
    const invoiceNumber = `INV-RX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    if (currentUser) {
      try {
        await setDoc(doc(db, 'subscription_payments', paymentId), {
          paymentId,
          tenantId: tenant.tenantId,
          ownerUid: currentUser.uid,
          planId: plan.planId,
          amountInr: finalTotalInr,
          gatewayName: 'RechargeExpres Razorpay SaaS Billing',
          gatewayOrderId: `order_rx_${Date.now()}`,
          gatewayPaymentId: `pay_rx_${Date.now()}`,
          signatureVerified: true,
          status: 'verified',
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'invoices', invoiceId), {
          invoiceId,
          invoiceNumber,
          tenantId: tenant.tenantId,
          ownerUid: currentUser.uid,
          amountInr: baseAmountInr,
          taxInr: gstTaxInr,
          totalInr: finalTotalInr,
          status: 'paid',
          issuedAt: nowIso,
          dueDate: nowIso,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `invoices/${invoiceId}`);
      }
    }

    setInvoices((prev) => [
      {
        invoiceId,
        invoiceNumber,
        tenantName: tenant.businessName,
        planName: `${plan.name} (${appliedPromoDiscount}% Promo Discount)`,
        amountInr: baseAmountInr,
        taxInr: gstTaxInr,
        totalInr: finalTotalInr,
        status: 'paid',
        issuedDate: nowIso.slice(0, 10),
        dueDate: nowIso.slice(0, 10),
      },
      ...prev,
    ]);

    if (onUpdateTenantSubscription) {
      onUpdateTenantSubscription(
        tenant.tenantId,
        'active',
        `${plan.name.split(' ')[0]} (₹${finalTotalInr.toLocaleString('en-IN')})`
      );
    }

    setStatusBanner(
      `Subscription payment verified for ${tenant.businessName}. Account restored to ACTIVE and GST Invoice ${invoiceNumber} (₹${finalTotalInr}) generated.`
    );
  };

  const handleDownloadInvoiceText = (inv: InvoiceItem) => {
    const content = [
      '====================================================================',
      '               RECHARGE EXPRES SAAS — GST TAX INVOICE               ',
      '====================================================================',
      'Platform Owner : SANJIT BADYAKAR',
      'Master Domain  : rechargeexpres.in',
      `Invoice Number : ${inv.invoiceNumber}`,
      `Invoice Date   : ${inv.issuedDate}`,
      `Billed Tenant  : ${inv.tenantName} (${tenant.customDomain})`,
      `Subscription   : ${inv.planName}`,
      '--------------------------------------------------------------------',
      `Base SaaS Fee  : INR ${inv.amountInr.toFixed(2)}`,
      `GST (18% IGST) : INR ${inv.taxInr.toFixed(2)}`,
      `Total Paid     : INR ${inv.totalInr.toFixed(2)}`,
      `Payment Status : ${inv.status.toUpperCase()} (WEBHOOK SIGNATURE VERIFIED)`,
      '====================================================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoiceNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {statusBanner && (
        <div className="p-4 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            onClick={() => setStatusBanner('')}
            className="underline font-medium cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          APP 6: RETAILER PORTAL
         ===================================================================== */}
      {activePortal === 'retailer_portal' && (
        <div className="space-y-6">
          {/* Retailer Header & KPI Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>Application 06 · B2B Retailer Network</span>
                  <span>·</span>
                  <span className="font-mono">{tenant.customDomain}</span>
                </div>
                <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white mt-1">
                  {tenant.businessName} — Retailer B2B Recharge &amp; Commission Portal
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
                {[
                  { id: 'b2b_terminal', label: 'B2B Recharge Console' },
                  { id: 'network_directory', label: `Retailer Onboarding & KYC (${retailers.length})` },
                  { id: 'fund_requests', label: `Wallet Fund Requests (${fundRequests.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setRetailerSubTab(t.id as typeof retailerSubTab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      retailerSubTab === t.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">Active Retailer B2B Wallet</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  ₹{(retailers[0]?.walletBalanceInr || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Shop: {retailers[0]?.shopName}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">Total B2B Commission Earned</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                  ₹{(retailers[0]?.commissionEarnedInr || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Tier: {retailers[0]?.commissionTier.toUpperCase()} ({b2bCommissionRate}% Margin)
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">Tenant Network Isolation</div>
                <div className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                  /tenants/{tenant.tenantId}/retailers
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Strict tenant_id Row-Level Security enforced
                </div>
              </div>
            </div>
          </div>

          {retailerSubTab === 'b2b_terminal' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleExecuteB2BRecharge}
                className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
              >
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-indigo-500" />
                  Retailer Instant Commission Recharge Terminal
                </h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Customer Mobile / DTH Subscriber ID
                  </label>
                  <input
                    type="text"
                    value={b2bNumber}
                    onChange={(e) => setB2bNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Operator Code
                    </label>
                    <select
                      value={b2bOperator}
                      onChange={(e) => setB2bOperator(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                    >
                      <option value="JIO_PREPAID">JIO_PREPAID (2.5%)</option>
                      <option value="AIRTEL_PREPAID">AIRTEL_PREPAID (2.4%)</option>
                      <option value="VI_PREPAID">VI_PREPAID (3.1%)</option>
                      <option value="TATAPLAY_DTH">TATAPLAY_DTH (2.8%)</option>
                      <option value="WBSEDCL_EBILL">WBSEDCL_EBILL (Flat ₹4)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Recharge Amount (INR)
                    </label>
                    <input
                      type="number"
                      value={b2bAmount}
                      onChange={(e) => setB2bAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer Denomination:</span>
                    <span>₹{b2bAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Retailer Commission ({b2bCommissionRate}%):</span>
                    <span>+ ₹{((b2bAmount * b2bCommissionRate) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span>Net Wallet Debit:</span>
                    <span>₹{(b2bAmount - (b2bAmount * b2bCommissionRate) / 100).toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white rounded-lg transition-opacity cursor-pointer"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  Process B2B Recharge &amp; Credit Commission
                </button>
              </form>

              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Retailer Commission &amp; Transaction Statement
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 px-3">TX ID</th>
                        <th className="py-2.5 px-3">Subscriber</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Commission</th>
                        <th className="py-2.5 px-3">Net Debit</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                      {b2bTransactions.map((tx) => (
                        <tr key={tx.txId}>
                          <td className="py-2.5 px-3 font-semibold">{tx.txId}</td>
                          <td className="py-2.5 px-3">
                            {tx.number} ({tx.operator})
                          </td>
                          <td className="py-2.5 px-3">₹{tx.amount}</td>
                          <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">
                            +₹{tx.commissionInr}
                          </td>
                          <td className="py-2.5 px-3">₹{tx.netDebitInr}</td>
                          <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">
                            {tx.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {retailerSubTab === 'network_directory' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleRegisterRetailer}
                className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
              >
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Onboard New Retailer Account
                </h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Retail Outlet / Shop Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopName}
                    onChange={(e) => setNewShopName(e.target.value)}
                    placeholder="e.g., Howrah Digital Point"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Proprietor Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newRetailerOwner}
                    onChange={(e) => setNewRetailerOwner(e.target.value)}
                    placeholder="e.g., Suman Ghosh"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      required
                      value={newRetailerPhone}
                      onChange={(e) => setNewRetailerPhone(e.target.value)}
                      placeholder="9830099887"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Commission Slab
                    </label>
                    <select
                      value={newRetailerTier}
                      onChange={(e) =>
                        setNewRetailerTier(e.target.value as 'silver' | 'gold' | 'platinum')
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                    >
                      <option value="silver">SILVER</option>
                      <option value="gold">GOLD</option>
                      <option value="platinum">PLATINUM</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer"
                >
                  Register Retailer in /retailers
                </button>
              </form>

              <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Tenant Retailer Directory &amp; KYC Approval Queue
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 px-3">Shop &amp; Proprietor</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Slab</th>
                        <th className="py-2.5 px-3">Wallet</th>
                        <th className="py-2.5 px-3">KYC Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {retailers.map((r) => (
                        <tr key={r.retailerId}>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {r.shopName}
                            </div>
                            <div className="text-slate-500">{r.ownerName}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{r.phone}</td>
                          <td className="py-2.5 px-3 font-mono uppercase">{r.commissionTier}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold">
                            ₹{r.walletBalanceInr.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 font-mono uppercase">
                            <span
                              className={
                                r.kycStatus === 'approved'
                                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'text-amber-600 dark:text-amber-400 font-semibold'
                              }
                            >
                              {r.kycStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {r.kycStatus === 'pending' ? (
                              <button
                                onClick={() => handleApproveRetailerKyc(r.retailerId)}
                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded cursor-pointer"
                              >
                                Approve KYC
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono">Verified</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {retailerSubTab === 'fund_requests' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleCreateFundRequest}
                className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
              >
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Submit Retailer Wallet Load Request
                </h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Deposit Amount (INR)
                  </label>
                  <input
                    type="number"
                    value={reqAmountInr}
                    onChange={(e) => setReqAmountInr(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Bank Transfer Mode
                  </label>
                  <select
                    value={reqMode}
                    onChange={(e) => setReqMode(e.target.value as 'IMPS' | 'NEFT' | 'UPI_B2B')}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  >
                    <option value="IMPS">IMPS Instant Transfer</option>
                    <option value="NEFT">NEFT Bank Settlement</option>
                    <option value="UPI_B2B">UPI Merchant Collect</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Bank UTR / Reference Number
                  </label>
                  <input
                    type="text"
                    value={reqUtr}
                    onChange={(e) => setReqUtr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer"
                >
                  Submit Fund Request
                </button>
              </form>

              <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Fund Request Verification Queue
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 px-3">ID &amp; Retailer</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Mode &amp; UTR</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Client Admin Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                      {fundRequests.map((req) => (
                        <tr key={req.requestId}>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {req.requestId}
                            </div>
                            <div className="font-sans text-slate-500">{req.retailerName}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            ₹{req.amountInr.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3">
                            {req.paymentMode} · {req.bankRefUtr}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={
                                req.status === 'Approved & Credited'
                                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'text-amber-600 dark:text-amber-400 font-semibold'
                              }
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {req.status === 'Pending Approval' ? (
                              <button
                                onClick={() => handleApproveFundRequest(req)}
                                className="px-2.5 py-1 text-xs font-sans font-semibold bg-emerald-600 text-white rounded cursor-pointer"
                              >
                                Verify &amp; Credit Wallet
                              </button>
                            ) : (
                              <span className="text-slate-400">Settled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          APP 7: STAFF MANAGEMENT, RBAC, SUPPORT TICKETS & NOTIFICATIONS
         ===================================================================== */}
      {activePortal === 'staff_portal' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>Application 07 · Operations, RBAC &amp; Multi-Channel Alerts</span>
                  <span>·</span>
                  <span className="font-mono">{tenant.customDomain}</span>
                </div>
                <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white mt-1">
                  Staff Access Control, Support Dispute Desk &amp; Notification Engine
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
                {[
                  { id: 'staff_rbac', label: `Staff & RBAC Roles (${staffList.length})` },
                  { id: 'support_desk', label: `Support Tickets (${tickets.length})` },
                  { id: 'notification_center', label: 'SMS / Email / WhatsApp / FCM Hub' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setStaffSubTab(t.id as typeof staffSubTab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      staffSubTab === t.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {staffSubTab === 'staff_rbac' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleAddStaffMember}
                className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
              >
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  Assign Staff Member &amp; RBAC Role
                </h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Staff Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="e.g., Priyadarshini Roy"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder={`staff@${tenant.customDomain}`}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Department &amp; Permission Scope
                  </label>
                  <select
                    value={newStaffDept}
                    onChange={(e) =>
                      setNewStaffDept(
                        e.target.value as 'operations' | 'support' | 'finance' | 'tech'
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                  >
                    <option value="operations">OPERATIONS (Webhooks &amp; KYC)</option>
                    <option value="support">SUPPORT (Tickets &amp; Customer Alerts)</option>
                    <option value="finance">FINANCE (Wallet Ledger &amp; GST Reports)</option>
                    <option value="tech">TECH (API Vault &amp; Domain DNS)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer"
                >
                  Provision Staff in /staff
                </button>
              </form>

              <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Active Staff &amp; Granular Permission Matrix (<code className="font-mono">/staff</code>, <code className="font-mono">/roles</code>, <code className="font-mono">/permissions</code>)
                </h3>
                <div className="space-y-3">
                  {staffList.map((stf) => (
                    <div
                      key={stf.staffId}
                      className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {stf.fullName}{' '}
                          <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                            ({stf.roleLabel})
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          {stf.email} · Dept: {stf.department.toUpperCase()}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-1.5">
                          Grants: {stf.permissions.join(' · ')}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                        RBAC_ACTIVE
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {staffSubTab === 'support_desk' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                Customer &amp; Retailer Dispute Resolution Queue (<code className="font-mono">/support_tickets</code>)
              </h3>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 px-3">Ticket ID</th>
                      <th className="py-2.5 px-3">Subject &amp; Resolution Note</th>
                      <th className="py-2.5 px-3">Customer / TX Ref</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {tickets.map((t) => (
                      <tr key={t.ticketId}>
                        <td className="py-2.5 px-3 font-mono font-semibold">{t.ticketId}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {t.subject}
                          </div>
                          <div className="text-slate-500 mt-0.5">{t.resolutionNote}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {t.customerMobile} · {t.transactionRef}
                        </td>
                        <td className="py-2.5 px-3 font-mono uppercase">{t.priority}</td>
                        <td className="py-2.5 px-3 font-mono uppercase">
                          <span
                            className={
                              t.status === 'resolved'
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-amber-600 dark:text-amber-400 font-semibold'
                            }
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {t.status !== 'resolved' ? (
                            <button
                              onClick={() => handleResolveTicket(t.ticketId)}
                              className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded cursor-pointer"
                            >
                              Verify &amp; Resolve
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono">Closed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {staffSubTab === 'notification_center' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-500" />
                  Multi-Channel Gateway Configuration
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">DLT SMS Provider &amp; Header</label>
                    <input
                      type="text"
                      value={`${notificationConfig.smsGatewayProvider} (${notificationConfig.smsSenderId})`}
                      onChange={(e) =>
                        setNotificationConfig({
                          ...notificationConfig,
                          smsGatewayProvider: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Transactional Email SMTP</label>
                    <input
                      type="text"
                      value={notificationConfig.emailSmtpHost}
                      onChange={(e) =>
                        setNotificationConfig({
                          ...notificationConfig,
                          emailSmtpHost: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">WhatsApp Business API</label>
                    <input
                      type="text"
                      value={notificationConfig.whatsappProvider}
                      onChange={(e) =>
                        setNotificationConfig({
                          ...notificationConfig,
                          whatsappProvider: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">
                      Firebase Cloud Messaging (FCM) Project
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={notificationConfig.fcmProjectId}
                      className="w-full px-3 py-2 font-mono bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Trigger Automated Event Notification:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        'ACCOUNT_REGISTRATION',
                        'OTP_VERIFICATION',
                        'SUBSCRIPTION_EXPIRY',
                        'RECHARGE_STATUS',
                        'REFUND_CREDIT',
                        'WALLET_ADDITION',
                      ] as const
                    ).map((trig) => (
                      <button
                        key={trig}
                        onClick={() => handleDispatchTestNotification(trig)}
                        className="px-2.5 py-2 text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors text-left truncate cursor-pointer"
                      >
                        {trig}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Live Multi-Channel Dispatch Audit Log
                </h3>
                <div className="space-y-3">
                  {notificationLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {log.id} · {log.eventTrigger}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {log.deliveryState} ({log.timestamp})
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200">{log.messagePreview}</p>
                      <div className="text-[11px] font-mono text-slate-500">
                        Channels: {log.channels.join(' + ')} · Recipient: {log.recipient}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          APP 8: SUBSCRIPTION MANAGEMENT & GST BILLING SYSTEM
         ===================================================================== */}
      {activePortal === 'subscription_system' && (
        <div className="space-y-6">
          {/* Subscription Gatekeeper Live Status Bar */}
          <div
            className={`p-5 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
              gatekeeper.allowedNewTransactions
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
                : 'bg-red-50/80 dark:bg-red-950/40 border-red-200 dark:border-red-900'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono uppercase font-bold">
                {gatekeeper.allowedNewTransactions ? (
                  <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-red-600 dark:text-red-400" />
                )}
                <span>
                  Subscription Gatekeeper · {tenant.businessName} ({tenant.customDomain})
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {gatekeeper.bannerMessage}
              </p>
            </div>

            {onUpdateTenantSubscription && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    onUpdateTenantSubscription(
                      tenant.tenantId,
                      tenant.subscriptionStatus === 'active' ? 'expired' : 'active',
                      tenant.subscriptionPlan
                    )
                  }
                  className="px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {tenant.subscriptionStatus === 'active'
                    ? 'Simulate Subscription Expiry Lock'
                    : 'Restore Account via Instant Renewal'}
                </button>
              </div>
            )}
          </div>

          {/* 3 Subscription Plans & Master Admin Price / Discount Configurator */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Application 08 · Platform Owner: SANJIT BADYAKAR (rechargeexpres.in)
                </div>
                <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white mt-0.5">
                  SaaS Subscription Plans, Promotional Discounts &amp; Webhook Renewal Engine
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Promo Code:</span>
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg w-28"
                />
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  -{appliedPromoDiscount}% OFF
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const discountedPrice = Math.round(
                  plan.priceInr * ((100 - appliedPromoDiscount) / 100)
                );
                return (
                  <div
                    key={plan.planId}
                    className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase font-bold text-indigo-600 dark:text-indigo-400">
                          {plan.planId} PLAN
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {plan.durationDays} Days · {plan.trialDays}d Trial
                        </span>
                      </div>
                      <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                          ₹{discountedPrice.toLocaleString('en-IN')}
                        </span>
                        {appliedPromoDiscount > 0 && (
                          <span className="text-xs font-mono line-through text-slate-400">
                            ₹{plan.priceInr}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">incl. 18% GST</span>
                      </div>

                      <div className="pt-2">
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Master Admin Base Price Override (INR)
                        </label>
                        <input
                          type="number"
                          value={plan.priceInr}
                          onChange={(e) =>
                            handleUpdatePlanPrice(plan.planId, Number(e.target.value))
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded"
                        />
                      </div>

                      <ul className="space-y-1.5 pt-2 text-xs text-slate-600 dark:text-slate-400">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => handleRenewOrActivateSubscription(plan)}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer"
                    >
                      Verify Webhook Payment &amp; Activate {plan.planId.toUpperCase()}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GST Invoices & Financial Separation Audit Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  SaaS Subscription Invoices &amp; GST Tax Ledger (<code className="font-mono">/invoices</code> &amp; <code className="font-mono">/subscription_payments</code>)
                </h3>
                <p className="text-xs text-slate-500">
                  Strictly separated from client customer wallets and client telecom operator balances.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3">Invoice Number</th>
                    <th className="py-2.5 px-3">Client Tenant</th>
                    <th className="py-2.5 px-3">Subscription Plan</th>
                    <th className="py-2.5 px-3">Base Fee</th>
                    <th className="py-2.5 px-3">18% GST</th>
                    <th className="py-2.5 px-3">Total Paid</th>
                    <th className="py-2.5 px-3 text-right">GST Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                  {invoices.map((inv) => (
                    <tr key={inv.invoiceId}>
                      <td className="py-2.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-white">
                        {inv.tenantName}
                      </td>
                      <td className="py-2.5 px-3 font-sans">{inv.planName}</td>
                      <td className="py-2.5 px-3">₹{inv.amountInr.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3">₹{inv.taxInr.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{inv.totalInr.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDownloadInvoiceText(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-sans font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
