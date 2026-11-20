/**
 * Recharge Expres — Core Multi-Tenant Domain Resolution,
 * Credential Redaction & Adapter Engine (Phase 1 Foundation)
 */

export interface SimulatedTenantContext {
  tenantId: string;
  businessName: string;
  ownerName: string;
  email?: string;
  phone?: string;
  customDomain: string;
  primaryColor: string;
  secondaryColor: string;
  logoText: string;
  subscriptionPlan: string;
  subscriptionStatus: 'active' | 'expired' | 'suspended';
  apiAdapterType: 'standard_rest' | 'cyrus_compatible' | 'ezulix_compatible' | 'custom_json';
  apiProviderName: string;
  apiBaseUrl: string;
  apiConnected: boolean;
  businessAddress?: string;
  country?: string;
  state?: string;
  city?: string;
  passwordHash?: string;
  notes?: string;
}

export function checkSubscriptionGatekeeper(tenant: SimulatedTenantContext): {
  allowedNewTransactions: boolean;
  historicalRecordsAccessible: boolean;
  bannerMessage: string;
} {
  if (tenant.subscriptionStatus === 'active') {
    return {
      allowedNewTransactions: true,
      historicalRecordsAccessible: true,
      bannerMessage: `Subscription ACTIVE (${tenant.subscriptionPlan}). All white-label recharge, BBPS bill payment, and retailer features are unlocked.`,
    };
  }
  return {
    allowedNewTransactions: false,
    historicalRecordsAccessible: true,
    bannerMessage: `Subscription ${tenant.subscriptionStatus.toUpperCase()} for ${tenant.businessName}. New recharges are restricted until renewal, while all historical financial & wallet records remain accessible.`,
  };
}

export const INITIAL_TENANT_CONTEXTS: SimulatedTenantContext[] = [
  {
    tenantId: 'tenant_master_platform',
    businessName: 'Recharge Expres (Master Platform)',
    ownerName: 'SANJIT BADYAKAR',
    email: 'www.maa365@gmail.com',
    phone: '9830011220',
    customDomain: 'rechargeexpres.in',
    primaryColor: '#4F46E5',
    secondaryColor: '#0F172A',
    logoText: 'RECHARGE EXPRES',
    subscriptionPlan: 'Yearly (₹4,999)',
    subscriptionStatus: 'active',
    apiAdapterType: 'standard_rest',
    apiProviderName: 'Platform Master Sandbox',
    apiBaseUrl: 'https://api.rechargeexpres.in/v1',
    apiConnected: true,
    businessAddress: 'Recharge Expres HQ, Sector V, Salt Lake',
    country: 'India',
    state: 'West Bengal',
    city: 'Kolkata',
    notes: 'Master SaaS Platform owned by SANJIT BADYAKAR.',
  },
  {
    tenantId: 'tenant_client_a',
    businessName: 'Client A FinPay Digital',
    ownerName: 'Arjun Mehta',
    email: 'admin@clienta.com',
    phone: '9830011221',
    customDomain: 'clienta.com',
    primaryColor: '#059669',
    secondaryColor: '#064E3B',
    logoText: 'CLIENT-A PAY',
    subscriptionPlan: 'Yearly (₹4,999)',
    subscriptionStatus: 'active',
    apiAdapterType: 'cyrus_compatible',
    apiProviderName: 'Cyrus Recharge API (Client A Own Key)',
    apiBaseUrl: 'https://cyrusrecharge.in/api/recharge.aspx',
    apiConnected: true,
    businessAddress: '42 FinTech Tower, BKC',
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    notes: 'Enterprise yearly subscriber. Custom domain SSL & Cyrus API verified.',
  },
  {
    tenantId: 'tenant_client_b',
    businessName: 'Client B Bharat Utility Hub',
    ownerName: 'Priya Sharma',
    email: 'admin@clientb.in',
    phone: '9830011222',
    customDomain: 'clientb.in',
    primaryColor: '#D97706',
    secondaryColor: '#78350F',
    logoText: 'BHARAT HUB',
    subscriptionPlan: 'Quarterly (₹1,299)',
    subscriptionStatus: 'active',
    apiAdapterType: 'ezulix_compatible',
    apiProviderName: 'Ezulix BBPS & Telecom (Client B Own Key)',
    apiBaseUrl: 'https://api.ezulix.in/v2/telecom/execute',
    apiConnected: false, // Demonstrates "Integration Pending" rule when provider is not yet connected
    businessAddress: '18 Cyber Park, Sector 62',
    country: 'India',
    state: 'Uttar Pradesh',
    city: 'Noida',
    notes: 'Awaiting client Ezulix production API token setup in Client Admin vault.',
  },
  {
    tenantId: 'tenant_client_c',
    businessName: 'Client C QuickTopup Networks',
    ownerName: 'Vikram Singh',
    email: 'admin@clientc.com',
    phone: '9830011223',
    customDomain: 'recharge.clientc.com',
    primaryColor: '#DC2626',
    secondaryColor: '#7F1D1D',
    logoText: 'QUICKTOPUP',
    subscriptionPlan: 'Monthly (₹499)',
    subscriptionStatus: 'expired',
    apiAdapterType: 'custom_json',
    apiProviderName: 'PaySprint Direct API (Client C Own Key)',
    apiBaseUrl: 'https://api.paysprint.in/api/v1/service/recharge',
    apiConnected: true,
    businessAddress: '105 MG Road Commercial Complex',
    country: 'India',
    state: 'Karnataka',
    city: 'Bengaluru',
    notes: 'Monthly plan expired; renewal reminder sent via WhatsApp and Email.',
  },
];

/**
 * Resolves incoming hostname to isolated tenant context.
 * Prevents domain takeover or cross-tenant leakage.
 */
export function resolveTenantByHost(hostname: string, tenants: SimulatedTenantContext[]): SimulatedTenantContext | null {
  const normalized = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return tenants.find((t) => t.customDomain.toLowerCase() === normalized) || null;
}

/**
 * Builds provider-specific recharge request payload using the tenant's isolated adapter
 * while redacting sensitive API keys, tokens, and secrets from logs.
 */
export function buildRedactedAdapterPayload(
  tenant: SimulatedTenantContext,
  mobileNumber: string,
  operatorCode: string,
  amountInr: number,
  clientTxId: string
): {
  canExecute: boolean;
  blockReason?: string;
  httpMethod: 'GET' | 'POST';
  endpointUrl: string;
  redactedPayload: Record<string, unknown>;
  initialStatus: 'Initiated' | 'Integration Pending' | 'Blocked (Subscription Expired)';
} {
  if (tenant.subscriptionStatus === 'expired' || tenant.subscriptionStatus === 'suspended') {
    return {
      canExecute: false,
      blockReason: `Subscription for ${tenant.businessName} (${tenant.customDomain}) is ${tenant.subscriptionStatus.toUpperCase()}. Paid recharge features are restricted until renewal, while historical financial records remain accessible.`,
      httpMethod: 'POST',
      endpointUrl: tenant.apiBaseUrl,
      redactedPayload: {
        tenantId: tenant.tenantId,
        error: 'SUBSCRIPTION_EXPIRED_GATEKEEPER_BLOCK',
      },
      initialStatus: 'Blocked (Subscription Expired)',
    };
  }

  if (!tenant.apiConnected) {
    return {
      canExecute: false,
      blockReason: `Recharge API provider (${tenant.apiProviderName}) is not connected for ${tenant.businessName}. Integration is pending — Recharge Expres never fakes recharge success responses.`,
      httpMethod: 'POST',
      endpointUrl: tenant.apiBaseUrl,
      redactedPayload: {
        tenantId: tenant.tenantId,
        provider: tenant.apiProviderName,
        status: 'API_INTEGRATION_PENDING',
      },
      initialStatus: 'Integration Pending',
    };
  }

  if (tenant.apiAdapterType === 'cyrus_compatible') {
    return {
      canExecute: true,
      httpMethod: 'GET',
      endpointUrl: `${tenant.apiBaseUrl}?memberid=CLIENT_A_MID&pin=***REDACTED_SECRET***&number=${mobileNumber}&operator=${operatorCode}&circle=ALL&amount=${amountInr}&usertx=${clientTxId}&format=json`,
      redactedPayload: {
        adapter: 'Cyrus Compatible GET Adapter',
        tenantId: tenant.tenantId,
        memberid: 'CLIENT_A_MID',
        pin: '***REDACTED_AES256_GCM***',
        number: mobileNumber,
        operator: operatorCode,
        amount: amountInr,
        usertx: clientTxId,
      },
      initialStatus: 'Initiated',
    };
  }

  if (tenant.apiAdapterType === 'custom_json') {
    return {
      canExecute: true,
      httpMethod: 'POST',
      endpointUrl: tenant.apiBaseUrl,
      redactedPayload: {
        adapter: 'Custom JSON Webhook Adapter',
        tenantId: tenant.tenantId,
        headers: {
          Authorization: 'Bearer ***REDACTED_TENANT_JWT***',
          'X-Tenant-Signature': 'sha256=***REDACTED_HMAC***',
        },
        body: {
          operator: operatorCode,
          canumber: mobileNumber,
          amount: amountInr,
          referenceid: clientTxId,
        },
      },
      initialStatus: 'Initiated',
    };
  }

  return {
    canExecute: true,
    httpMethod: 'POST',
    endpointUrl: `${tenant.apiBaseUrl}/recharge/initiate`,
    redactedPayload: {
      adapter: 'Standard REST Adapter',
      tenantId: tenant.tenantId,
      apiKey: 'rk_live_***REDACTED_TENANT_KEY***',
      mobile: mobileNumber,
      operator: operatorCode,
      amountInr,
      idempotencyKey: clientTxId,
    },
    initialStatus: 'Initiated',
  };
}
