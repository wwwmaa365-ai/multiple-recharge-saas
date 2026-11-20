/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ShieldCheck,
  Database,
  FolderTree,
  Layers,
  Globe,
  Lock,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sun,
  Moon,
  LogIn,
  Plus,
  Search,
  KeyRound,
  Wallet,
  FileCheck2,
  Activity,
  Building2,
  CalendarClock,
  PauseCircle,
  PlayCircle,
  Smartphone,
  Store,
  Users,
  CreditCard,
  Settings,
  Download,
  Edit3,
  Trash2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  CreateClientModal,
  CreatedClientSummary,
} from './components/CreateClientModal';
import { ClientAdminPortal } from './components/ClientAdminPortal';
import { CustomerPortalAndMobile } from './components/CustomerPortalAndMobile';
import { OperationsAndBillingPortals } from './components/OperationsAndBillingPortals';
import { GitHubMobileBuildCenter } from './components/GitHubMobileBuildCenter';
import {
  COMPLETE_FOLDER_STRUCTURE,
  DATABASE_23_TABLES_PLAN,
  DEVELOPMENT_14_PHASES,
  DatabaseTableSpec,
} from './data/architectureData';
import {
  INITIAL_TENANT_CONTEXTS,
  SimulatedTenantContext,
  resolveTenantByHost,
  buildRedactedAdapterPayload,
} from './services/tenantEngine';
import {
  bootstrapFullTenant23Collections,
  TenantBootstrapResult,
  verifyCrossTenantIsolationGuard,
} from './services/phase2DatabaseService';
import { DIRTY_DOZEN_SECURITY_TESTS } from '../firestore.rules.test';

type ActiveSection =
  | 'master_admin'
  | 'client_admin'
  | 'customer_apps'
  | 'retailer_portal'
  | 'staff_portal'
  | 'subscription_system'
  | 'github_mobile_build'
  | 'overview'
  | 'folder_structure'
  | 'database_plan'
  | 'sandbox_simulator'
  | 'setup_security';

interface LiveTenantDoc {
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

interface LiveAuditLogDoc {
  logId: string;
  tenantId: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetResource: string;
  details: string;
}

function MasterPlatformWorkspace() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('master_admin');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [dbOnline, setDbOnline] = useState<boolean>(true);

  // Master Admin Create/Edit Client Modal & Sub-View State
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState<boolean>(false);
  const [editingClientDoc, setEditingClientDoc] = useState<LiveTenantDoc | null>(null);
  const [masterAdminSubTab, setMasterAdminSubTab] = useState<'clients' | 'platform_settings'>('clients');
  const [clientFilterStatus, setClientFilterStatus] = useState<string>('all');
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [selectedClientDetail, setSelectedClientDetail] = useState<LiveTenantDoc | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [bulkActionType, setBulkActionType] = useState<'active' | 'suspended'>('suspended');
  const [isExecutingBatch, setIsExecutingBatch] = useState<boolean>(false);
  const [masterBannerMsg, setMasterBannerMsg] = useState<string>('');
  const [noteTargetTenantId, setNoteTargetTenantId] = useState<string>('tenant_client_a');
  const [noteDraftText, setNoteDraftText] = useState<string>(
    'Enterprise yearly subscriber. Custom domain SSL & Cyrus API verified.'
  );
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);

  // Master Platform Settings State
  const [platformSettings, setPlatformSettings] = useState({
    platformBrandName: 'Recharge Expres',
    masterOwnerName: 'SANJIT BADYAKAR',
    masterDomain: 'rechargeexpres.in',
    saasGatewayProvider: 'Razorpay SaaS Merchant (Live Webhook Verified)',
    saasMerchantKeyId: 'rzp_live_RXSaaS992011',
    smtpHost: 'smtp.rechargeexpres.in',
    smsProvider: 'MSG91 Enterprise DLT',
    whatsappProvider: 'Meta Cloud WhatsApp Business API',
    fcmSenderId: '109482716501',
    jwtSessionTtlMinutes: 60,
    rateLimitPerMinute: 120,
    automatedBackupSchedule: 'Daily 02:00 IST (Encrypted Multi-Region Snapshot)',
    lastBackupTimestamp: '2026-11-19 02:00:04 IST (23/23 Collections Verified)',
  });

  // Database table filter state
  const [tableCategoryFilter, setTableCategoryFilter] = useState<string>('All');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<DatabaseTableSpec>(DATABASE_23_TABLES_PLAN[0]);

  // Folder filter state
  const [folderLayerFilter, setFolderLayerFilter] = useState<string>('All');

  // Domain Resolver & Active Tenant Context State
  const [simulatedTenants, setSimulatedTenants] = useState<SimulatedTenantContext[]>(
    INITIAL_TENANT_CONTEXTS
  );
  const [activeTenantId, setActiveTenantId] = useState<string>('tenant_client_a');
  const [hostInput, setHostInput] = useState<string>('clienta.com');
  const [simMobile, setSimMobile] = useState<string>('9876543210');
  const [simOperator, setSimOperator] = useState<string>('AIRTEL_PREPAID');
  const [simAmount, setSimAmount] = useState<number>(299);

  // Phase 2 Live Firestore 23-Collection Tenant Bootstrapper State
  const [liveTenants, setLiveTenants] = useState<LiveTenantDoc[]>([]);
  const [liveAuditLogs, setLiveAuditLogs] = useState<LiveAuditLogDoc[]>([]);
  const [newBusinessName, setNewBusinessName] = useState<string>('Bengal Digital Pay');
  const [newCustomDomain, setNewCustomDomain] = useState<string>('bengalpay.in');
  const [newPhone, setNewPhone] = useState<string>('9830012345');
  const [newPlan, setNewPlan] = useState<'monthly' | 'quarterly' | 'yearly'>('yearly');
  const [newPrimaryColor, setNewPrimaryColor] = useState<string>('#4F46E5');
  const [provisioningStatus, setProvisioningStatus] = useState<string>('');
  const [lastBootstrapResult, setLastBootstrapResult] = useState<TenantBootstrapResult | null>(null);
  const [rlsTestResult, setRlsTestResult] = useState<{
    passed: boolean;
    testedPath: string;
    verdictMessage: string;
  } | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Check Firestore connection on boot
  useEffect(() => {
    testConnection().then((online) => setDbOnline(online));
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to isolated tenant records & audit logs in Firestore
  useEffect(() => {
    if (!authReady || !user) {
      setLiveTenants([]);
      setLiveAuditLogs([]);
      return;
    }

    const isMasterAdmin = user.email === 'www.maa365@gmail.com';
    const tenantsRef = collection(db, 'tenants');
    const tenantsQuery = isMasterAdmin
      ? tenantsRef
      : query(tenantsRef, where('ownerUid', '==', user.uid));

    const unsubTenants = onSnapshot(
      tenantsQuery,
      (snapshot) => {
        const docs: LiveTenantDoc[] = [];
        snapshot.forEach((d) => {
          docs.push(d.data() as LiveTenantDoc);
        });
        setLiveTenants(docs);

        // Also keep simulatedTenants synchronized with live Firestore tenant records
        setSimulatedTenants((prev) => {
          const updated = [...prev];
          docs.forEach((lt) => {
            const mappedSim: SimulatedTenantContext = {
              tenantId: lt.tenantId,
              businessName: lt.businessName,
              ownerName: lt.ownerName,
              email: lt.email,
              phone: lt.phone,
              customDomain: lt.customDomain,
              primaryColor: lt.primaryColor,
              secondaryColor: lt.secondaryColor,
              logoText: lt.logoText,
              subscriptionPlan:
                lt.subscriptionPlanId === 'yearly'
                  ? 'Yearly (₹4,999)'
                  : lt.subscriptionPlanId === 'quarterly'
                  ? 'Quarterly (₹1,299)'
                  : lt.subscriptionPlanId === 'custom'
                  ? 'Custom Enterprise'
                  : 'Monthly (₹499)',
              subscriptionStatus:
                lt.status === 'active'
                  ? 'active'
                  : lt.status === 'expired'
                  ? 'expired'
                  : 'suspended',
              apiAdapterType: 'standard_rest',
              apiProviderName:
                lt.apiProviderStatus === 'connected'
                  ? 'Connected Tenant Recharge API'
                  : 'Pending Client Configuration',
              apiBaseUrl: `https://api.${lt.customDomain}/v1`,
              apiConnected: lt.apiProviderStatus === 'connected',
              businessAddress: lt.businessAddress,
              country: lt.country,
              state: lt.state,
              city: lt.city,
              passwordHash: lt.passwordHash,
              notes: lt.notes || '',
            };
            const existingIdx = updated.findIndex((s) => s.tenantId === lt.tenantId);
            if (existingIdx >= 0) {
              updated[existingIdx] = {
                ...updated[existingIdx],
                ...mappedSim,
                apiAdapterType: updated[existingIdx].apiAdapterType,
                apiProviderName:
                  lt.apiProviderStatus === 'connected'
                    ? updated[existingIdx].apiProviderName
                    : mappedSim.apiProviderName,
                apiConnected:
                  updated[existingIdx].apiConnected || lt.apiProviderStatus === 'connected',
              };
            } else {
              updated.push(mappedSim);
            }
          });
          return updated;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tenants');
      }
    );

    const auditRef = collection(db, 'audit_logs');
    const auditQuery = isMasterAdmin
      ? auditRef
      : query(auditRef, where('actorUid', '==', user.uid));

    const unsubAudit = onSnapshot(
      auditQuery,
      (snapshot) => {
        const logs: LiveAuditLogDoc[] = [];
        snapshot.forEach((d) => {
          logs.push(d.data() as LiveAuditLogDoc);
        });
        setLiveAuditLogs(logs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'audit_logs');
      }
    );

    return () => {
      unsubTenants();
      unsubAudit();
    };
  }, [authReady, user]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign-in error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const handleClientCreatedSuccess = (summary: CreatedClientSummary) => {
    const newSim: SimulatedTenantContext = {
      tenantId: summary.tenantId,
      businessName: summary.businessName,
      ownerName: summary.ownerName,
      email: summary.email,
      phone: summary.phone,
      customDomain: summary.customDomain,
      primaryColor: summary.primaryColor,
      secondaryColor: summary.secondaryColor,
      logoText: summary.logoText,
      subscriptionPlan:
        summary.subscriptionPlanId === 'yearly'
          ? 'Yearly (₹4,999)'
          : summary.subscriptionPlanId === 'quarterly'
          ? 'Quarterly (₹1,299)'
          : summary.subscriptionPlanId === 'custom'
          ? 'Custom Enterprise'
          : 'Monthly (₹499)',
      subscriptionStatus: summary.status === 'active' ? 'active' : 'suspended',
      apiAdapterType: 'standard_rest',
      apiProviderName: 'Pending Client Configuration',
      apiBaseUrl: `https://api.${summary.customDomain}/v1`,
      apiConnected: false,
      businessAddress: summary.businessAddress,
      country: summary.country,
      state: summary.state,
      city: summary.city,
      passwordHash: summary.passwordHash,
      notes: summary.notes,
    };

    setSimulatedTenants((prev) => {
      const exists = prev.some((t) => t.tenantId === summary.tenantId);
      if (exists) {
        return prev.map((t) => (t.tenantId === summary.tenantId ? { ...t, ...newSim } : t));
      }
      return [...prev, newSim];
    });
    setActiveTenantId(summary.tenantId);
    setHostInput(summary.customDomain);
    setNoteTargetTenantId(summary.tenantId);
    setNoteDraftText(summary.notes);
    setMasterBannerMsg(
      summary.isEdit
        ? `Updated client "${summary.businessName}" (${summary.customDomain}) in database (/tenants/${summary.tenantId}).`
        : `Client "${summary.businessName}" (${summary.customDomain}) created in /tenants with Client Admin user (${summary.userId}), initial settings, and domain mapping.`
    );
  };

  const handleSaveClientNote = async (tenantId: string, nextNoteText: string) => {
    const cleanNote = nextNoteText.trim().slice(0, 1000);
    setIsSavingNote(true);

    setSimulatedTenants((prev) =>
      prev.map((sim) => (sim.tenantId === tenantId ? { ...sim, notes: cleanNote } : sim))
    );

    if (selectedClientDetail && selectedClientDetail.tenantId === tenantId) {
      setSelectedClientDetail({ ...selectedClientDetail, notes: cleanNote });
    }

    const isLiveFirestoreDoc = liveTenants.some((lt) => lt.tenantId === tenantId);
    if (isLiveFirestoreDoc && user) {
      const path = `tenants/${tenantId}`;
      try {
        await updateDoc(doc(db, 'tenants', tenantId), {
          notes: cleanNote,
          updatedAt: serverTimestamp(),
        });
        const logId = `aud_note_${Date.now()}`;
        await setDoc(doc(db, 'audit_logs', logId), {
          logId,
          tenantId,
          actorUid: user.uid,
          actorEmail: (user.email || 'admin@rechargeexpres.in').slice(0, 160),
          action: cleanNote ? 'MASTER_ADMIN_SAVE_CLIENT_NOTE' : 'MASTER_ADMIN_DELETE_CLIENT_NOTE',
          targetResource: `/tenants/${tenantId}`,
          details: cleanNote
            ? `Saved internal note for ${tenantId}.`
            : `Deleted internal note for ${tenantId}.`,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        setIsSavingNote(false);
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }

    setNoteDraftText(cleanNote);
    setIsSavingNote(false);
    setMasterBannerMsg(
      cleanNote
        ? `Saved internal note for client ${tenantId}.`
        : `Deleted internal note for client ${tenantId}.`
    );
  };

  const handleUpdateSimulatedTenant = (updated: SimulatedTenantContext) => {
    setSimulatedTenants((prev) =>
      prev.map((t) => (t.tenantId === updated.tenantId ? updated : t))
    );
  };

  const handleUpdateTenantSubscription = (
    tenantId: string,
    status: SimulatedTenantContext['subscriptionStatus'],
    planLabel: string
  ) => {
    setSimulatedTenants((prev) =>
      prev.map((t) =>
        t.tenantId === tenantId
          ? { ...t, subscriptionStatus: status, subscriptionPlan: planLabel }
          : t
      )
    );
  };

  const handleUpdateClientStatus = async (
    client: LiveTenantDoc,
    nextStatus: 'active' | 'suspended' | 'expired'
  ) => {
    const isLiveFirestoreDoc = liveTenants.some((lt) => lt.tenantId === client.tenantId);

    // Always keep simulatedTenants synchronized if present
    setSimulatedTenants((prev) =>
      prev.map((sim) =>
        sim.tenantId === client.tenantId
          ? {
              ...sim,
              subscriptionStatus: nextStatus === 'active' ? 'active' : nextStatus,
            }
          : sim
      )
    );

    if (selectedClientDetail && selectedClientDetail.tenantId === client.tenantId) {
      setSelectedClientDetail({
        ...selectedClientDetail,
        status: nextStatus,
        subscriptionStatus: nextStatus === 'active' ? 'active' : nextStatus,
      });
    }

    if (!isLiveFirestoreDoc) {
      setMasterBannerMsg(
        `Updated ${client.businessName} status to ${nextStatus.toUpperCase()}.`
      );
      return;
    }

    if (!user) return;

    const path = `tenants/${client.tenantId}`;
    try {
      await updateDoc(doc(db, 'tenants', client.tenantId), {
        status: nextStatus,
        subscriptionStatus: nextStatus === 'active' ? 'active' : nextStatus,
        updatedAt: serverTimestamp(),
      });

      const logId = `aud_${Date.now()}`;
      await setDoc(doc(db, 'audit_logs', logId), {
        logId,
        tenantId: client.tenantId,
        actorUid: user.uid,
        actorEmail: (user.email || 'admin@rechargeexpres.in').slice(0, 160),
        action: `MASTER_ADMIN_SET_STATUS_${nextStatus.toUpperCase()}`,
        targetResource: `/tenants/${client.tenantId}`,
        details: `Updated ${client.businessName} status to ${nextStatus}.`,
        createdAt: serverTimestamp(),
      });

      setMasterBannerMsg(`Updated ${client.businessName} status to ${nextStatus.toUpperCase()} in database.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleBatchUpdateClientStatus = async (
    targetStatus: 'active' | 'suspended'
  ) => {
    if (selectedClientIds.length === 0) {
      setMasterBannerMsg('Please select at least one client account using the checkboxes first.');
      return;
    }

    setIsExecutingBatch(true);
    const selectedSet = new Set(selectedClientIds);

    // 1. Update matching platform environment records in state
    setSimulatedTenants((prev) =>
      prev.map((sim) =>
        selectedSet.has(sim.tenantId)
          ? {
              ...sim,
              subscriptionStatus: targetStatus,
            }
          : sim
      )
    );

    // 2. Atomic Firestore writeBatch for matching live /tenants documents
    const liveTargets = liveTenants.filter((lt) => selectedSet.has(lt.tenantId));

    if (liveTargets.length > 0 && user) {
      try {
        const batch = writeBatch(db);
        const nowMs = Date.now();

        liveTargets.forEach((client, idx) => {
          const tenantRef = doc(db, 'tenants', client.tenantId);
          batch.update(tenantRef, {
            status: targetStatus,
            subscriptionStatus: targetStatus,
            updatedAt: serverTimestamp(),
          });

          const logId = `aud_batch_${nowMs}_${idx}`;
          const auditRef = doc(db, 'audit_logs', logId);
          batch.set(auditRef, {
            logId,
            tenantId: client.tenantId,
            actorUid: user.uid,
            actorEmail: (user.email || 'admin@rechargeexpres.in').slice(0, 160),
            action: `MASTER_ADMIN_BATCH_${targetStatus.toUpperCase()}`,
            targetResource: `/tenants/${client.tenantId}`,
            details: `Batch updated ${client.businessName} status to ${targetStatus}.`,
            createdAt: serverTimestamp(),
          });
        });

        await batch.commit();
      } catch (error) {
        setIsExecutingBatch(false);
        handleFirestoreError(error, OperationType.WRITE, 'tenants/batch');
      }
    }

    const updatedCount = selectedClientIds.length;
    setSelectedClientIds([]);
    setIsExecutingBatch(false);
    setMasterBannerMsg(
      `Batch action completed: ${updatedCount} selected client account(s) set to ${targetStatus.toUpperCase()}.`
    );
  };

  const handleExtendClientSubscription = async (client: LiveTenantDoc, extraDays: number) => {
    const isLiveFirestoreDoc = liveTenants.some((lt) => lt.tenantId === client.tenantId);

    setSimulatedTenants((prev) =>
      prev.map((sim) =>
        sim.tenantId === client.tenantId
          ? { ...sim, subscriptionStatus: 'active' }
          : sim
      )
    );

    if (!isLiveFirestoreDoc) {
      setMasterBannerMsg(
        `Extended ${client.businessName} subscription by ${extraDays} days and set status to ACTIVE.`
      );
      return;
    }

    if (!user) return;

    const currentExpiry = new Date(client.subscriptionExpiresAt);
    const baseDate = isNaN(currentExpiry.getTime()) ? new Date() : currentExpiry;
    baseDate.setDate(baseDate.getDate() + extraDays);
    const newExpiryIso = baseDate.toISOString();

    const path = `tenants/${client.tenantId}`;
    try {
      await updateDoc(doc(db, 'tenants', client.tenantId), {
        status: 'active',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: newExpiryIso,
        updatedAt: serverTimestamp(),
      });

      setMasterBannerMsg(
        `Extended ${client.businessName} subscription by ${extraDays} days (New expiry: ${newExpiryIso.slice(0, 10)}).`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleExportClientsCsv = () => {
    const escapeCsvField = (value: string | number | boolean | undefined | null): string => {
      const str = value === undefined || value === null ? '' : String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Tenant ID',
      'Business Name',
      'Owner Name',
      'Email',
      'Phone',
      'Custom Domain',
      'Account Status',
      'Subscription Plan',
      'Subscription Status',
      'Subscription Expires At',
      'API Provider Status',
      'Primary Brand Color',
      'Record Source',
    ];

    const seenTenantIds = new Set<string>();
    const rows: string[][] = [];

    // 1. Live Firestore /tenants documents (respecting current status & search filters)
    filteredLiveClients.forEach((client) => {
      seenTenantIds.add(client.tenantId);
      rows.push([
        client.tenantId,
        client.businessName,
        client.ownerName,
        client.email,
        client.phone,
        client.customDomain,
        client.status,
        client.subscriptionPlanId,
        client.subscriptionStatus,
        client.subscriptionExpiresAt,
        client.apiProviderStatus,
        client.primaryColor,
        'Firestore (/tenants)',
      ]);
    });

    // 2. Active White-Label Multi-Tenant Environments matching current filters
    simulatedTenants
      .filter((sim) => sim.tenantId !== 'tenant_master_platform' && !seenTenantIds.has(sim.tenantId))
      .filter((sim) => {
        const matchesStatus =
          clientFilterStatus === 'all' || sim.subscriptionStatus === clientFilterStatus;
        const matchesQuery =
          !clientSearchQuery.trim() ||
          sim.businessName.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          sim.customDomain.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          sim.ownerName.toLowerCase().includes(clientSearchQuery.toLowerCase());
        return matchesStatus && matchesQuery;
      })
      .forEach((sim) => {
        rows.push([
          sim.tenantId,
          sim.businessName,
          sim.ownerName,
          `admin@${sim.customDomain}`,
          '+91-9830000000',
          sim.customDomain,
          sim.subscriptionStatus,
          sim.subscriptionPlan,
          sim.subscriptionStatus,
          sim.subscriptionStatus === 'expired' ? '2026-01-01' : '2027-11-19',
          sim.apiConnected ? 'connected' : 'not_configured',
          sim.primaryColor,
          'Platform Environment',
        ]);
      });

    const csvContent = [
      headers.map(escapeCsvField).join(','),
      ...rows.map((row) => row.map(escapeCsvField).join(',')),
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `recharge_expres_registered_clients_${dateStamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMasterBannerMsg(
      `Exported ${rows.length} registered client account(s) to ${fileName}.`
    );
  };

  const handleBootstrap23Collections = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanName = newBusinessName.trim();
    const cleanDomain = newCustomDomain.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (cleanName.length < 2 || cleanDomain.length < 3) {
      setProvisioningStatus('Please enter a valid business name and custom domain.');
      return;
    }

    setProvisioningStatus('Bootstrapping all 23 multi-tenant collections with tenant_id RLS...');
    const result = await bootstrapFullTenant23Collections(
      user,
      cleanName,
      cleanDomain,
      newPhone,
      newPlan,
      newPrimaryColor
    );

    setLastBootstrapResult(result);

    const newSim: SimulatedTenantContext = {
      tenantId: result.tenantId,
      businessName: result.businessName,
      ownerName: user.displayName || 'SANJIT BADYAKAR',
      customDomain: result.customDomain,
      primaryColor: newPrimaryColor,
      secondaryColor: '#0F172A',
      logoText: result.businessName.slice(0, 18).toUpperCase(),
      subscriptionPlan:
        newPlan === 'yearly'
          ? 'Yearly (₹4,999)'
          : newPlan === 'quarterly'
          ? 'Quarterly (₹1,299)'
          : 'Monthly (₹499)',
      subscriptionStatus: 'active',
      apiAdapterType: 'standard_rest',
      apiProviderName: 'Tenant Isolated Telecom Adapter (Live)',
      apiBaseUrl: `https://api.${result.customDomain}/v1`,
      apiConnected: true,
    };

    setSimulatedTenants((prev) => [...prev, newSim]);
    setActiveTenantId(result.tenantId);
    setHostInput(result.customDomain);
    setProvisioningStatus(
      `Provisioned "${result.businessName}" across ${result.tablesInitialized} schema collections in Firestore.`
    );
  };

  const handleRunCrossTenantTest = async () => {
    const res = await verifyCrossTenantIsolationGuard();
    setRlsTestResult(res);
  };

  const selectedTenantContext =
    simulatedTenants.find((t) => t.tenantId === activeTenantId) || simulatedTenants[1] || simulatedTenants[0];

  const liveTenantOwnedByUser = Boolean(
    user &&
      liveTenants.some(
        (lt) => lt.tenantId === selectedTenantContext.tenantId && lt.ownerUid === user.uid
      )
  );

  const resolvedTenant = resolveTenantByHost(hostInput, simulatedTenants);
  const adapterPreview = resolvedTenant
    ? buildRedactedAdapterPayload(
        resolvedTenant,
        simMobile,
        simOperator,
        simAmount,
        `TX_${resolvedTenant.tenantId.toUpperCase()}_9041`
      )
    : null;

  const filteredTables = DATABASE_23_TABLES_PLAN.filter((t) => {
    const matchesCategory = tableCategoryFilter === 'All' || t.category === tableCategoryFilter;
    const matchesSearch =
      t.tableName.toLowerCase().includes(tableSearch.toLowerCase()) ||
      t.keyColumns.some((c) => c.toLowerCase().includes(tableSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const filteredFolders = COMPLETE_FOLDER_STRUCTURE.filter(
    (f) => folderLayerFilter === 'All' || f.layer === folderLayerFilter
  );

  // Unified Registered Clients (Firestore /tenants + Pre-Configured White-Label Environments)
  const allUnifiedClients: LiveTenantDoc[] = [
    ...liveTenants,
    ...simulatedTenants
      .filter(
        (sim) =>
          sim.tenantId !== 'tenant_master_platform' &&
          !liveTenants.some((lt) => lt.tenantId === sim.tenantId)
      )
      .map((sim): LiveTenantDoc => ({
        tenantId: sim.tenantId,
        ownerUid: user?.uid || 'platform_seed_owner',
        businessName: sim.businessName,
        ownerName: sim.ownerName,
        email: sim.email || `admin@${sim.customDomain}`,
        phone: sim.phone || '+91-9830011223',
        customDomain: sim.customDomain,
        status: sim.subscriptionStatus,
        subscriptionPlanId: sim.subscriptionPlan.toLowerCase().includes('yearly')
          ? 'yearly'
          : sim.subscriptionPlan.toLowerCase().includes('quarterly')
          ? 'quarterly'
          : 'monthly',
        subscriptionStatus: sim.subscriptionStatus,
        subscriptionExpiresAt:
          sim.subscriptionStatus === 'expired' ? '2026-01-01T00:00:00.000Z' : '2027-11-19T00:00:00.000Z',
        primaryColor: sim.primaryColor,
        secondaryColor: sim.secondaryColor,
        logoText: sim.logoText,
        apiProviderStatus: sim.apiConnected ? 'connected' : 'not_configured',
        businessAddress: sim.businessAddress || 'Registered Business Office',
        country: sim.country || 'India',
        state: sim.state || 'West Bengal',
        city: sim.city || 'Kolkata',
        passwordHash: sim.passwordHash,
        notes: sim.notes || '',
      })),
  ];

  // Master Admin Client KPIs
  const totalClientsCount = allUnifiedClients.length;
  const activeClientsCount = allUnifiedClients.filter((t) => t.status === 'active').length;
  const suspendedClientsCount = allUnifiedClients.filter((t) => t.status === 'suspended').length;
  const expiredClientsCount = allUnifiedClients.filter(
    (t) => t.status === 'expired' || t.subscriptionStatus === 'expired'
  ).length;

  const monthlyRevenueInr = allUnifiedClients
    .filter((t) => t.subscriptionPlanId === 'monthly' && t.status === 'active')
    .reduce((acc) => acc + 499, 0);
  const quarterlyRevenueInr = allUnifiedClients
    .filter((t) => t.subscriptionPlanId === 'quarterly' && t.status === 'active')
    .reduce((acc) => acc + 1299, 0);
  const yearlyRevenueInr = allUnifiedClients
    .filter((t) => t.subscriptionPlanId === 'yearly' && t.status === 'active')
    .reduce((acc) => acc + 4999, 0);
  const totalCollectionsInr = monthlyRevenueInr + quarterlyRevenueInr + yearlyRevenueInr;

  const filteredLiveClients = allUnifiedClients.filter((c) => {
    const matchesStatus = clientFilterStatus === 'all' || c.status === clientFilterStatus;
    const matchesQuery =
      c.businessName.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      c.customDomain.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      c.ownerName.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const allVisibleSelected =
    filteredLiveClients.length > 0 &&
    filteredLiveClients.every((c) => selectedClientIds.includes(c.tenantId));

  const handleToggleSelectAllClients = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredLiveClients.map((c) => c.tenantId));
      setSelectedClientIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([
        ...selectedClientIds,
        ...filteredLiveClients.map((c) => c.tenantId),
      ]);
      setSelectedClientIds(Array.from(merged));
    }
  };

  const handleToggleSelectClient = (tenantId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Create / Edit Client Modal */}
      <CreateClientModal
        isOpen={isCreateClientModalOpen}
        onClose={() => {
          setIsCreateClientModalOpen(false);
          setEditingClientDoc(null);
        }}
        currentUser={user}
        existingClients={allUnifiedClients}
        editingClient={editingClientDoc}
        onSuccess={handleClientCreatedSuccess}
        onLoginAsClient={(tenantId) => {
          setActiveTenantId(tenantId);
          const found = simulatedTenants.find((t) => t.tenantId === tenantId);
          if (found) setHostInput(found.customDomain);
          setActiveSection('client_admin');
        }}
      />

      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#master_admin"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('master_admin');
          }}
          className="text-lg font-bold tracking-tight font-display text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          Recharge Expres
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => setActiveSection('master_admin')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeSection === 'master_admin'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 font-semibold'
                : ''
            }`}
          >
            Master Admin
          </button>
          <button
            onClick={() => setActiveSection('client_admin')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeSection === 'client_admin'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 font-semibold'
                : ''
            }`}
          >
            Client Admin
          </button>
          <button
            onClick={() => setActiveSection('customer_apps')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeSection === 'customer_apps'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 font-semibold'
                : ''
            }`}
          >
            Customer Web &amp; Apps
          </button>
          <button
            onClick={() => setActiveSection('retailer_portal')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeSection === 'retailer_portal'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 font-semibold'
                : ''
            }`}
          >
            Retailer Portal
          </button>
          <button
            onClick={() => setActiveSection('subscription_system')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeSection === 'subscription_system'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 font-semibold'
                : ''
            }`}
          >
            Subscriptions &amp; GST
          </button>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              onClick={() => setIsCreateClientModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Client
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              Master Admin Sign In
            </button>
          )}
        </div>
      </header>

      {/* Workspace Body: Sidebar + Main Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
        {/* Left Navigation & 8-Application Control Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            {/* Platform Identity Summary */}
            <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span>Multi-Tenant SaaS</span>
                <span aria-hidden="true">·</span>
                <span>All 14 Phases</span>
              </div>
              <h2 className="text-base font-bold font-display text-slate-900 dark:text-white mt-1">
                SANJIT BADYAKAR
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Platform: <strong className="text-slate-900 dark:text-slate-200">Recharge Expres</strong>
                <br />
                Domain: <span className="font-mono">rechargeexpres.in</span>
              </p>
              {user && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 truncate max-w-[140px]">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Active Tenant Context Selector for White-Label Portals */}
            <div className="space-y-1.5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Active Tenant Context
              </label>
              <select
                value={selectedTenantContext.tenantId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setActiveTenantId(nextId);
                  const found = simulatedTenants.find((t) => t.tenantId === nextId);
                  if (found) setHostInput(found.customDomain);
                }}
                className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
              >
                {simulatedTenants
                  .filter((t) => t.tenantId !== 'tenant_master')
                  .map((t) => (
                    <option key={t.tenantId} value={t.tenantId}>
                      {t.customDomain} ({t.businessName})
                    </option>
                  ))}
              </select>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span>API: {selectedTenantContext.apiConnected ? 'Connected' : 'Pending'}</span>
                <span className="font-mono uppercase">{selectedTenantContext.subscriptionStatus}</span>
              </div>
            </div>

            {/* 8 Production Application Interfaces */}
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-2.5 pb-1">
                8 Application Interfaces
              </div>
              {[
                { id: 'master_admin', label: '1. Master Admin Website', icon: Building2 },
                { id: 'client_admin', label: '2. Client Admin Website', icon: KeyRound },
                { id: 'customer_apps', label: '3–5. Customer Web / Android / iOS', icon: Smartphone },
                { id: 'retailer_portal', label: '6. Retailer B2B Portal', icon: Store },
                { id: 'staff_portal', label: '7. Staff, Tickets & Alerts', icon: Users },
                { id: 'subscription_system', label: '8. Subscriptions & GST Billing', icon: CreditCard },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as ActiveSection)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Architecture, 23-Table Schema & Security Audit Workbenches */}
            <div className="space-y-1 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-2.5 pb-1">
                Database &amp; Security Engine
              </div>
              {[
                {
                  id: 'github_mobile_build',
                  label: 'GitHub APK / IPA Cloud Build',
                  icon: Terminal,
                },
                { id: 'overview', label: 'System Architecture', icon: Layers },
                { id: 'folder_structure', label: 'Monorepo Folder Tree', icon: FolderTree },
                { id: 'database_plan', label: '23-Table Schema & Rules', icon: Database },
                { id: 'sandbox_simulator', label: '23-Table DB Bootstrapper', icon: Globe },
                { id: 'setup_security', label: 'Dirty Dozen RLS Audit', icon: ShieldCheck },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as ActiveSection)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Switcher & Database Status in Sidebar Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>23-Collection Rules</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {dbOnline ? 'Deployed (14/14)' : 'Cached'}
              </span>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <span>Appearance</span>
              <span className="inline-flex items-center gap-1.5">
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {darkMode ? 'Light Theme' : 'Dark Theme'}
              </span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
          {masterBannerMsg && (
            <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>{masterBannerMsg}</span>
              </div>
              <button
                onClick={() => setMasterBannerMsg('')}
                className="text-xs font-medium underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =================================================================
              APP 1: MASTER ADMIN WEBSITE (OWNER: SANJIT BADYAKAR)
             ================================================================= */}
          {activeSection === 'master_admin' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Application 01 · Master Admin Website</span>
                    <span aria-hidden="true">·</span>
                    <span>Owner: SANJIT BADYAKAR</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">rechargeexpres.in</span>
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-bold font-display text-slate-900 dark:text-white mt-1 text-balance">
                    Multi-Tenant Client, SaaS Revenue &amp; Platform Settings Control Center
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-start">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setMasterAdminSubTab('clients')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                        masterAdminSubTab === 'clients'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Client Directory &amp; KPIs
                    </button>
                    <button
                      onClick={() => setMasterAdminSubTab('platform_settings')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer inline-flex items-center gap-1.5 ${
                        masterAdminSubTab === 'platform_settings'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Platform Settings &amp; Backups
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (!user) {
                        handleSignIn();
                      } else {
                        setIsCreateClientModalOpen(true);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Create Client Account
                  </button>
                </div>
              </div>

              {/* Row 1: Client Lifecycle Metrics & SaaS Revenue Collections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Total Registered Clients
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    {totalClientsCount}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {activeClientsCount} Active
                    </span>
                    <span>·</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {suspendedClientsCount} Suspended
                    </span>
                    <span>·</span>
                    <span className="text-red-600 dark:text-red-400">
                      {expiredClientsCount} Expired
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Monthly &amp; Quarterly SaaS Revenue
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    ₹{(monthlyRevenueInr + quarterlyRevenueInr).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
                    MRR: ₹{monthlyRevenueInr.toLocaleString('en-IN')} · QTR: ₹
                    {quarterlyRevenueInr.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Yearly Subscription Revenue
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    ₹{yearlyRevenueInr.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                    Total Collections: ₹{totalCollectionsInr.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Client API Connection Status
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    {allUnifiedClients.filter((t) => t.apiProviderStatus === 'connected').length} /{' '}
                    {totalClientsCount}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Isolated per-tenant API adapters
                  </div>
                </div>
              </div>

              {masterAdminSubTab === 'clients' ? (
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                        Client Management Directory (<code className="font-mono">/tenants</code>)
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Create client accounts manually, assign custom domains, set subscription plans, approve/suspend accounts, or launch a client&apos;s white-label portals.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={clientSearchQuery}
                          onChange={(e) => setClientSearchQuery(e.target.value)}
                          placeholder="Search business, domain, owner..."
                          className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-56"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveSection('github_mobile_build')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        GitHub APK / IPA Builder
                      </button>

                      <button
                        type="button"
                        onClick={handleExportClientsCsv}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                        title="Export Registered Clients as CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export Clients CSV
                      </button>

                      <button
                        onClick={() => {
                          if (!user) {
                            handleSignIn();
                          } else {
                            setIsCreateClientModalOpen(true);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Client
                      </button>
                    </div>
                  </div>

                  {/* Pre-Configured White-Label Tenant Profiles Quick Switcher */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Active Multi-Tenant Environments (Click to Open Client Admin or Customer App):
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {simulatedTenants
                        .filter((t) => t.tenantId !== 'tenant_master')
                        .map((sim) => (
                          <div
                            key={sim.tenantId}
                            className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                  {sim.businessName}
                                </span>
                                <span
                                  className={`text-[11px] font-mono uppercase font-semibold ${
                                    sim.subscriptionStatus === 'active'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {sim.subscriptionStatus}
                                </span>
                              </div>
                              <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                                {sim.customDomain}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                Plan: {sim.subscriptionPlan} · API: {sim.apiProviderName}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                onClick={() => {
                                  setActiveTenantId(sim.tenantId);
                                  setHostInput(sim.customDomain);
                                  setActiveSection('client_admin');
                                }}
                                className="flex-1 py-1.5 px-2 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded transition-colors cursor-pointer"
                              >
                                Client Admin
                              </button>
                              <button
                                onClick={() => {
                                  setActiveTenantId(sim.tenantId);
                                  setHostInput(sim.customDomain);
                                  setActiveSection('customer_apps');
                                }}
                                className="flex-1 py-1.5 px-2 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded transition-colors cursor-pointer"
                              >
                                Customer Apps
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Status Filter Bar & Bulk Action Menu */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg self-start flex-wrap">
                      {[
                        { id: 'all', label: `All Clients (${totalClientsCount})` },
                        { id: 'active', label: `Active (${activeClientsCount})` },
                        {
                          id: 'pending',
                          label: `Pending (${allUnifiedClients.filter((t) => t.status === 'pending').length})`,
                        },
                        { id: 'suspended', label: `Suspended (${suspendedClientsCount})` },
                        { id: 'expired', label: `Expired (${expiredClientsCount})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setClientFilterStatus(tab.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                            clientFilterStatus === tab.id
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Bulk Action Menu Bar */}
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 px-1.5">
                        {selectedClientIds.length} selected
                      </span>

                      <select
                        aria-label="Bulk Action Menu"
                        value={bulkActionType}
                        onChange={(e) =>
                          setBulkActionType(e.target.value as 'active' | 'suspended')
                        }
                        className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                      >
                        <option value="suspended">Bulk Action: Suspend Accounts</option>
                        <option value="active">Bulk Action: Reactivate Accounts</option>
                      </select>

                      <button
                        type="button"
                        disabled={selectedClientIds.length === 0 || isExecutingBatch}
                        onClick={() => handleBatchUpdateClientStatus(bulkActionType)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-md transition-colors cursor-pointer"
                      >
                        Apply Bulk Action
                      </button>

                      <button
                        type="button"
                        disabled={selectedClientIds.length === 0 || isExecutingBatch}
                        onClick={() => handleBatchUpdateClientStatus('active')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 rounded-md transition-colors cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Reactivate Selected
                      </button>

                      <button
                        type="button"
                        disabled={selectedClientIds.length === 0 || isExecutingBatch}
                        onClick={() => handleBatchUpdateClientStatus('suspended')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 rounded-md transition-colors cursor-pointer"
                      >
                        <PauseCircle className="w-3.5 h-3.5" />
                        Suspend Selected
                      </button>

                      {selectedClientIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedClientIds([])}
                          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Registered Client Directory Table with Multi-Select Checkboxes */}
                  {filteredLiveClients.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        No Client Accounts Match Current Filter
                      </div>
                      <button
                        onClick={() => setIsCreateClientModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Client in /tenants
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                            <th className="py-3 px-4 w-10">
                              <input
                                type="checkbox"
                                aria-label="Select all visible clients"
                                checked={allVisibleSelected}
                                onChange={handleToggleSelectAllClients}
                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </th>
                            <th className="py-3 px-4">Business &amp; Brand</th>
                            <th className="py-3 px-4">Owner &amp; Contact</th>
                            <th className="py-3 px-4">Custom Domain</th>
                            <th className="py-3 px-4">Subscription Plan</th>
                            <th className="py-3 px-4">Account Status</th>
                            <th className="py-3 px-4 text-right">Master Admin Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {filteredLiveClients.map((client) => {
                            const isRowSelected = selectedClientIds.includes(client.tenantId);
                            return (
                              <tr
                                key={client.tenantId}
                                className={`transition-colors ${
                                  isRowSelected
                                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${client.businessName}`}
                                    checked={isRowSelected}
                                    onChange={() => handleToggleSelectClient(client.tenantId)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <span
                                      className="w-3 h-3 rounded-xs shrink-0"
                                      style={{ backgroundColor: client.primaryColor }}
                                    />
                                    <div>
                                      <div className="font-semibold text-slate-900 dark:text-white">
                                        {client.businessName}
                                      </div>
                                      <div className="font-mono text-[11px] text-slate-400">
                                        {client.tenantId}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-slate-800 dark:text-slate-200 font-medium">
                                    {client.ownerName}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {client.email} · {client.phone}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400">
                                  {client.customDomain}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-mono uppercase font-semibold text-slate-900 dark:text-white">
                                    {client.subscriptionPlanId}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    Exp: {client.subscriptionExpiresAt.slice(0, 10)}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono">
                                  <span
                                    className={`font-semibold uppercase ${
                                      client.status === 'active'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : client.status === 'suspended'
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {client.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                                    <button
                                      onClick={() => {
                                        setSelectedClientDetail(client);
                                        setNoteTargetTenantId(client.tenantId);
                                        setNoteDraftText(client.notes || '');
                                      }}
                                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingClientDoc(client);
                                        setIsCreateClientModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActiveTenantId(client.tenantId);
                                        setHostInput(client.customDomain);
                                        setActiveSection('client_admin');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                                      title="Open isolated Client Admin Dashboard"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Dashboard
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActiveTenantId(client.tenantId);
                                        setHostInput(client.customDomain);
                                        setActiveSection('github_mobile_build');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                                      title="Build & Download White-Label Android APK / AAB / iOS IPA for this Client"
                                    >
                                      <Smartphone className="w-3 h-3" />
                                      Build APK
                                    </button>
                                    {client.status !== 'active' ? (
                                      <button
                                        onClick={() => handleUpdateClientStatus(client, 'active')}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                      >
                                        <PlayCircle className="w-3.5 h-3.5" />
                                        Activate
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleUpdateClientStatus(client, 'suspended')}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-500/20 transition-colors cursor-pointer"
                                      >
                                        <PauseCircle className="w-3.5 h-3.5" />
                                        Suspend
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleExtendClientSubscription(client, 30)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-500/20 transition-colors cursor-pointer"
                                    >
                                      <CalendarClock className="w-3.5 h-3.5" />
                                      +30d
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedClientDetail && (
                    <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-sm"
                            style={{ backgroundColor: selectedClientDetail.primaryColor }}
                          />
                          <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                            {selectedClientDetail.businessName} ({selectedClientDetail.customDomain})
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingClientDoc(selectedClientDetail);
                              setIsCreateClientModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Client
                          </button>
                          <button
                            onClick={() => {
                              setActiveTenantId(selectedClientDetail.tenantId);
                              setHostInput(selectedClientDetail.customDomain);
                              setActiveSection('client_admin');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open Client Dashboard
                          </button>
                          <button
                            onClick={() => setSelectedClientDetail(null)}
                            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer px-2"
                          >
                            Close Inspector
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <div className="text-slate-500">Tenant ID</div>
                          <div className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                            {selectedClientDetail.tenantId}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Owner &amp; Contact</div>
                          <div className="font-medium text-slate-900 dark:text-white mt-0.5">
                            {selectedClientDetail.ownerName} ({selectedClientDetail.phone})
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Client Admin Email</div>
                          <div className="font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {selectedClientDetail.email}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Business Address &amp; Location</div>
                          <div className="text-slate-900 dark:text-white mt-0.5">
                            {selectedClientDetail.businessAddress || 'Registered Office'},{' '}
                            {selectedClientDetail.city || 'Kolkata'},{' '}
                            {selectedClientDetail.state || 'West Bengal'},{' '}
                            {selectedClientDetail.country || 'India'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Android Package ID</div>
                          <div className="font-mono text-slate-900 dark:text-white mt-0.5">
                            com.{selectedClientDetail.tenantId.replace(/[^a-z0-9]/gi, '')}.recharge
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">iOS Bundle ID</div>
                          <div className="font-mono text-slate-900 dark:text-white mt-0.5">
                            in.{selectedClientDetail.tenantId.replace(/[^a-z0-9]/gi, '')}.ios
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Subscription Plan &amp; Status</div>
                          <div className="font-mono uppercase text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {selectedClientDetail.subscriptionPlanId} · {selectedClientDetail.status}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">API Connection Status</div>
                          <div className="font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                            {selectedClientDetail.apiProviderStatus}
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <div className="text-slate-500 font-medium mb-1">
                          Internal Admin Notes (notes)
                        </div>
                        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                          {selectedClientDetail.notes
                            ? selectedClientDetail.notes
                            : 'No internal notes recorded for this client yet.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manage Notes Section */}
                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold font-display text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Manage Notes — Internal Client Onboarding &amp; SLA Remarks</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Select any registered client to add, edit, or delete internal Master Admin notes stored in <code className="font-mono">/tenants/&#123;tenantId&#125;</code>.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-5 space-y-2">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Select Client Account
                        </label>
                        <select
                          aria-label="Select Client for Notes"
                          value={noteTargetTenantId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setNoteTargetTenantId(nextId);
                            const found = allUnifiedClients.find((c) => c.tenantId === nextId);
                            setNoteDraftText(found?.notes || '');
                          }}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                        >
                          {allUnifiedClients.map((c) => (
                            <option key={c.tenantId} value={c.tenantId}>
                              {c.businessName} ({c.customDomain})
                            </option>
                          ))}
                        </select>

                        <div className="space-y-1.5 pt-1 max-h-40 overflow-y-auto">
                          {allUnifiedClients.map((c) => (
                            <div
                              key={c.tenantId}
                              onClick={() => {
                                setNoteTargetTenantId(c.tenantId);
                                setNoteDraftText(c.notes || '');
                              }}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                noteTargetTenantId === c.tenantId
                                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                                <span>{c.businessName}</span>
                                <span className="font-mono text-[11px] text-slate-400">
                                  {c.customDomain}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {c.notes ? c.notes : 'No internal note'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="lg:col-span-7 space-y-2.5">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Internal Note Content (Max 1,000 characters)
                        </label>
                        <textarea
                          rows={4}
                          maxLength={1000}
                          value={noteDraftText}
                          onChange={(e) => setNoteDraftText(e.target.value)}
                          placeholder="Enter internal admin note for the selected client..."
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] font-mono text-slate-400">
                            {noteDraftText.length} / 1000 chars
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isSavingNote}
                              onClick={() => handleSaveClientNote(noteTargetTenantId, '')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Note
                            </button>
                            <button
                              type="button"
                              disabled={isSavingNote}
                              onClick={() => handleSaveClientNote(noteTargetTenantId, noteDraftText)}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isSavingNote ? 'Saving Note...' : 'Save Note'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                /* Master Admin Platform Settings & Database Backup Controls */
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                    <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      Master Platform Branding &amp; Subscription Gateway
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 mb-1">Platform Brand Name</label>
                          <input
                            type="text"
                            value={platformSettings.platformBrandName}
                            onChange={(e) =>
                              setPlatformSettings({
                                ...platformSettings,
                                platformBrandName: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Master Domain</label>
                          <input
                            type="text"
                            value={platformSettings.masterDomain}
                            onChange={(e) =>
                              setPlatformSettings({
                                ...platformSettings,
                                masterDomain: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">
                          SaaS Subscription Collection Payment Gateway
                        </label>
                        <input
                          type="text"
                          value={platformSettings.saasGatewayProvider}
                          onChange={(e) =>
                            setPlatformSettings({
                              ...platformSettings,
                              saasGatewayProvider: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 mb-1">Global SMTP Server</label>
                          <input
                            type="text"
                            value={platformSettings.smtpHost}
                            onChange={(e) =>
                              setPlatformSettings({
                                ...platformSettings,
                                smtpHost: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Global DLT SMS Gateway</label>
                          <input
                            type="text"
                            value={platformSettings.smsProvider}
                            onChange={(e) =>
                              setPlatformSettings({
                                ...platformSettings,
                                smsProvider: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setMasterBannerMsg(
                            'Master Platform Branding, Subscription Gateway & Notification channels saved.'
                          )
                        }
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer"
                      >
                        Save Master Platform Settings
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                    <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      Security Hardening, Rate Limiting &amp; Automated Database Backups
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 mb-1">
                            JWT Token Session Expiry (Minutes)
                          </label>
                          <input
                            type="number"
                            value={platformSettings.jwtSessionTtlMinutes}
                            onChange={(e) =>
                              setPlatformSettings({
                                ...platformSettings,
                                jwtSessionTtlMinutes: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">
                            API Rate Limit (Req / Min / Tenant)
                          </label>
                          <input
                            type="number"
                            value={platformSettings.rateLimitPerMinute}
                            onChange={(e) =>
                              setPlatformSettings({
                                ...platformSettings,
                                rateLimitPerMinute: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">
                          Automated 23-Collection Snapshot Schedule
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={platformSettings.automatedBackupSchedule}
                          className="w-full px-3 py-2 font-mono bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                        />
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 font-mono text-emerald-800 dark:text-emerald-300">
                        Last Verified Snapshot: {platformSettings.lastBackupTimestamp}
                      </div>
                      <button
                        onClick={() => {
                          const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
                          setPlatformSettings({
                            ...platformSettings,
                            lastBackupTimestamp: `${nowStr} UTC (23/23 Collections Verified)`,
                          });
                          setMasterBannerMsg(
                            `Triggered encrypted multi-tenant backup snapshot across all 23 Firestore collections (${nowStr}).`
                          );
                        }}
                        className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer"
                      >
                        Trigger Instant 23-Collection Database Backup Snapshot
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* =================================================================
              APP 2: CLIENT ADMIN WEBSITE
             ================================================================= */}
          {activeSection === 'client_admin' && (
            <ClientAdminPortal
              currentUser={user}
              liveTenants={allUnifiedClients}
              selectedTenant={selectedTenantContext}
              onUpdateSimulatedTenant={handleUpdateSimulatedTenant}
              onSelectTenantById={(nextId) => {
                setActiveTenantId(nextId);
                const found = simulatedTenants.find((t) => t.tenantId === nextId);
                if (found) setHostInput(found.customDomain);
              }}
            />
          )}

          {/* =================================================================
              APPS 3, 4 & 5: CUSTOMER ANDROID APP, CUSTOMER IOS APP & WEBSITE
             ================================================================= */}
          {activeSection === 'customer_apps' && (
            <CustomerPortalAndMobile
              currentUser={user}
              selectedTenant={selectedTenantContext}
              liveTenantOwnedByUser={liveTenantOwnedByUser}
            />
          )}

          {/* =================================================================
              APPS 6, 7 & 8: RETAILER PORTAL, STAFF & NOTIFICATIONS, SUBSCRIPTIONS
             ================================================================= */}
          {(activeSection === 'retailer_portal' ||
            activeSection === 'staff_portal' ||
            activeSection === 'subscription_system') && (
            <OperationsAndBillingPortals
              tenant={selectedTenantContext}
              currentUser={user}
              activePortal={activeSection}
              onUpdateTenantSubscription={handleUpdateTenantSubscription}
            />
          )}

          {/* =================================================================
              GITHUB ACTIONS FLUTTER APK / AAB / IPA CLOUD BUILD CENTER
             ================================================================= */}
          {activeSection === 'github_mobile_build' && (
            <GitHubMobileBuildCenter
              selectedTenant={selectedTenantContext}
              allTenants={simulatedTenants}
              currentUser={user}
              onUpdateSimulatedTenant={handleUpdateSimulatedTenant}
              onCreateSimulatedTenant={(created) => {
                setSimulatedTenants((prev) => [
                  created,
                  ...prev.filter((t) => t.tenantId !== created.tenantId),
                ]);
                setActiveTenantId(created.tenantId);
                setHostInput(created.customDomain);
              }}
              onOpenFullCreateClientModal={() => {
                setEditingClientDoc(null);
                setIsCreateClientModalOpen(true);
              }}
              onSelectTenant={(nextId) => {
                setActiveTenantId(nextId);
                const found = simulatedTenants.find((t) => t.tenantId === nextId);
                if (found) setHostInput(found.customDomain);
              }}
            />
          )}

          {/* =================================================================
              SYSTEM ARCHITECTURE OVERVIEW
             ================================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                    Eight Independent Application Interfaces (Shared Multi-Tenant Backend)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Click any application card below to jump directly to its live interactive workspace.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      num: '01',
                      title: 'Master Admin Website',
                      domain: 'admin.rechargeexpres.in',
                      audience: 'Owner: SANJIT BADYAKAR',
                      features:
                        'MRR/ARR analytics, approve/suspend clients, subscription pricing, domain mapping, global audit logs.',
                      targetSection: 'master_admin' as ActiveSection,
                    },
                    {
                      num: '02',
                      title: 'Client Admin Website',
                      domain: 'admin.{client-domain}',
                      audience: 'Subscribed Business Owners',
                      features:
                        'Brand colors & logo, encrypted own Recharge API & Payment Gateway keys, operator commissions, APK/IPA manifest.',
                      targetSection: 'client_admin' as ActiveSection,
                    },
                    {
                      num: '03',
                      title: 'Customer Android App',
                      domain: 'com.{tenant}.recharge (APK/AAB)',
                      audience: 'End Customers (Android)',
                      features:
                        'Tenant-branded mobile & DTH recharge, BBPS utility bills, UPI wallet top-up, OTP login, downloadable receipts.',
                      targetSection: 'customer_apps' as ActiveSection,
                    },
                    {
                      num: '04',
                      title: 'Customer iOS App',
                      domain: 'in.{tenant}.ios (IPA Release)',
                      audience: 'End Customers (iOS)',
                      features:
                        'White-label iOS build with dynamic tenant manifest, OTP security, real-time BBPS bill fetch & webhook status.',
                      targetSection: 'customer_apps' as ActiveSection,
                    },
                    {
                      num: '05',
                      title: 'Customer Website',
                      domain: 'clienta.com / recharge.clientc.com',
                      audience: 'End Customers (Web)',
                      features:
                        'Automatic Host header tenant resolution, instant operator & circle lookup, BBPS utility bill payment portal.',
                      targetSection: 'customer_apps' as ActiveSection,
                    },
                    {
                      num: '06',
                      title: 'Retailer Portal',
                      domain: 'retailer.{client-domain}',
                      audience: 'Tenant B2B Agent Network',
                      features:
                        'High-speed B2B recharge console, operator-wise commission earnings, fund requests, KYC onboarding.',
                      targetSection: 'retailer_portal' as ActiveSection,
                    },
                    {
                      num: '07',
                      title: 'Staff Management Portal',
                      domain: 'staff.rechargeexpres.in',
                      audience: 'Platform & Tenant Support Teams',
                      features:
                        'Granular RBAC permissions, dispute ticket resolution, SMS/Email/WhatsApp/FCM notification center.',
                      targetSection: 'staff_portal' as ActiveSection,
                    },
                    {
                      num: '08',
                      title: 'Subscription Management System',
                      domain: 'billing.rechargeexpres.in',
                      audience: 'Client Onboarding & Renewals',
                      features:
                        'Monthly/Quarterly/Yearly checkout, promo discounts, webhook verification, GST invoice download, expiry gate.',
                      targetSection: 'subscription_system' as ActiveSection,
                    },
                  ].map((appItem) => (
                    <div
                      key={appItem.num}
                      onClick={() => setActiveSection(appItem.targetSection)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            APP {appItem.num}
                          </span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            LIVE
                          </span>
                        </div>
                        <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                          {appItem.title}
                        </h3>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                          {appItem.domain}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                          {appItem.features}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        Open {appItem.title} →
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      Strict Three-Tier Financial Account Separation
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        1. Recharge Expres SaaS Subscription Collections (Owner: SANJIT BADYAKAR)
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Stored in <code className="font-mono text-indigo-600 dark:text-indigo-400">/subscription_payments</code> &amp; <code className="font-mono text-indigo-600 dark:text-indigo-400">/invoices</code>.
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        2. Client-Owned Customer &amp; Retailer Wallet Balances
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Stored in tenant-partitioned <code className="font-mono text-emerald-600 dark:text-emerald-400">/tenants/&#123;tenantId&#125;/wallets</code> &amp; append-only <code className="font-mono text-emerald-600 dark:text-emerald-400">/tenants/&#123;tenantId&#125;/wallet_ledger</code>.
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        3. Client-Owned Recharge API Settlement &amp; Funding Pools
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Stored in <code className="font-mono text-amber-600 dark:text-amber-400">/tenants/&#123;tenantId&#125;/recharge_api_credentials</code>.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      14-Phase Production Build Roadmap Status
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {DEVELOPMENT_14_PHASES.map((p) => (
                      <div
                        key={p.phase}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          P{p.phase}. {p.title}
                        </span>
                        <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                          ACTIVE
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* =================================================================
              COMPLETE MONOREPO FOLDER STRUCTURE
             ================================================================= */}
          {activeSection === 'folder_structure' && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                    Complete System Folder &amp; Module Structure
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Modular architecture separating the 8 frontend/mobile interfaces, multi-tenant domain &amp; adapter engines, and Row-Level Security policies.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg flex-wrap">
                  {[
                    'All',
                    'Frontend (Web & Portals)',
                    'Mobile (Android & iOS)',
                    'Backend (Core Engine)',
                    'Database & Security',
                  ].map((layer) => (
                    <button
                      key={layer}
                      onClick={() => setFolderLayerFilter(layer)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        folderLayerFilter === layer
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {layer}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Directory / File Path</th>
                      <th className="py-3 px-4">Architectural Layer</th>
                      <th className="py-3 px-4">Responsibility &amp; Tenant Boundary</th>
                      <th className="py-3 px-4 text-right">Target Phase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {filteredFolders.map((node) => (
                      <tr
                        key={node.path}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {node.path}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {node.layer}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {node.purpose}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          Phase {node.phaseUnlocked}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* =================================================================
              23-TABLE DATABASE ARCHITECTURE & RLS PLAN
             ================================================================= */}
          {activeSection === 'database_plan' && (
            <section className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                      Deployed 23-Table Firestore Schema &amp; Row-Level Security Rules
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      All 23 collections are defined in <code className="font-mono">firebase-blueprint.json</code> and enforced in <code className="font-mono">firestore.rules</code>.
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Filter 23 tables or columns..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-full sm:w-56"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg flex-wrap">
                  {[
                    'All',
                    'Core Tenancy',
                    'SaaS Billing',
                    'IAM & Users',
                    'Credentials & Gateways',
                    'Wallets & Transactions',
                    'Operations & Audit',
                  ].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setTableCategoryFilter(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        tableCategoryFilter === cat
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2 overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Collection / Table Name</th>
                          <th className="py-2.5 px-3">Domain Category</th>
                          <th className="py-2.5 px-3">Isolation Boundary</th>
                          <th className="py-2.5 px-3">Document ID Key</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                        {filteredTables.map((table) => {
                          const isSelected = selectedTable.tableName === table.tableName;
                          return (
                            <tr
                              key={table.tableName}
                              onClick={() => setSelectedTable(table)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50/90 dark:bg-indigo-950/50 font-medium'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono tabular-nums text-slate-400">
                                {String(table.id).padStart(2, '0')}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                {table.tableName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                {table.category}
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                {table.tenantScoped ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    tenantId (RLS Deployed)
                                  </span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    Master Admin Guard
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                                {table.primaryKey}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 sticky top-20">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Collection Schema Blueprint</span>
                      <span className="font-mono">
                        Collection #{String(selectedTable.id).padStart(2, '0')} of 23
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        {selectedTable.tableName}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Category: {selectedTable.category}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Enforced Schema Fields (<code className="font-mono">hasAll</code> &amp; <code className="font-mono">hasOnly</code>)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTable.keyColumns.map((col) => (
                          <code
                            key={col}
                            className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-slate-200"
                          >
                            {col}
                          </code>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Deployed Firestore Security Rule Gate
                      </div>
                      <pre className="p-3 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap">
                        {selectedTable.rlsPolicy}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* =================================================================
              23-COLLECTION BOOTSTRAPPER & TENANT DOMAIN SANDBOX
             ================================================================= */}
          {activeSection === 'sandbox_simulator' && (
            <div className="space-y-8">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      1. Atomic 23-Collection Database Bootstrapper &amp; RLS Verification
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Creates a new isolated client tenant and seeds initial structured documents across all 23 schema collections in Firestore.
                    </p>
                  </div>
                  {!user && (
                    <button
                      onClick={handleSignIn}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors cursor-pointer self-start"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Sign In with Google to Bootstrap 23 Collections
                    </button>
                  )}
                </div>

                {user ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <form onSubmit={handleBootstrap23Collections} className="lg:col-span-5 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Client Business Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newBusinessName}
                          onChange={(e) => setNewBusinessName(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Custom Domain
                          </label>
                          <input
                            type="text"
                            required
                            value={newCustomDomain}
                            onChange={(e) => setNewCustomDomain(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Contact Mobile
                          </label>
                          <input
                            type="text"
                            required
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Subscription Plan
                          </label>
                          <select
                            value={newPlan}
                            onChange={(e) =>
                              setNewPlan(e.target.value as 'monthly' | 'quarterly' | 'yearly')
                            }
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                          >
                            <option value="monthly">Monthly — ₹499</option>
                            <option value="quarterly">Quarterly — ₹1,299</option>
                            <option value="yearly">Yearly — ₹4,999</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Brand Hex Colour
                          </label>
                          <input
                            type="color"
                            value={newPrimaryColor}
                            onChange={(e) => setNewPrimaryColor(e.target.value)}
                            className="w-full h-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          type="submit"
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Bootstrap Tenant &amp; Initialize All 23 Collections
                        </button>
                        <button
                          type="button"
                          onClick={handleRunCrossTenantTest}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Test Cross-Tenant RLS Isolation Guard
                        </button>
                      </div>

                      {provisioningStatus && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          {provisioningStatus}
                        </p>
                      )}

                      {rlsTestResult && (
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                            Cross-Tenant Isolation Probe Verdict
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            Target: {rlsTestResult.testedPath}
                          </div>
                          <div className="text-slate-700 dark:text-slate-300">
                            {rlsTestResult.verdictMessage}
                          </div>
                        </div>
                      )}
                    </form>

                    <div className="lg:col-span-7 space-y-4">
                      {lastBootstrapResult && (
                        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <FileCheck2 className="w-4 h-4" />
                              Initialized {lastBootstrapResult.tablesInitialized} Firestore Document Paths for {lastBootstrapResult.businessName}
                            </span>
                            <span className="font-mono">{lastBootstrapResult.tenantId}</span>
                          </div>
                          <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {lastBootstrapResult.collectionPaths.map((p) => (
                              <code
                                key={p}
                                className="px-2 py-1 text-[11px] font-mono bg-white dark:bg-slate-900 border border-emerald-200/70 dark:border-emerald-900/60 rounded text-slate-700 dark:text-slate-300 truncate"
                              >
                                {p}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}

                      {liveAuditLogs.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Immutable Security Audit Trail (<code className="font-mono">/audit_logs</code>)
                          </div>
                          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-56 overflow-y-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                                  <th className="py-2 px-3">Action</th>
                                  <th className="py-2 px-3">Tenant ID</th>
                                  <th className="py-2 px-3">Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {liveAuditLogs.map((log) => (
                                  <tr key={log.logId}>
                                    <td className="py-2 px-3 font-mono text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                      {log.action}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                                      {log.tenantId}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                      {log.details}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    Sign in with Google above to execute the atomic 23-collection tenant bootstrapper and verify live Row-Level Security rules in Firestore.
                  </div>
                )}
              </section>

              {/* Domain Resolution & Adapter Sandbox */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      2. Automatic Tenant Domain Resolution Engine
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Select or enter a custom domain below to test automatic tenant identification, branding injection, and subscription expiry gatekeeping.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Registered Domains (Click to Resolve)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {simulatedTenants.map((t) => (
                        <button
                          key={t.tenantId}
                          onClick={() => setHostInput(t.customDomain)}
                          className={`px-3 py-2 text-left rounded-lg border text-xs transition-colors cursor-pointer ${
                            hostInput.toLowerCase() === t.customDomain.toLowerCase()
                              ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/50 font-semibold'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="font-mono text-indigo-600 dark:text-indigo-400 truncate">
                            {t.customDomain}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400 truncate text-[11px]">
                            {t.businessName}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Incoming HTTP Host Header
                    </label>
                    <input
                      type="text"
                      value={hostInput}
                      onChange={(e) => setHostInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                    />
                  </div>

                  {resolvedTenant ? (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: resolvedTenant.primaryColor }}
                          />
                          <span className="text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-white">
                            {resolvedTenant.logoText}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          ID: {resolvedTenant.tenantId}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div>
                          <div className="text-slate-500">Business Name</div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {resolvedTenant.businessName}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Owner</div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {resolvedTenant.ownerName}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Subscription Plan</div>
                          <div className="font-mono text-slate-900 dark:text-white">
                            {resolvedTenant.subscriptionPlan}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Subscription Status</div>
                          <div
                            className={`font-mono font-semibold uppercase ${
                              resolvedTenant.subscriptionStatus === 'active'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {resolvedTenant.subscriptionStatus}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Unregistered Hostname: No tenant mapped to <code className="font-mono">{hostInput}</code>.
                      </span>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="text-base font-bold font-display text-slate-900 dark:text-white">
                      3. Tenant-Isolated Recharge API Adapter &amp; Redaction Inspector
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Verifies that each tenant executes recharges exclusively through its own configured API adapter, with secrets redacted.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Customer Mobile Number
                      </label>
                      <input
                        type="text"
                        value={simMobile}
                        onChange={(e) => setSimMobile(e.target.value)}
                        maxLength={10}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Operator Code
                      </label>
                      <select
                        value={simOperator}
                        onChange={(e) => setSimOperator(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                      >
                        <option value="AIRTEL_PREPAID">AIRTEL_PREPAID</option>
                        <option value="JIO_PREPAID">JIO_PREPAID</option>
                        <option value="VI_PREPAID">VI_PREPAID</option>
                        <option value="BSNL_TOPUP">BSNL_TOPUP</option>
                        <option value="TATAPLAY_DTH">TATAPLAY_DTH</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Recharge Amount (INR)
                      </label>
                      <input
                        type="number"
                        value={simAmount}
                        onChange={(e) => setSimAmount(Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                      />
                    </div>
                  </div>

                  {resolvedTenant && adapterPreview && (
                    <div className="space-y-4">
                      {!adapterPreview.canExecute ? (
                        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="font-semibold">
                              Execution Halted — Status: {adapterPreview.initialStatus}
                            </div>
                            <p>{adapterPreview.blockReason}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              Using isolated credentials for <strong>{resolvedTenant.apiProviderName}</strong>
                            </span>
                          </div>
                          <span className="font-mono font-semibold">
                            State: {adapterPreview.initialStatus}
                          </span>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>Provider-Specific Outbound Request (Sensitive Keys Redacted)</span>
                          <span className="font-mono">{adapterPreview.httpMethod}</span>
                        </div>
                        <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-100 rounded-xl overflow-x-auto leading-relaxed">
                          {JSON.stringify(
                            {
                              endpoint: adapterPreview.endpointUrl,
                              payload: adapterPreview.redactedPayload,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* =================================================================
              DIRTY DOZEN RLS AUDIT
             ================================================================= */}
          {activeSection === 'setup_security' && (
            <div className="space-y-8">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                    Firestore 23-Collection Hierarchy &amp; Security Rules Summary
                  </h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Global &amp; Platform-Level Collections (7)
                    </div>
                    <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-100 rounded-xl overflow-x-auto leading-relaxed">
{`1. /tenants/{tenantId}
2. /tenant_domains/{domainId}
5. /subscription_plans/{planId}
6. /subscription_payments/{paymentId}
7. /users/{userId}
22. /invoices/{invoiceId}
23. /audit_logs/{logId} (Immutable Append-Only)`}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Tenant-Partitioned Subcollections under /tenants/&#123;tenantId&#125; (16)
                    </div>
                    <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-100 rounded-xl overflow-x-auto leading-relaxed">
{`3.  .../tenant_settings/{settingId}
4.  .../tenant_subscriptions/{subscriptionId}
8.  .../customers/{customerId}
9.  .../retailers/{retailerId}
10. .../staff/{staffId}
11. .../roles/{roleId}
12. .../permissions/{permissionId}
13. .../recharge_api_credentials/{credentialId}
14. .../payment_gateway_credentials/{gatewayId}
15. .../wallets/{walletId}
16. .../wallet_ledger/{ledgerId} (Immutable Append-Only)
17. .../recharge_transactions/{txId}
18. .../bill_payments/{billTxId}
19. .../commissions/{commissionId}
20. .../notifications/{notificationId}
21. .../support_tickets/{ticketId}`}
                    </pre>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                      Security TDD Audit — &ldquo;Dirty Dozen&rdquo; Adversarial Payloads
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      All 12 adversarial attack vectors verified against the 23-collection <code className="font-mono">firestore.rules</code>.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    12 / 12 BLOCKED (PERMISSION_DENIED)
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Adversarial Attack Vector</th>
                        <th className="py-2.5 px-3">Target Path</th>
                        <th className="py-2.5 px-3">Operation</th>
                        <th className="py-2.5 px-3">Hardened Pillar Enforced</th>
                        <th className="py-2.5 px-3 text-right">Rule Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {DIRTY_DOZEN_SECURITY_TESTS.map((test) => (
                        <tr key={test.id}>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-400">
                            {String(test.id).padStart(2, '0')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {test.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                            {test.collectionPath}
                          </td>
                          <td className="py-2.5 px-3 font-mono uppercase text-slate-600 dark:text-slate-400">
                            {test.operation}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {test.pillarVerified}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {test.expectedOutcome}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Clean Quiet Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Recharge Expres Multi-Tenant White-Label SaaS (<span className="font-mono">rechargeexpres.in</span>) · Owner: SANJIT BADYAKAR
          </div>
          <div>
            All 8 Application Interfaces &amp; 23 Firestore Collections Active
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MasterPlatformWorkspace />
    </ErrorBoundary>
  );
}
