/**
 * Recharge Expres — Phase 1 Complete Architecture, Folder Structure,
 * 23-Table Database Specification & Multi-Tenant Blueprint Data
 */

export interface FolderNode {
  path: string;
  layer: 'Monorepo Root' | 'Frontend (Web & Portals)' | 'Mobile (Android & iOS)' | 'Backend (Core Engine)' | 'Database & Security';
  purpose: string;
  phaseUnlocked: number;
}

export const COMPLETE_FOLDER_STRUCTURE: FolderNode[] = [
  {
    path: 'recharge-expres/',
    layer: 'Monorepo Root',
    purpose: 'Root workspace containing shared TypeScript contracts, security specs, and multi-tenant deployment manifests.',
    phaseUnlocked: 1,
  },
  {
    path: '├── firebase-blueprint.json',
    layer: 'Database & Security',
    purpose: 'Canonical multi-tenant entity schema and collection path definitions with strict regex & length bounds.',
    phaseUnlocked: 1,
  },
  {
    path: '├── firestore.rules',
    layer: 'Database & Security',
    purpose: 'Zero-trust Row-Level Security (RLS) rules enforcing tenantId isolation and Master Admin verification.',
    phaseUnlocked: 1,
  },
  {
    path: '├── security_spec.md',
    layer: 'Database & Security',
    purpose: 'Phase 0 Payload-First Security TDD specification and Dirty Dozen adversarial test payloads.',
    phaseUnlocked: 1,
  },
  {
    path: '├── apps/master-admin-web/',
    layer: 'Frontend (Web & Portals)',
    purpose: '1. Master Admin Website (Owner: SANJIT BADYAKAR) — SaaS MRR, client approvals, plan pricing, global audit logs.',
    phaseUnlocked: 3,
  },
  {
    path: '├── apps/client-admin-web/',
    layer: 'Frontend (Web & Portals)',
    purpose: '2. Client Admin Website — Tenant branding, encrypted recharge API config, payment gateway, commissions, reports.',
    phaseUnlocked: 4,
  },
  {
    path: '├── apps/customer-web/',
    layer: 'Frontend (Web & Portals)',
    purpose: '5. Customer Website — White-label domain-resolved portal for Mobile, DTH & BBPS bill payments.',
    phaseUnlocked: 8,
  },
  {
    path: '├── apps/retailer-portal/',
    layer: 'Frontend (Web & Portals)',
    purpose: '6. Retailer Portal — B2B agent terminal with commission slabs, fund requests, and high-speed recharge queue.',
    phaseUnlocked: 10,
  },
  {
    path: '├── apps/staff-portal/',
    layer: 'Frontend (Web & Portals)',
    purpose: '7. Staff Management Portal — Role-based support desk, dispute resolution, and transaction reconciliation.',
    phaseUnlocked: 3,
  },
  {
    path: '├── apps/subscription-billing/',
    layer: 'Frontend (Web & Portals)',
    purpose: '8. Subscription Management System — Automated SaaS plan checkout, webhook verification, and expiry gatekeeper.',
    phaseUnlocked: 5,
  },
  {
    path: '├── mobile/customer-flutter-app/',
    layer: 'Mobile (Android & iOS)',
    purpose: '3 & 4. Customer Android APK/AAB & iOS Release App — Dynamic tenant theme injection & biometric/OTP wallet.',
    phaseUnlocked: 9,
  },
  {
    path: '├── services/api-core/tenant-resolver/',
    layer: 'Backend (Core Engine)',
    purpose: 'Host header & custom domain middleware mapping clienta.com / recharge.clientc.com to isolated tenantId.',
    phaseUnlocked: 6,
  },
  {
    path: '├── services/api-core/recharge-adapters/',
    layer: 'Backend (Core Engine)',
    purpose: 'Adapter-based Recharge API integration engine (Standard REST, Cyrus, Ezulix, Custom JSON) with credential encryption.',
    phaseUnlocked: 7,
  },
  {
    path: '├── services/api-core/transaction-engine/',
    layer: 'Backend (Core Engine)',
    purpose: 'Idempotent state machine (Initiated -> Processing -> Pending -> Successful / Failed / Refunded) & webhook verifier.',
    phaseUnlocked: 11,
  },
  {
    path: '└── services/api-core/wallet-ledger/',
    layer: 'Backend (Core Engine)',
    purpose: 'Three-tier segregated financial ledger separating Recharge Expres SaaS revenue from client customer wallets.',
    phaseUnlocked: 11,
  },
];

export interface DatabaseTableSpec {
  id: number;
  tableName: string;
  category: 'Core Tenancy' | 'SaaS Billing' | 'IAM & Users' | 'Credentials & Gateways' | 'Wallets & Transactions' | 'Operations & Audit';
  tenantScoped: boolean;
  primaryKey: string;
  keyColumns: string[];
  rlsPolicy: string;
}

export const DATABASE_23_TABLES_PLAN: DatabaseTableSpec[] = [
  {
    id: 1,
    tableName: 'tenants',
    category: 'Core Tenancy',
    tenantScoped: true,
    primaryKey: 'tenant_id (UUID / VARCHAR)',
    keyColumns: ['tenant_id', 'owner_uid', 'business_name', 'status', 'subscription_plan_id', 'subscription_expires_at'],
    rlsPolicy: 'owner_uid = current_user_uid() OR is_master_admin()',
  },
  {
    id: 2,
    tableName: 'tenant_domains',
    category: 'Core Tenancy',
    tenantScoped: true,
    primaryKey: 'domain_id',
    keyColumns: ['domain', 'tenant_id', 'verification_txt_record', 'dns_verified', 'ssl_status', 'status'],
    rlsPolicy: 'tenant_id = current_tenant_id() OR is_master_admin()',
  },
  {
    id: 3,
    tableName: 'tenant_settings',
    category: 'Core Tenancy',
    tenantScoped: true,
    primaryKey: 'tenant_id',
    keyColumns: ['tenant_id', 'logo_url', 'primary_color', 'secondary_color', 'android_package_id', 'ios_bundle_id'],
    rlsPolicy: 'tenant_id = current_tenant_id() OR is_master_admin()',
  },
  {
    id: 4,
    tableName: 'tenant_subscriptions',
    category: 'SaaS Billing',
    tenantScoped: true,
    primaryKey: 'subscription_id',
    keyColumns: ['tenant_id', 'plan_id', 'status', 'current_period_start', 'current_period_end', 'auto_suspend_on_expiry'],
    rlsPolicy: 'tenant_id = current_tenant_id() OR is_master_admin()',
  },
  {
    id: 5,
    tableName: 'subscription_plans',
    category: 'SaaS Billing',
    tenantScoped: false,
    primaryKey: 'plan_id',
    keyColumns: ['plan_id', 'name', 'billing_cycle', 'price_inr', 'duration_days', 'trial_days', 'discount_percent'],
    rlsPolicy: 'SELECT: all authenticated; INSERT/UPDATE/DELETE: is_master_admin() ONLY',
  },
  {
    id: 6,
    tableName: 'subscription_payments',
    category: 'SaaS Billing',
    tenantScoped: true,
    primaryKey: 'payment_id',
    keyColumns: ['payment_id', 'tenant_id', 'plan_id', 'amount_inr', 'gateway_reference', 'webhook_verified', 'status'],
    rlsPolicy: 'SELECT/INSERT: tenant_id = current_tenant_id(); UPDATE: is_master_admin() ONLY',
  },
  {
    id: 7,
    tableName: 'users',
    category: 'IAM & Users',
    tenantScoped: true,
    primaryKey: 'uid',
    keyColumns: ['uid', 'tenant_id', 'email', 'phone', 'role_id', 'is_active', 'last_login_at'],
    rlsPolicy: 'uid = current_user_uid() OR tenant_owner(tenant_id) OR is_master_admin()',
  },
  {
    id: 8,
    tableName: 'customers',
    category: 'IAM & Users',
    tenantScoped: true,
    primaryKey: 'customer_id',
    keyColumns: ['customer_id', 'tenant_id', 'user_uid', 'full_name', 'mobile_number', 'kyc_status'],
    rlsPolicy: 'tenant_id = current_tenant_id() AND (user_uid = current_user_uid() OR is_tenant_admin())',
  },
  {
    id: 9,
    tableName: 'retailers',
    category: 'IAM & Users',
    tenantScoped: true,
    primaryKey: 'retailer_id',
    keyColumns: ['retailer_id', 'tenant_id', 'user_uid', 'shop_name', 'commission_tier_id', 'approval_status'],
    rlsPolicy: 'tenant_id = current_tenant_id() AND (user_uid = current_user_uid() OR is_tenant_admin())',
  },
  {
    id: 10,
    tableName: 'staff',
    category: 'IAM & Users',
    tenantScoped: true,
    primaryKey: 'staff_id',
    keyColumns: ['staff_id', 'tenant_id', 'user_uid', 'department', 'role_id', 'status'],
    rlsPolicy: 'tenant_id = current_tenant_id() AND is_tenant_admin() OR is_master_admin()',
  },
  {
    id: 11,
    tableName: 'roles',
    category: 'IAM & Users',
    tenantScoped: true,
    primaryKey: 'role_id',
    keyColumns: ['role_id', 'tenant_id', 'role_name', 'scope_level'],
    rlsPolicy: 'tenant_id = current_tenant_id() OR is_master_admin()',
  },
  {
    id: 12,
    tableName: 'permissions',
    category: 'IAM & Users',
    tenantScoped: true,
    primaryKey: 'permission_id',
    keyColumns: ['permission_id', 'role_id', 'tenant_id', 'resource_name', 'can_read', 'can_write', 'can_approve'],
    rlsPolicy: 'tenant_id = current_tenant_id() OR is_master_admin()',
  },
  {
    id: 13,
    tableName: 'recharge_api_credentials',
    category: 'Credentials & Gateways',
    tenantScoped: true,
    primaryKey: 'credential_id',
    keyColumns: ['tenant_id', 'provider_name', 'adapter_type', 'api_base_url', 'encrypted_api_token', 'encrypted_api_key', 'webhook_secret_hash'],
    rlsPolicy: 'STRICT: is_tenant_owner(tenant_id) OR is_master_admin() — Never exposed to customer/retailer frontend',
  },
  {
    id: 14,
    tableName: 'payment_gateway_credentials',
    category: 'Credentials & Gateways',
    tenantScoped: true,
    primaryKey: 'gateway_id',
    keyColumns: ['tenant_id', 'provider_name', 'merchant_id', 'encrypted_key_id', 'encrypted_key_secret', 'webhook_secret'],
    rlsPolicy: 'STRICT: is_tenant_owner(tenant_id) OR is_master_admin()',
  },
  {
    id: 15,
    tableName: 'wallets',
    category: 'Wallets & Transactions',
    tenantScoped: true,
    primaryKey: 'wallet_id',
    keyColumns: ['wallet_id', 'tenant_id', 'owner_uid', 'account_type', 'balance_inr', 'locked_amount_inr'],
    rlsPolicy: 'tenant_id = current_tenant_id() AND (owner_uid = current_user_uid() OR is_tenant_owner(tenant_id))',
  },
  {
    id: 16,
    tableName: 'wallet_ledger',
    category: 'Wallets & Transactions',
    tenantScoped: true,
    primaryKey: 'ledger_id',
    keyColumns: ['ledger_id', 'tenant_id', 'wallet_id', 'tx_reference_id', 'entry_type', 'amount_inr', 'opening_balance', 'closing_balance'],
    rlsPolicy: 'APPEND-ONLY: tenant_id = current_tenant_id() AND owner_uid = current_user_uid()',
  },
  {
    id: 17,
    tableName: 'recharge_transactions',
    category: 'Wallets & Transactions',
    tenantScoped: true,
    primaryKey: 'tx_id',
    keyColumns: ['tx_id', 'tenant_id', 'customer_id', 'retailer_id', 'operator_code', 'amount_inr', 'status', 'api_provider', 'idempotency_key'],
    rlsPolicy: 'tenant_id = current_tenant_id() AND (user_uid = current_user_uid() OR is_tenant_owner(tenant_id))',
  },
  {
    id: 18,
    tableName: 'bill_payments',
    category: 'Wallets & Transactions',
    tenantScoped: true,
    primaryKey: 'bill_tx_id',
    keyColumns: ['bill_tx_id', 'tenant_id', 'bbps_category', 'biller_id', 'consumer_number', 'amount_inr', 'bbps_ref_no', 'status'],
    rlsPolicy: 'tenant_id = current_tenant_id() AND (user_uid = current_user_uid() OR is_tenant_owner(tenant_id))',
  },
  {
    id: 19,
    tableName: 'commissions',
    category: 'Wallets & Transactions',
    tenantScoped: true,
    primaryKey: 'commission_id',
    keyColumns: ['commission_id', 'tenant_id', 'operator_code', 'service_type', 'retailer_percent', 'flat_surcharge_inr'],
    rlsPolicy: 'tenant_id = current_tenant_id()',
  },
  {
    id: 20,
    tableName: 'notifications',
    category: 'Operations & Audit',
    tenantScoped: true,
    primaryKey: 'notification_id',
    keyColumns: ['notification_id', 'tenant_id', 'recipient_uid', 'channel', 'event_type', 'delivery_status'],
    rlsPolicy: 'tenant_id = current_tenant_id() AND recipient_uid = current_user_uid()',
  },
  {
    id: 21,
    tableName: 'support_tickets',
    category: 'Operations & Audit',
    tenantScoped: true,
    primaryKey: 'ticket_id',
    keyColumns: ['ticket_id', 'tenant_id', 'creator_uid', 'related_tx_id', 'subject', 'priority', 'status'],
    rlsPolicy: 'tenant_id = current_tenant_id() AND (creator_uid = current_user_uid() OR is_tenant_staff())',
  },
  {
    id: 22,
    tableName: 'invoices',
    category: 'SaaS Billing',
    tenantScoped: true,
    primaryKey: 'invoice_id',
    keyColumns: ['invoice_id', 'tenant_id', 'subscription_payment_id', 'invoice_number', 'subtotal_inr', 'gst_inr', 'total_inr'],
    rlsPolicy: 'tenant_id = current_tenant_id() OR is_master_admin()',
  },
  {
    id: 23,
    tableName: 'audit_logs',
    category: 'Operations & Audit',
    tenantScoped: true,
    primaryKey: 'log_id',
    keyColumns: ['log_id', 'tenant_id', 'actor_uid', 'actor_email', 'action', 'target_resource', 'created_at'],
    rlsPolicy: 'IMMUTABLE (No Update/Delete): actor_uid = current_user_uid() OR is_master_admin()',
  },
];

export interface PhaseInfo {
  phase: number;
  title: string;
  status: 'Completed & Active' | 'Queued';
  deliverables: string[];
}

export const DEVELOPMENT_14_PHASES: PhaseInfo[] = [
  {
    phase: 1,
    title: 'Project Setup and System Architecture',
    status: 'Completed & Active',
    deliverables: [
      'Complete monorepo folder structure for 8 applications & backend engines',
      'Multi-tenant architecture & 3-way segregated financial ledger blueprint',
      '23-table database specification with Row-Level Security (RLS) deployed',
      'Live Domain Resolution, Tenant Isolation & Recharge API Adapter Diagnostic Workbench',
    ],
  },
  {
    phase: 2,
    title: 'Database Schema and Tenant Isolation Verification',
    status: 'Completed & Active',
    deliverables: [
      '23 Firestore collections mapped in firebase-blueprint.json & firestore.rules',
      'Atomic 23-table tenant bootstrapper with strict tenantId partitioning',
      'Live cross-tenant Row-Level Security (RLS) guard & immutable audit log verifier',
    ],
  },
  {
    phase: 3,
    title: 'Master Admin Panel (Owner: SANJIT BADYAKAR)',
    status: 'Completed & Active',
    deliverables: [
      'Master Admin Dashboard with MRR/Quarterly/Yearly revenue & client KPIs',
      'Create Client Modal writing to /tenants with initial settings & domain mapping',
      'Client lifecycle controls (Approve, Activate, Suspend, Extend Subscription, Block Expired)',
    ],
  },
  {
    phase: 4,
    title: 'Client Registration and Client Admin Panel',
    status: 'Completed & Active',
    deliverables: ['Self-service tenant onboarding', 'White-label brand color & logo customizer', 'Operator & commission manager'],
  },
  {
    phase: 5,
    title: 'Subscription Plans and Payment Gateway',
    status: 'Completed & Active',
    deliverables: ['Monthly (₹499), Quarterly (₹1,299), Yearly (₹4,999) plans', 'Webhook payment verifier', 'Expiry feature gatekeeper'],
  },
  {
    phase: 6,
    title: 'Custom Domain Management System',
    status: 'Completed & Active',
    deliverables: ['Automated tenant Host resolution', 'DNS TXT ownership verification', 'SSL provisioning state machine'],
  },
  {
    phase: 7,
    title: 'Client-Specific Recharge API Integration',
    status: 'Completed & Active',
    deliverables: ['AES-encrypted per-tenant credential vault', 'Multi-provider adapter engine', 'Redacted API log inspector'],
  },
  {
    phase: 8,
    title: 'Customer White-Label Website',
    status: 'Completed & Active',
    deliverables: ['Mobile prepaid/postpaid, DTH & BBPS bill payment flows', 'Dynamic tenant branding', 'PDF/HTML receipt generator'],
  },
  {
    phase: 9,
    title: 'Customer Android & iOS Mobile Applications',
    status: 'Completed & Active',
    deliverables: ['Interactive Mobile App simulator & Flutter build config', 'Mobile OTP & wallet flows', 'Tenant package ID builder'],
  },
  {
    phase: 10,
    title: 'Retailer Network & Commission System',
    status: 'Completed & Active',
    deliverables: ['Retailer onboarding & approval', 'B2B recharge console', 'Commission ledger & fund request workflow'],
  },
  {
    phase: 11,
    title: 'Wallet Ledger and Recharge Transaction Engine',
    status: 'Completed & Active',
    deliverables: ['Idempotent debit/refund engine', 'Duplicate recharge lock', 'Pending status reconciliation worker'],
  },
  {
    phase: 12,
    title: 'Multi-Channel Notifications and Financial Reports',
    status: 'Completed & Active',
    deliverables: ['SMS, Email, WhatsApp & FCM notification templates', 'GST invoice & settlement exports'],
  },
  {
    phase: 13,
    title: 'Security Testing, Rate Limiting and Disaster Recovery',
    status: 'Completed & Active',
    deliverables: ['Interactive Red-Team penetration test runner', 'Encrypted snapshot export & restore workflow'],
  },
  {
    phase: 14,
    title: 'Production Deployment and White-Label APK/AAB Generator',
    status: 'Completed & Active',
    deliverables: ['Tenant APK/AAB signing config generator', 'Production pre-flight checklist'],
  },
];
