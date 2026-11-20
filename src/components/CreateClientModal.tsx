import React, { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import {
  X,
  Building2,
  Globe,
  Mail,
  Phone,
  User,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Lock,
  Loader2,
  KeyRound,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';
import { db } from '../firebase';

export interface ExistingClientRecord {
  tenantId: string;
  ownerUid: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  customDomain: string;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  subscriptionPlanId: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'expired' | 'suspended';
  subscriptionExpiresAt: string;
  primaryColor: string;
  secondaryColor: string;
  logoText: string;
  apiProviderStatus: 'not_configured' | 'connected' | 'error';
  businessAddress?: string;
  country?: string;
  state?: string;
  city?: string;
  passwordHash?: string;
  notes?: string;
}

export interface CreatedClientSummary {
  tenantId: string;
  userId: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  passwordPlain: string;
  passwordHash: string;
  businessAddress: string;
  country: string;
  state: string;
  city: string;
  customDomain: string;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  subscriptionPlanId: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'expired' | 'suspended';
  subscriptionExpiresAt: string;
  primaryColor: string;
  secondaryColor: string;
  logoText: string;
  notes: string;
  isEdit?: boolean;
}

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUser | null;
  existingClients: ExistingClientRecord[];
  editingClient?: ExistingClientRecord | null;
  onSuccess: (summary: CreatedClientSummary) => void;
  onLoginAsClient?: (tenantId: string) => void;
}

export async function computeClientPasswordHash(plain: string, email: string): Promise<string> {
  const normalized = `${email.trim().toLowerCase()}::${plain}`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const buf = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `SHA256_${hex}`;
  }
  return `SHA256_${btoa(normalized).slice(0, 48)}`;
}

export function CreateClientModal({
  isOpen,
  onClose,
  currentUser,
  existingClients,
  editingClient,
  onSuccess,
  onLoginAsClient,
}: CreateClientModalProps) {
  const [businessName, setBusinessName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [businessAddress, setBusinessAddress] = useState<string>('');
  const [country, setCountry] = useState<string>('India');
  const [stateName, setStateName] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<
    'monthly' | 'quarterly' | 'yearly' | 'custom'
  >('yearly');
  const [initialStatus, setInitialStatus] = useState<'active' | 'pending' | 'suspended'>('active');
  const [subscriptionMode, setSubscriptionMode] = useState<'active' | 'trial'>('active');
  const [primaryColor, setPrimaryColor] = useState<string>('#4F46E5');
  const [secondaryColor, setSecondaryColor] = useState<string>('#0F172A');
  const [logoText, setLogoText] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [seedFull23Schema, setSeedFull23Schema] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [createdCredentials, setCreatedCredentials] = useState<CreatedClientSummary | null>(null);
  const [copiedCreds, setCopiedCreds] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormError('');
    setCreatedCredentials(null);
    if (editingClient) {
      setBusinessName(editingClient.businessName || '');
      setOwnerName(editingClient.ownerName || '');
      setEmail(editingClient.email || '');
      setPhone(editingClient.phone || '');
      setPassword('');
      setBusinessAddress(editingClient.businessAddress || 'Registered Commercial Office');
      setCountry(editingClient.country || 'India');
      setStateName(editingClient.state || 'West Bengal');
      setCity(editingClient.city || 'Kolkata');
      setCustomDomain(editingClient.customDomain || '');
      setSubscriptionPlanId(editingClient.subscriptionPlanId || 'yearly');
      setInitialStatus(
        editingClient.status === 'suspended'
          ? 'suspended'
          : editingClient.status === 'pending'
          ? 'pending'
          : 'active'
      );
      setSubscriptionMode(editingClient.subscriptionStatus === 'trial' ? 'trial' : 'active');
      setPrimaryColor(editingClient.primaryColor || '#4F46E5');
      setSecondaryColor(editingClient.secondaryColor || '#0F172A');
      setLogoText(editingClient.logoText || '');
      setNotes(editingClient.notes || '');
    } else {
      setBusinessName('');
      setOwnerName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setBusinessAddress('');
      setCountry('India');
      setStateName('');
      setCity('');
      setCustomDomain('');
      setSubscriptionPlanId('yearly');
      setInitialStatus('active');
      setSubscriptionMode('active');
      setPrimaryColor('#4F46E5');
      setSecondaryColor('#0F172A');
      setLogoText('');
      setNotes('');
    }
  }, [isOpen, editingClient]);

  if (!isOpen) return null;

  const calculateExpiryIso = (
    plan: 'monthly' | 'quarterly' | 'yearly' | 'custom',
    mode: 'active' | 'trial'
  ): string => {
    const now = new Date();
    if (mode === 'trial') {
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    }
    const days = plan === 'yearly' ? 365 : plan === 'quarterly' ? 90 : 30;
    now.setDate(now.getDate() + days);
    return now.toISOString();
  };

  const normalizeMobile = (raw: string): string => {
    return raw.replace(/[\s\-+]/g, '').slice(-10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!currentUser) {
      setFormError(
        'Database authentication required: Please sign in as Master Admin (top-right button) so the database can verify and persist the client record.'
      );
      return;
    }

    const cleanBusiness = businessName.trim();
    const cleanOwner = ownerName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();
    const cleanAddress = businessAddress.trim();
    const cleanCountry = country.trim();
    const cleanState = stateName.trim();
    const cleanCity = city.trim();
    const cleanDomain = customDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    const cleanLogo = (logoText.trim() || cleanBusiness.slice(0, 18)).toUpperCase().slice(0, 40);
    const cleanNotes = notes.trim().slice(0, 1000);

    // 1. Validate all required fields
    if (cleanBusiness.length < 2 || cleanBusiness.length > 120) {
      setFormError('Business Name is required and must be between 2 and 120 characters.');
      return;
    }
    if (cleanOwner.length < 2 || cleanOwner.length > 120) {
      setFormError('Owner Name is required and must be between 2 and 120 characters.');
      return;
    }
    if (cleanEmail.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('Please enter a valid Email Address (e.g. admin@clientdomain.in).');
      return;
    }
    const digitsOnlyPhone = cleanPhone.replace(/\D/g, '');
    if (digitsOnlyPhone.length < 10 || cleanPhone.length > 20) {
      setFormError('Mobile Number must contain at least 10 digits (maximum 20 characters).');
      return;
    }
    if (!editingClient && (cleanPassword.length < 6 || cleanPassword.length > 64)) {
      setFormError('Password is required and must be between 6 and 64 characters.');
      return;
    }
    if (cleanAddress.length < 3 || cleanAddress.length > 250) {
      setFormError('Business Address is required (3 to 250 characters).');
      return;
    }
    if (cleanCountry.length < 2 || cleanCountry.length > 80) {
      setFormError('Country is required (2 to 80 characters).');
      return;
    }
    if (cleanState.length < 2 || cleanState.length > 80) {
      setFormError('State is required (2 to 80 characters).');
      return;
    }
    if (cleanCity.length < 2 || cleanCity.length > 80) {
      setFormError('City is required (2 to 80 characters).');
      return;
    }
    if (cleanDomain.length < 3 || !cleanDomain.includes('.')) {
      setFormError('Custom Domain is required and must be a valid domain (e.g. clienta.com).');
      return;
    }

    // 2. Check duplicate email, duplicate mobile number, and duplicate custom domain
    const peerClients = existingClients.filter(
      (c) => !editingClient || c.tenantId !== editingClient.tenantId
    );

    const duplicateEmail = peerClients.find(
      (c) => c.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      setFormError(
        `Duplicate Email Address: "${cleanEmail}" is already registered to client "${duplicateEmail.businessName}" (${duplicateEmail.tenantId}).`
      );
      return;
    }

    const targetNormPhone = normalizeMobile(cleanPhone);
    const duplicatePhone = peerClients.find(
      (c) => normalizeMobile(c.phone) === targetNormPhone
    );
    if (duplicatePhone) {
      setFormError(
        `Duplicate Mobile Number: "${cleanPhone}" is already registered to client "${duplicatePhone.businessName}" (${duplicatePhone.tenantId}).`
      );
      return;
    }

    const duplicateDomain = peerClients.find(
      (c) => c.customDomain.trim().toLowerCase() === cleanDomain
    );
    if (duplicateDomain) {
      setFormError(
        `Duplicate Custom Domain: "${cleanDomain}" is already assigned to client "${duplicateDomain.businessName}" (${duplicateDomain.tenantId}).`
      );
      return;
    }

    setSubmitting(true);

    try {
      const ts = Date.now();
      const randSuffix = Math.random().toString(36).substring(2, 6);
      const tenantId = editingClient ? editingClient.tenantId : `tenant_${ts}_${randSuffix}`;
      const userId = `usr_admin_${tenantId}`;
      const uid = editingClient ? editingClient.ownerUid : currentUser.uid;
      const subscriptionExpiresAt = editingClient
        ? editingClient.subscriptionExpiresAt
        : calculateExpiryIso(subscriptionPlanId, subscriptionMode);

      const passwordHash = cleanPassword
        ? await computeClientPasswordHash(cleanPassword, cleanEmail)
        : editingClient?.passwordHash ||
          (await computeClientPasswordHash('Client@123', cleanEmail));

      if (editingClient) {
        // Update existing client record in /tenants/{tenantId}
        await updateDoc(doc(db, 'tenants', tenantId), {
          businessName: cleanBusiness,
          ownerName: cleanOwner,
          email: cleanEmail,
          phone: cleanPhone,
          customDomain: cleanDomain,
          status: initialStatus,
          subscriptionPlanId,
          subscriptionStatus: initialStatus === 'suspended' ? 'suspended' : subscriptionMode,
          primaryColor,
          secondaryColor,
          logoText: cleanLogo,
          businessAddress: cleanAddress,
          country: cleanCountry,
          state: cleanState,
          city: cleanCity,
          passwordHash,
          notes: cleanNotes,
          updatedAt: serverTimestamp(),
        });

        const logId = `aud_${ts}`;
        await setDoc(doc(db, 'audit_logs', logId), {
          logId,
          tenantId,
          actorUid: currentUser.uid,
          actorEmail: (currentUser.email || 'admin@rechargeexpres.in').slice(0, 160),
          action: 'MASTER_ADMIN_UPDATE_CLIENT',
          targetResource: `/tenants/${tenantId}`,
          details: `Updated client "${cleanBusiness}" (${cleanDomain}) in /tenants.`,
          createdAt: serverTimestamp(),
        });

        const updatedSummary: CreatedClientSummary = {
          tenantId,
          userId,
          businessName: cleanBusiness,
          ownerName: cleanOwner,
          email: cleanEmail,
          phone: cleanPhone,
          passwordPlain: cleanPassword || '(Unchanged)',
          passwordHash,
          businessAddress: cleanAddress,
          country: cleanCountry,
          state: cleanState,
          city: cleanCity,
          customDomain: cleanDomain,
          status: initialStatus,
          subscriptionPlanId,
          subscriptionStatus: initialStatus === 'suspended' ? 'suspended' : subscriptionMode,
          subscriptionExpiresAt,
          primaryColor,
          secondaryColor,
          logoText: cleanLogo,
          notes: cleanNotes,
          isEdit: true,
        };

        setSubmitting(false);
        onSuccess(updatedSummary);
        onClose();
        return;
      }

      // 3. Create primary client database record in /tenants/{tenantId}
      await setDoc(doc(db, 'tenants', tenantId), {
        tenantId,
        ownerUid: uid,
        businessName: cleanBusiness,
        ownerName: cleanOwner,
        email: cleanEmail,
        phone: cleanPhone,
        customDomain: cleanDomain,
        status: initialStatus,
        subscriptionPlanId,
        subscriptionStatus: initialStatus === 'suspended' ? 'suspended' : subscriptionMode,
        subscriptionExpiresAt,
        primaryColor,
        secondaryColor,
        logoText: cleanLogo,
        apiProviderStatus: 'not_configured',
        businessAddress: cleanAddress,
        country: cleanCountry,
        state: cleanState,
        city: cleanCity,
        passwordHash,
        notes: cleanNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Create Client Admin User, assign tenantId, assign subscription, save settings & domain mapping
      const batch = writeBatch(db);

      // /users/{userId} — Client Admin User assigned to tenantId
      batch.set(doc(db, 'users', userId), {
        userId,
        tenantId,
        ownerUid: uid,
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash,
        displayName: cleanOwner,
        roleName: 'client_admin',
        status: initialStatus === 'suspended' ? 'suspended' : 'active',
        createdAt: serverTimestamp(),
      });

      // /tenants/{tenantId}/tenant_settings/{settingId}
      const settingId = `set_${ts}`;
      batch.set(doc(db, 'tenants', tenantId, 'tenant_settings', settingId), {
        settingId,
        tenantId,
        ownerUid: uid,
        logoText: cleanLogo,
        primaryColor,
        secondaryColor,
        androidPackageName: `com.${tenantId.replace(/[^a-z0-9]/gi, '')}.recharge`,
        iosBundleId: `in.${tenantId.replace(/[^a-z0-9]/gi, '')}.ios`,
        appVersion: '1.0.0',
        supportEmail: cleanEmail,
        supportPhone: cleanPhone,
        updatedAt: serverTimestamp(),
      });

      // /tenants/{tenantId}/tenant_subscriptions/{subscriptionId}
      const subscriptionId = `sub_${ts}`;
      batch.set(doc(db, 'tenants', tenantId, 'tenant_subscriptions', subscriptionId), {
        subscriptionId,
        tenantId,
        ownerUid: uid,
        planId: subscriptionPlanId,
        status: initialStatus === 'suspended' ? 'suspended' : subscriptionMode,
        periodStart: new Date().toISOString(),
        periodEnd: subscriptionExpiresAt,
        autoRenew: true,
        updatedAt: serverTimestamp(),
      });

      // /tenant_domains/{domainId}
      const domainId = `dom_${ts}`;
      batch.set(doc(db, 'tenant_domains', domainId), {
        domainId,
        domain: cleanDomain,
        tenantId,
        ownerUid: uid,
        verificationTxtRecord: `rechargeexpres-verify=${tenantId}`,
        dnsVerified: initialStatus === 'active',
        sslStatus: initialStatus === 'active' ? 'active' : 'pending',
        status: initialStatus === 'active' ? 'active' : 'pending_verification',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (seedFull23Schema) {
        const walletId = `wal_${ts}`;
        batch.set(doc(db, 'tenants', tenantId, 'wallets', walletId), {
          walletId,
          tenantId,
          ownerUid: uid,
          accountType: 'client_settlement',
          balanceInr: 0,
          currency: 'INR',
          updatedAt: serverTimestamp(),
        });

        const credentialId = `cred_${ts}`;
        batch.set(
          doc(db, 'tenants', tenantId, 'recharge_api_credentials', credentialId),
          {
            credentialId,
            tenantId,
            ownerUid: uid,
            providerName: 'Pending Client Configuration',
            adapterType: 'standard_rest',
            apiBaseUrl: `https://api.${cleanDomain}/v1`,
            apiUsername: `admin_${tenantId}`,
            encryptedApiToken: 'AES256GCM_PENDING_CLIENT_TOKEN',
            encryptedApiKey: 'AES256GCM_PENDING_CLIENT_KEY',
            encryptedApiSecret: 'AES256GCM_PENDING_CLIENT_SECRET',
            callbackUrl: `https://${cleanDomain}/api/webhooks/recharge`,
            webhookSecretHash: 'SHA256_PENDING_WEBHOOK_SECRET',
            status: 'pending_test',
            mode: 'test',
            lastVerifiedBalanceInr: 0,
            updatedAt: serverTimestamp(),
          }
        );
      }

      // /audit_logs/{logId}
      const logId = `aud_${ts}`;
      batch.set(doc(db, 'audit_logs', logId), {
        logId,
        tenantId,
        actorUid: uid,
        actorEmail: (currentUser.email || 'admin@rechargeexpres.in').slice(0, 160),
        action: 'MASTER_ADMIN_CREATE_CLIENT',
        targetResource: `/tenants/${tenantId}`,
        details: `Created client "${cleanBusiness}" (${cleanDomain}) in ${cleanCity}, ${cleanState} with Client Admin user ${userId}.`,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      const summary: CreatedClientSummary = {
        tenantId,
        userId,
        businessName: cleanBusiness,
        ownerName: cleanOwner,
        email: cleanEmail,
        phone: cleanPhone,
        passwordPlain: cleanPassword,
        passwordHash,
        businessAddress: cleanAddress,
        country: cleanCountry,
        state: cleanState,
        city: cleanCity,
        customDomain: cleanDomain,
        status: initialStatus,
        subscriptionPlanId,
        subscriptionStatus: initialStatus === 'suspended' ? 'suspended' : subscriptionMode,
        subscriptionExpiresAt,
        primaryColor,
        secondaryColor,
        logoText: cleanLogo,
        notes: cleanNotes,
        isEdit: false,
      };

      setSubmitting(false);
      onSuccess(summary);
      setCreatedCredentials(summary);
    } catch (error) {
      setSubmitting(false);
      const errMsg =
        error instanceof Error ? error.message : 'Database write failed during client creation.';
      setFormError(`Database error: ${errMsg}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full overflow-hidden shadow-xl my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Master Admin Panel · Client Registration &amp; Provisioning
            </div>
            <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white mt-0.5">
              {createdCredentials
                ? 'Client Account Provisioned & Verified in Database'
                : editingClient
                ? `Edit Client Account — ${editingClient.businessName}`
                : 'Add New White-Label Client Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post-Creation Credentials Confirmation Screen */}
        {createdCredentials ? (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  Client Record &amp; Admin User Created in Database
                </div>
                <p>
                  Tenant <code className="font-mono font-bold">{createdCredentials.tenantId}</code>,
                  Client Admin user <code className="font-mono font-bold">{createdCredentials.userId}</code>,
                  subscription plan, domain mapping, and isolated recharge API vault have been committed to Firestore.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Generated Client Admin Login Credentials</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const text = `Tenant ID: ${createdCredentials.tenantId}\nDomain: ${createdCredentials.customDomain}\nLogin Email: ${createdCredentials.email}\nPassword: ${createdCredentials.passwordPlain}`;
                    navigator.clipboard.writeText(text);
                    setCopiedCreds(true);
                    setTimeout(() => setCopiedCreds(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {copiedCreds ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Credentials</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-400">Unique Tenant ID</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {createdCredentials.tenantId}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-400">Client Admin User ID</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {createdCredentials.userId}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-400">Client Login Email</div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {createdCredentials.email}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-400">Client Login Password</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {createdCredentials.passwordPlain}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-400">Assigned Custom Domain</div>
                  <div className="text-slate-900 dark:text-white mt-0.5">
                    {createdCredentials.customDomain}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-400">Subscription &amp; Status</div>
                  <div className="text-slate-900 dark:text-white uppercase mt-0.5">
                    {createdCredentials.subscriptionPlanId} · {createdCredentials.status}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Return to Master Admin Client List
              </button>
              {onLoginAsClient && (
                <button
                  type="button"
                  onClick={() => {
                    onLoginAsClient(createdCredentials.tenantId);
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 cursor-pointer"
                >
                  <span>Log In to {createdCredentials.businessName} Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Registration / Edit Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {formError && (
              <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Business, Owner & Login Credentials */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>1. Business Identity &amp; Client Admin Credentials</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Apex FinPay Recharge"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Owner Name *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@clientdomain.in"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9830012345"
                      className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {editingClient
                      ? 'Client Admin Password (leave blank to keep current)'
                      : 'Client Admin Login Password *'}
                  </label>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required={!editingClient}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          editingClient
                            ? 'Enter new password to reset...'
                            : 'Min 6 characters (e.g. Apex@2026)'
                        }
                        className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const gen = `Rx#${Math.random().toString(36).slice(2, 7).toUpperCase()}9`;
                        setPassword(gen);
                      }}
                      className="px-2.5 py-2 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap cursor-pointer"
                    >
                      Generate Password
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Business Address, Country, State & City */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>2. Registered Business Address &amp; Location</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Business Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="e.g. Plot 14, Sector V, Salt Lake Electronics Complex"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="e.g. West Bengal"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Kolkata"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Custom Domain & White-Label Branding */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>3. Custom Domain &amp; White-Label App Branding</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Custom Domain *
                  </label>
                  <input
                    type="text"
                    required
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="e.g. apexpay.in or recharge.apexpay.com"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Logo Wordmark
                  </label>
                  <input
                    type="text"
                    value={logoText}
                    onChange={(e) => setLogoText(e.target.value)}
                    placeholder="APEX PAY"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Brand Colours
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      title="Primary Brand Color"
                      className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer"
                    />
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      title="Secondary Surface Color"
                      className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Subscription Plan & Account Status */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>4. Subscription Plan &amp; Account Status</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'monthly', name: 'Monthly Plan', price: '₹499 / mo', days: '30 Days' },
                  { id: 'quarterly', name: 'Quarterly Plan', price: '₹1,299 / qtr', days: '90 Days' },
                  { id: 'yearly', name: 'Yearly Plan', price: '₹4,999 / yr', days: '365 Days' },
                  { id: 'custom', name: 'Custom Enterprise', price: 'Custom SLA', days: 'Flexible' },
                ].map((plan) => {
                  const selected = subscriptionPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() =>
                        setSubscriptionPlanId(
                          plan.id as 'monthly' | 'quarterly' | 'yearly' | 'custom'
                        )
                      }
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/60'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {plan.name}
                      </div>
                      <div className="text-sm font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {plan.price}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {plan.days}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account Status *
                  </label>
                  <select
                    value={initialStatus}
                    onChange={(e) =>
                      setInitialStatus(e.target.value as 'active' | 'pending' | 'suspended')
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="active">Active (Approved &amp; Live)</option>
                    <option value="pending">Pending Verification</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subscription Billing Mode
                  </label>
                  <select
                    value={subscriptionMode}
                    onChange={(e) => setSubscriptionMode(e.target.value as 'active' | 'trial')}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="active">Full Paid Subscription Term</option>
                    <option value="trial">7-Day Promotional Trial Period</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Internal Admin Notes (Optional, max 1,000 chars)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal onboarding notes, custom SLA details, or account remarks..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {!editingClient && (
                <label className="flex items-center gap-2.5 pt-1 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedFull23Schema}
                    onChange={(e) => setSeedFull23Schema(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    Create Client Admin user (<code className="font-mono">/users</code>), tenant settings (<code className="font-mono">/tenant_settings</code>), domain verification (<code className="font-mono">/tenant_domains</code>), settlement wallet (<code className="font-mono">/wallets</code>), and encrypted API slot (<code className="font-mono">/recharge_api_credentials</code>).
                  </span>
                </label>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingClient ? 'Save Client Changes' : 'Create Client'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
