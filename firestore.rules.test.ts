/**
 * Phase 0: Payload-First Security TDD Test Suite for Recharge Expres
 * Verifies that all 12 "Dirty Dozen" adversarial payloads are strictly rejected.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  pillarVerified: string;
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unverified Admin Email Spoof',
    collectionPath: '/tenants/tenant_alpha',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Verified Users & Admin Guard',
  },
  {
    id: 2,
    name: 'Cross-Tenant API Credential Theft',
    collectionPath: '/tenants/tenant_alpha/api_configs/primary',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Pillar 1: Master Gate & Tenant Isolation',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Tenant Creation',
    collectionPath: '/tenants/tenant_alpha',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Pillar 2: Validation Blueprints (hasOnly)',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Tenant Registration',
    collectionPath: '/tenants/tenant_alpha',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Pillar 2: Identity Integrity (ownerUid == request.auth.uid)',
  },
  {
    id: 5,
    name: 'Denial-of-Wallet 1.5KB ID Poisoning',
    collectionPath: '/tenants/ poisoned_id_exceeding_128_chars',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Pillar 3: Path Variable Hardening (isValidId)',
  },
  {
    id: 6,
    name: 'Client-Timestamp Forgery',
    collectionPath: '/tenants/tenant_alpha/transactions/tx_01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Temporal Integrity (createdAt == request.time)',
  },
  {
    id: 7,
    name: 'Terminal Transaction State Reversal',
    collectionPath: '/tenants/tenant_alpha/transactions/tx_01',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Terminal State Locking',
  },
  {
    id: 8,
    name: 'Negative Recharge Amount Exploit',
    collectionPath: '/tenants/tenant_alpha/transactions/tx_02',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Pillar 2: Numeric Boundary Guard (amountInr > 0)',
  },
  {
    id: 9,
    name: 'Blanket List Query Scraping on Tenants',
    collectionPath: '/tenants',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Pillar 8: Secure List Queries (resource.data.ownerUid == request.auth.uid)',
  },
  {
    id: 10,
    name: 'Orphaned Subcollection Write',
    collectionPath: '/tenants/non_existent/wallets/w_01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Global Consistency Invariant (exists parent)',
  },
  {
    id: 11,
    name: 'Value Poisoning on Status Update',
    collectionPath: '/tenants/tenant_alpha',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Pillar 2: Anti-Update-Gap Blueprint Wrapping',
  },
  {
    id: 12,
    name: 'Immutable Field Mutation (ownerUid / createdAt)',
    collectionPath: '/tenants/tenant_alpha',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    pillarVerified: 'Immortal Field Rule',
  },
];
