# Security Specification — Recharge Expres Multi-Tenant SaaS

## 1. Data Invariants

1. **Master Admin Authority**: Only the verified platform owner (`www.maa365@gmail.com` with `email_verified == true` or a document in `/admins/{uid}`) holds cross-tenant Master Admin privileges.
2. **Strict Tenant Isolation (The Master Gate)**: Every sub-collection under `/tenants/{tenantId}/...` (including `api_configs`, `transactions`, `wallets`) derives its tenant boundary from `/tenants/{tenantId}`. Cross-tenant reads or writes are strictly denied.
3. **API Credential Confidentiality**: `/tenants/{tenantId}/api_configs/{configId}` is only readable and writable by the tenant owner (`get(/databases/$(database)/documents/tenants/$(tenantId)).data.ownerUid == request.auth.uid`) or Master Admin. Customers and retailers of that tenant can never read `api_configs`.
4. **Financial Account Separation**:
   - `/subscription_payments/{paymentId}` stores SaaS subscription fees collected by Recharge Expres.
   - `/tenants/{tenantId}/wallets/{walletId}` stores tenant-scoped customer/retailer funds.
5. **Strict Key & Size Enforcement**: Every create and update operation validates exact keys (`hasAll` and `hasOnly`), string length bounds, numeric ranges, and server timestamps (`request.time`).
6. **Terminal Transaction Locking**: Once a `RechargeTransaction` reaches `"Successful"` or `"Refunded"`, non-admin users cannot mutate its status.

## 2. The "Dirty Dozen" Payloads

1. **Unverified Admin Email Spoof**: User with `email: "www.maa365@gmail.com"` but `email_verified: false` attempting to read `/tenants/tenant_a`.
2. **Cross-Tenant API Credential Theft**: Owner of `tenant_b` attempting `get` on `/tenants/tenant_a/api_configs/primary`.
3. **Shadow Field Injection on Tenant Creation**: Payload containing extra ghost field `isSuperAdmin: true` in `/tenants/tenant_a`.
4. **Identity Spoofing on Tenant Registration**: Authenticated user `uid_attacker` creating `/tenants/tenant_a` with `ownerUid: "uid_victim"`.
5. **Denial-of-Wallet ID Poisoning**: Creating `/tenants/{1500_char_id}` exceeding 128-character regex ID guard.
6. **Client-Timestamp Forgery**: Creating a transaction with a past `createdAt` timestamp not equal to `request.time`.
7. **Terminal Transaction State Reversal**: User attempting to update a `"Successful"` transaction back to `"Failed"` to trigger a double refund.
8. **Negative Recharge Amount Exploit**: Creating a recharge transaction with `amountInr: -500` to credit wallet instead of debiting.
9. **Blanket List Query Scraping**: Calling `list` on `/tenants` or `/subscription_payments` as a regular user without filtering by `ownerUid == request.auth.uid`.
10. **Orphaned Subcollection Write**: Attempting to create `/tenants/non_existent_tenant/wallets/w1` when parent `/tenants/non_existent_tenant` does not exist.
11. **Value Poisoning on Update**: Updating `status` on `/tenants/tenant_a` with a boolean `true` or 10KB string instead of allowed enum values.
12. **Immutable Field Mutation**: Updating `tenantId`, `ownerUid`, or `createdAt` on an existing `/tenants/{tenantId}` document.
