/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Terminal,
  Copy,
  Check,
  Download,
  CheckCircle2,
  KeyRound,
  PlayCircle,
  Package,
  ShieldCheck,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { SimulatedTenantContext } from '../services/tenantEngine';
import {
  generateClientWhiteLabelPackages,
  GeneratedApkBuildResult,
  triggerBrowserFileDownload,
} from '../services/clientApkBuilderService';

interface GitHubMobileBuildCenterProps {
  selectedTenant: SimulatedTenantContext;
  allTenants: SimulatedTenantContext[];
  onSelectTenant: (tenantId: string) => void;
}

type BuildCenterTab =
  | 'whitelabel_generator'
  | 'mobile_workflow_guide'
  | 'workflows_and_source'
  | 'secrets_and_signing'
  | 'error_diagnostics';

interface GeneratedFileSpec {
  path: string;
  title: string;
  category: 'GitHub Actions Workflow' | 'Flutter Dart Source' | 'Android / iOS Config';
  description: string;
  content: string;
}

const GENERATED_PROJECT_FILES: GeneratedFileSpec[] = [
  {
    path: '.github/workflows/android-build.yml',
    title: 'Android APK & AAB Cloud Build Workflow (Fixed White-Label Preservation)',
    category: 'GitHub Actions Workflow',
    description:
      'Ubuntu runner workflow triggered via mobile browser workflow_dispatch or push to main. Preserves white-label build.gradle and AndroidManifest.xml during scaffolding, then builds and uploads APK and AAB artifacts.',
    content: `name: Android Build (APK & AAB) — Recharge Expres SaaS

on:
  push:
    branches: [ main ]
    paths:
      - 'mobile_flutter/**'
      - '.github/workflows/android-build.yml'
  workflow_dispatch:
    inputs:
      app_name:
        description: 'White-Label Application Display Name'
        required: true
        default: 'Recharge Expres'
      package_id:
        description: 'Android Application ID / Package Name'
        required: true
        default: 'in.rechargeexpres.app'
      tenant_id:
        description: 'Backend Tenant Identifier'
        required: true
        default: 'tenant_master_platform'
      tenant_domain:
        description: 'Tenant Custom Domain'
        required: true
        default: 'rechargeexpres.in'
      primary_color_hex:
        description: 'Brand Primary Hex Color (without #)'
        required: true
        default: '4F46E5'`,
  },
  {
    path: '.github/workflows/ios-build.yml',
    title: 'iOS IPA Cloud Build Workflow (macOS + Xcode)',
    category: 'GitHub Actions Workflow',
    description:
      'macOS runner workflow that preserves custom Info.plist, configures Apple signing via IOS_CERTIFICATE_BASE64 / APPLE_TEAM_ID (or creates an unsigned archive if secrets are absent), and uploads the IPA artifact.',
    content: `name: iOS Build (IPA) — Recharge Expres SaaS

on:
  push:
    branches: [ main ]
    paths:
      - 'mobile_flutter/**'
      - '.github/workflows/ios-build.yml'
  workflow_dispatch:
    inputs:
      app_name:
        description: 'White-Label Application Display Name'
        required: true
        default: 'Recharge Expres'
      bundle_id:
        description: 'iOS Bundle Identifier'
        required: true
        default: 'in.rechargeexpres.app'
      tenant_id:
        description: 'Backend Tenant Identifier'
        required: true
        default: 'tenant_master_platform'
      tenant_domain:
        description: 'Tenant Custom Domain'
        required: true
        default: 'rechargeexpres.in'
      primary_color_hex:
        description: 'Brand Primary Hex Color (without #)'
        required: true
        default: '4F46E5'`,
  },
  {
    path: 'mobile_flutter/pubspec.yaml',
    title: 'Flutter Project Manifest',
    category: 'Flutter Dart Source',
    description: 'Defines dependencies and SDK constraints for Recharge Expres Flutter app.',
    content: `name: recharge_expres_mobile
description: "Recharge Expres Multi-Tenant White-Label Mobile Recharge & BBPS Bill Payment Application (Owner: SANJIT BADYAKAR)"
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.6

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true`,
  },
  {
    path: 'mobile_flutter/lib/config/env_config.dart',
    title: 'White-Label & Dev/Prod Environment Config',
    category: 'Flutter Dart Source',
    description:
      'Reads compile-time --dart-define values (APP_NAME, PACKAGE_ID, TENANT_ID, TENANT_DOMAIN, PRIMARY_COLOR_HEX, APP_ENV) with zero hardcoded secrets.',
    content: `import 'package:flutter/material.dart';

class TenantBuildConfig {
  static const String appName = String.fromEnvironment('APP_NAME', defaultValue: 'Recharge Expres');
  static const String packageId = String.fromEnvironment('PACKAGE_ID', defaultValue: 'in.rechargeexpres.app');
  static const String tenantId = String.fromEnvironment('TENANT_ID', defaultValue: 'tenant_master_platform');
  static const String tenantDomain = String.fromEnvironment('TENANT_DOMAIN', defaultValue: 'rechargeexpres.in');
  static const String primaryColorHex = String.fromEnvironment('PRIMARY_COLOR_HEX', defaultValue: '4F46E5');
  static const String appEnv = String.fromEnvironment('APP_ENV', defaultValue: 'production');
}`,
  },
  {
    path: 'mobile_flutter/android/app/build.gradle',
    title: 'Android Gradle Configuration & Keystore Signing',
    category: 'Android / iOS Config',
    description:
      'Configures namespace in.rechargeexpres.app, white-label PACKAGE_ID override, and automatic fallback between production GitHub Secrets keystore and unsigned testing builds.',
    content: `defaultConfig {
    applicationId System.getenv("PACKAGE_ID") ?: "in.rechargeexpres.app"
    minSdkVersion 23
    targetSdkVersion flutter.targetSdkVersion
    versionCode 1
    versionName "1.0.0"
        manifestPlaceholders += [
            applicationName: "android.app.Application",
            appName: System.getenv("APP_NAME") ?: "Recharge Expres"
        ]
    }
}`,
  },
  {
    path: 'mobile_flutter/ios/Runner/Info.plist',
    title: 'iOS Bundle Configuration (in.rechargeexpres.app)',
    category: 'Android / iOS Config',
    description: 'Configures CFBundleDisplayName (Recharge Expres) and CFBundleIdentifier (in.rechargeexpres.app).',
    content: `<key>CFBundleDisplayName</key>
<string>Recharge Expres</string>
<key>CFBundleIdentifier</key>
<string>in.rechargeexpres.app</string>`,
  },
];

export const GitHubMobileBuildCenter: React.FC<GitHubMobileBuildCenterProps> = ({
  selectedTenant,
  allTenants,
  onSelectTenant,
}) => {
  const [activeTab, setActiveTab] = useState<BuildCenterTab>('whitelabel_generator');
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string>('');

  // White-Label Build Dispatch & Instant Package Builder Inputs
  const isMaster = selectedTenant.tenantId === 'tenant_master_platform';
  const computedDefaultPkg = isMaster
    ? 'in.rechargeexpres.app'
    : `com.${selectedTenant.tenantId.replace(/[^a-z0-9]/gi, '').toLowerCase()}.recharge`;
  const computedDefaultIos = isMaster
    ? 'in.rechargeexpres.app'
    : `in.${selectedTenant.tenantId.replace(/[^a-z0-9]/gi, '').toLowerCase()}.ios`;

  const [customAppName, setCustomAppName] = useState<string>(
    isMaster ? 'Recharge Expres' : selectedTenant.businessName
  );
  const [customPackageId, setCustomPackageId] = useState<string>(computedDefaultPkg);
  const [customIosBundleId, setCustomIosBundleId] = useState<string>(computedDefaultIos);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [buildEnv, setBuildEnv] = useState<'production' | 'development'>('production');
  const [publishRelease, setPublishRelease] = useState<'false' | 'true'>('false');
  const [releaseTag, setReleaseTag] = useState<string>('v1.0.0');

  // Instant Client APK / AAB / IPA Build State
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildResult, setBuildResult] = useState<GeneratedApkBuildResult | null>(null);
  const [buildHistory, setBuildHistory] = useState<GeneratedApkBuildResult[]>([]);

  // GitHub Actions Remote API Trigger State (Optional PAT dispatch from browser)
  const [githubOwner, setGithubOwner] = useState<string>('sanjitbadyakar');
  const [githubRepo, setGithubRepo] = useState<string>('recharge-expres-saas');
  const [githubPat, setGithubPat] = useState<string>('');
  const [dispatchStatus, setDispatchStatus] = useState<string>('');
  const [isDispatchingGh, setIsDispatchingGh] = useState<boolean>(false);

  // Sync form inputs whenever selectedTenant changes
  useEffect(() => {
    const master = selectedTenant.tenantId === 'tenant_master_platform';
    const pkg = master
      ? 'in.rechargeexpres.app'
      : `com.${selectedTenant.tenantId.replace(/[^a-z0-9]/gi, '').toLowerCase()}.recharge`;
    const iosPkg = master
      ? 'in.rechargeexpres.app'
      : `in.${selectedTenant.tenantId.replace(/[^a-z0-9]/gi, '').toLowerCase()}.ios`;
    setCustomAppName(master ? 'Recharge Expres' : selectedTenant.businessName);
    setCustomPackageId(pkg);
    setCustomIosBundleId(iosPkg);
  }, [selectedTenant]);

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleDownloadFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\//g, '_');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunClientApkBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBuilding(true);

    const result = await generateClientWhiteLabelPackages({
      tenantId: selectedTenant.tenantId,
      businessName: customAppName.trim() || selectedTenant.businessName,
      customDomain: selectedTenant.customDomain,
      logoText: selectedTenant.logoText,
      primaryColor: selectedTenant.primaryColor,
      secondaryColor: selectedTenant.secondaryColor,
      androidPackageId: customPackageId.trim() || computedDefaultPkg,
      iosBundleId: customIosBundleId.trim() || computedDefaultIos,
      appVersion: appVersion.trim() || '1.0.0',
      versionCode: 1,
      buildEnvironment: buildEnv,
      signingMode: 'debug_testing_key',
    });

    setBuildResult(result);
    setBuildHistory((prev) => [result, ...prev.slice(0, 7)]);
    setIsBuilding(false);
  };

  const handleTriggerGitHubWorkflowDispatch = async (workflowFile: 'android-build.yml' | 'ios-build.yml') => {
    if (!githubPat.trim()) {
      setDispatchStatus(
        'Enter a GitHub Personal Access Token (with workflow scope) to trigger directly via API, or tap "Open GitHub Actions Tab" to trigger in your browser.'
      );
      return;
    }

    setIsDispatchingGh(true);
    setDispatchStatus(`Dispatching ${workflowFile} on ${githubOwner}/${githubRepo}...`);

    try {
      const inputs =
        workflowFile === 'android-build.yml'
          ? {
              app_name: customAppName.trim(),
              package_id: customPackageId.trim(),
              tenant_id: selectedTenant.tenantId,
              tenant_domain: selectedTenant.customDomain,
              primary_color_hex: selectedTenant.primaryColor.replace('#', ''),
              environment: buildEnv,
              publish_release: publishRelease,
              release_tag: releaseTag,
            }
          : {
              app_name: customAppName.trim(),
              bundle_id: customIosBundleId.trim(),
              tenant_id: selectedTenant.tenantId,
              tenant_domain: selectedTenant.customDomain,
              primary_color_hex: selectedTenant.primaryColor.replace('#', ''),
              environment: buildEnv,
              publish_release: publishRelease,
              release_tag: releaseTag,
            };

      const resp = await fetch(
        `https://api.github.com/repos/${githubOwner.trim()}/${githubRepo.trim()}/actions/workflows/${workflowFile}/dispatches`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${githubPat.trim()}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs,
          }),
        }
      );

      if (resp.status === 204) {
        setDispatchStatus(
          `SUCCESS (HTTP 204): GitHub Actions cloud build triggered for ${customAppName} (${customPackageId}) on ${githubOwner}/${githubRepo}!`
        );
      } else {
        const errText = await resp.text();
        setDispatchStatus(`GitHub API returned HTTP ${resp.status}: ${errText}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error calling GitHub API';
      setDispatchStatus(`GitHub API Error: ${msg}`);
    } finally {
      setIsDispatchingGh(false);
    }
  };

  const dispatchParametersJson = JSON.stringify(
    {
      repository: `${githubOwner}/${githubRepo}`,
      workflow_android: '.github/workflows/android-build.yml',
      workflow_ios: '.github/workflows/ios-build.yml',
      inputs: {
        app_name: customAppName,
        package_id: customPackageId,
        bundle_id: customIosBundleId,
        tenant_id: selectedTenant.tenantId,
        tenant_domain: selectedTenant.customDomain,
        primary_color_hex: selectedTenant.primaryColor.replace('#', ''),
        environment: buildEnv,
        publish_release: publishRelease,
        release_tag: releaseTag,
      },
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
              <span>Android Phone Cloud DevOps</span>
              <span>·</span>
              <span className="font-mono">repo: recharge-expres-saas</span>
              <span>·</span>
              <span className="font-mono">package: {customPackageId}</span>
            </div>
            <h2 className="text-xl lg:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
              Client White-Label APK / AAB / iOS IPA Builder &amp; GitHub Cloud Dispatch
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Build and download tenant-specific Android APK, Play Store AAB, iOS IPA, and Flutter source packages directly in your mobile browser, or trigger GitHub Actions cloud runners.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
            {[
              { id: 'whitelabel_generator', label: '1. Build & Download Client APK' },
              { id: 'mobile_workflow_guide', label: '2. Mobile Phone Build Guide' },
              { id: 'workflows_and_source', label: '3. Created Files & Workflows' },
              { id: 'secrets_and_signing', label: '4. Signing Secrets' },
              { id: 'error_diagnostics', label: '5. Build Error Doctor' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as BuildCenterTab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: WHITE-LABEL CLIENT APK / AAB / IPA BUILDER & DOWNLOADER
         ===================================================================== */}
      {activeTab === 'whitelabel_generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Client APK Configuration & Build Trigger */}
          <form
            onSubmit={handleRunClientApkBuild}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div>
              <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                1. Configure &amp; Build Client White-Label App
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Select any registered client account below to compile its isolated Android APK container, AAB bundle, iOS IPA, and Flutter source ZIP.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Select Registered Client Tenant *
              </label>
              <select
                value={selectedTenant.tenantId}
                onChange={(e) => onSelectTenant(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
              >
                {allTenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.businessName} ({t.customDomain} · {t.tenantId})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  White-Label App Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={customAppName}
                  onChange={(e) => setCustomAppName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Release Version *
                </label>
                <input
                  type="text"
                  required
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Android Package ID *
                </label>
                <input
                  type="text"
                  required
                  value={customPackageId}
                  onChange={(e) => setCustomPackageId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  iOS Bundle ID *
                </label>
                <input
                  type="text"
                  required
                  value={customIosBundleId}
                  onChange={(e) => setCustomIosBundleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Environment
                </label>
                <select
                  value={buildEnv}
                  onChange={(e) => setBuildEnv(e.target.value as 'production' | 'development')}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="production">production</option>
                  <option value="development">development</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Publish GitHub Release?
                </label>
                <select
                  value={publishRelease}
                  onChange={(e) => setPublishRelease(e.target.value as 'false' | 'true')}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="false">false (Artifacts Only)</option>
                  <option value="true">true (Publish Tag)</option>
                </select>
              </div>
            </div>

            {publishRelease === 'true' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Versioned Release Tag
                </label>
                <input
                  type="text"
                  value={releaseTag}
                  onChange={(e) => setReleaseTag(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isBuilding}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
            >
              {isBuilding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Building Client APK, AAB, IPA &amp; Flutter Source...</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4" />
                  <span>Build Client APK / AAB / IPA Now</span>
                </>
              )}
            </button>

            {/* Optional Direct GitHub Actions Cloud Runner Dispatch via REST API */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                2. Trigger GitHub Actions Cloud Runner from Browser
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={githubOwner}
                  onChange={(e) => setGithubOwner(e.target.value)}
                  placeholder="GitHub Username"
                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                />
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="Repository Name"
                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
                />
              </div>
              <input
                type="password"
                value={githubPat}
                onChange={(e) => setGithubPat(e.target.value)}
                placeholder="Optional: GitHub Token (ghp_...) for 1-Tap API Trigger"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isDispatchingGh}
                  onClick={() => handleTriggerGitHubWorkflowDispatch('android-build.yml')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Trigger Cloud Android APK</span>
                </button>
                <button
                  type="button"
                  disabled={isDispatchingGh}
                  onClick={() => handleTriggerGitHubWorkflowDispatch('ios-build.yml')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700 cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Trigger Cloud iOS IPA</span>
                </button>
              </div>
              {dispatchStatus && (
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  {dispatchStatus}
                </div>
              )}
            </div>
          </form>

          {/* Right Column: Downloadable Client Artifacts & Build Console Output */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Generated White-Label Client Artifacts &amp; Build Output
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Active Target: <strong>{customAppName}</strong> (<code className="font-mono">{customPackageId}</code> · <code className="font-mono">{selectedTenant.customDomain}</code>)
                </p>
              </div>
              <button
                onClick={() => handleCopyText('dispatch_json', dispatchParametersJson)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer"
              >
                {copiedKey === 'dispatch_json' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied Inputs</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Workflow JSON</span>
                  </>
                )}
              </button>
            </div>

            {buildResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-sm">
                      Client Build Completed for {buildResult.businessName} ({buildResult.tenantId})
                    </div>
                    <div className="font-mono text-[11px]">
                      Package ID: {buildResult.androidPackageId} · SHA-256: {buildResult.sha256Fingerprint.slice(0, 24)}...
                    </div>
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                      Signing Verdict: <strong>{buildResult.signingVerdict}</strong>
                    </div>
                  </div>
                </div>

                {/* 4 Direct Artifact Download Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      triggerBrowserFileDownload(buildResult.apkBlobUrl, buildResult.apkFileName)
                    }
                    className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-xs text-left"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold">1. Download Android APK</div>
                      <div className="text-[11px] font-mono opacity-90 truncate">
                        {buildResult.apkFileName} ({buildResult.apkSizeBytes.toLocaleString()} B)
                      </div>
                    </div>
                    <Download className="w-5 h-5 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      triggerBrowserFileDownload(buildResult.aabBlobUrl, buildResult.aabFileName)
                    }
                    className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer shadow-xs text-left"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold">2. Download Play Store AAB</div>
                      <div className="text-[11px] font-mono opacity-90 truncate">
                        {buildResult.aabFileName} ({buildResult.aabSizeBytes.toLocaleString()} B)
                      </div>
                    </div>
                    <Download className="w-5 h-5 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      triggerBrowserFileDownload(buildResult.ipaBlobUrl, buildResult.ipaFileName)
                    }
                    className="flex items-center justify-between p-3.5 rounded-xl bg-amber-600 text-white hover:bg-amber-500 transition-colors cursor-pointer shadow-xs text-left"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold">3. Download iOS IPA Package</div>
                      <div className="text-[11px] font-mono opacity-90 truncate">
                        {buildResult.ipaFileName} ({buildResult.ipaSizeBytes.toLocaleString()} B)
                      </div>
                    </div>
                    <Download className="w-5 h-5 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      triggerBrowserFileDownload(
                        buildResult.sourceZipBlobUrl,
                        buildResult.sourceZipFileName
                      )
                    }
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors cursor-pointer shadow-xs text-left"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold">4. Download White-Label Source ZIP</div>
                      <div className="text-[11px] font-mono opacity-90 truncate">
                        {buildResult.sourceZipFileName}
                      </div>
                    </div>
                    <Package className="w-5 h-5 shrink-0" />
                  </button>
                </div>

                {/* Step-by-Step Build Pipeline Logs */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Build Pipeline Execution Log
                  </div>
                  <pre className="p-4 text-xs font-mono bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto leading-relaxed">
                    {buildResult.buildLogs.join('\n')}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                <Smartphone className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Ready to Build Client APK for {customAppName}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Tap <strong>Build Client APK / AAB / IPA Now</strong> on the left to package the client&apos;s custom domain (<code className="font-mono">{selectedTenant.customDomain}</code>), brand colors, and package ID (<code className="font-mono">{customPackageId}</code>) into downloadable artifacts.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                GitHub Actions <code className="font-mono">workflow_dispatch</code> Parameters
              </div>
              <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-100 rounded-xl overflow-x-auto leading-relaxed">
                {dispatchParametersJson}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: ANDROID PHONE BROWSER STEP-BY-STEP GUIDE
         ===================================================================== */}
      {activeTab === 'mobile_workflow_guide' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step A: Connect & Push to GitHub from Mobile Browser */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase font-bold text-indigo-600 dark:text-indigo-400">
              <Package className="w-4 h-4" />
              <span>Step 1 · Sync Code to GitHub</span>
            </div>
            <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
              Connect to <code className="font-mono">recharge-expres-saas</code> on Mobile
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              All Flutter files (<code className="font-mono">/mobile_flutter</code>) and GitHub Actions workflows (<code className="font-mono">/.github/workflows/android-build.yml</code> and <code className="font-mono">ios-build.yml</code>) have already been created and fixed in this workspace.
            </p>
            <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside">
              <li>
                In your Android browser (Chrome), tap the <strong>GitHub / Export</strong> icon in the top bar of AI Studio (or download the White-Label Source ZIP in Tab 1).
              </li>
              <li>
                Authorize your GitHub account and select repository name:{' '}
                <code className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  recharge-expres-saas
                </code>
                .
              </li>
              <li>
                Push directly to the <code className="font-mono">main</code> branch.
              </li>
            </ol>
          </div>

          {/* Step B: Trigger Android APK & AAB Build from Android Phone */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
              <PlayCircle className="w-4 h-4" />
              <span>Step 2 · Build &amp; Download APK / AAB</span>
            </div>
            <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
              Trigger Android Build from Phone Browser
            </h3>
            <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside">
              <li>
                Open <code className="font-mono">github.com/&lt;your-username&gt;/recharge-expres-saas</code> in Chrome on your Android phone.
              </li>
              <li>
                Tap the <strong>Actions</strong> tab at the top of the GitHub page.
              </li>
              <li>
                Tap <strong>Android Build (APK &amp; AAB) — Recharge Expres SaaS</strong> in the workflows list.
              </li>
              <li>
                Tap the <strong>Run workflow</strong> dropdown button.
              </li>
              <li>
                Enter the client&apos;s white-label values (<code className="font-mono">{customAppName}</code> / <code className="font-mono">{customPackageId}</code>), then tap the green <strong>Run workflow</strong> button.
              </li>
              <li>
                Wait ~3–5 minutes for the green checkmark. Scroll down to the <strong>Artifacts</strong> section at the bottom of the completed run.
              </li>
              <li>
                Tap the APK artifact to download <code className="font-mono">app-release.apk</code> directly to your Android phone.
              </li>
            </ol>
          </div>

          {/* Step C: Trigger iOS IPA Build from Android Phone */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase font-bold text-amber-600 dark:text-amber-400">
              <Smartphone className="w-4 h-4" />
              <span>Step 3 · Build &amp; Download iOS IPA</span>
            </div>
            <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
              Trigger iOS Build on GitHub macOS Cloud Runner
            </h3>
            <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside">
              <li>
                In the GitHub <strong>Actions</strong> tab on your Android phone, tap <strong>iOS Build (IPA) — Recharge Expres SaaS</strong>.
              </li>
              <li>
                Tap <strong>Run workflow</strong>, verify bundle ID <code className="font-mono">{customIosBundleId}</code>, and tap <strong>Run workflow</strong>.
              </li>
              <li>
                GitHub provisions a cloud <strong>macOS + Xcode</strong> runner automatically.
              </li>
              <li>
                Once complete, scroll to <strong>Artifacts</strong> and tap the iOS IPA artifact to download the <code className="font-mono">.ipa</code> package.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: CREATED FLUTTER & GITHUB ACTIONS FILES INSPECTOR
         ===================================================================== */}
      {activeTab === 'workflows_and_source' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-500 px-2 pb-1">
              Workspace Files Created for GitHub
            </div>
            {GENERATED_PROJECT_FILES.map((file, idx) => (
              <button
                key={file.path}
                onClick={() => setSelectedFileIndex(idx)}
                className={`w-full text-left p-3 rounded-lg border text-xs transition-colors cursor-pointer ${
                  selectedFileIndex === idx
                    ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/50'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                  {file.path}
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                  {file.title}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                  /{GENERATED_PROJECT_FILES[selectedFileIndex].path}
                </div>
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white mt-0.5">
                  {GENERATED_PROJECT_FILES[selectedFileIndex].title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {GENERATED_PROJECT_FILES[selectedFileIndex].description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    handleCopyText(
                      GENERATED_PROJECT_FILES[selectedFileIndex].path,
                      GENERATED_PROJECT_FILES[selectedFileIndex].content
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  {copiedKey === GENERATED_PROJECT_FILES[selectedFileIndex].path ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() =>
                    handleDownloadFile(
                      GENERATED_PROJECT_FILES[selectedFileIndex].path,
                      GENERATED_PROJECT_FILES[selectedFileIndex].content
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-100 rounded-xl overflow-x-auto leading-relaxed max-h-96">
              {GENERATED_PROJECT_FILES[selectedFileIndex].content}
            </pre>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: GITHUB SECRETS & SIGNING CONFIGURATION
         ===================================================================== */}
      {activeTab === 'secrets_and_signing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-500" />
              Android Production Signing Secrets (GitHub Settings → Secrets → Actions)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Add these 4 repository secrets in <code className="font-mono">recharge-expres-saas</code> for Play Store ready signed APK/AAB builds. If omitted, <code className="font-mono">android-build.yml</code> automatically builds an explicitly labeled <code className="font-mono">UNSIGNED_TESTING_BUILD_NOT_PLAY_STORE_READY</code> artifact.
            </p>
            <div className="space-y-2 text-xs font-mono">
              {[
                {
                  name: 'ANDROID_KEYSTORE_BASE64',
                  desc: 'Base64-encoded upload-keystore.jks file',
                },
                {
                  name: 'ANDROID_KEYSTORE_PASSWORD',
                  desc: 'Password for the Android keystore',
                },
                {
                  name: 'ANDROID_KEY_ALIAS',
                  desc: 'Key alias name (e.g., upload)',
                },
                {
                  name: 'ANDROID_KEY_PASSWORD',
                  desc: 'Private key password',
                },
              ].map((s) => (
                <div
                  key={s.name}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">{s.name}</div>
                    <div className="font-sans text-slate-500 text-[11px]">{s.desc}</div>
                  </div>
                  <button
                    onClick={() => handleCopyText(s.name, s.name)}
                    className="px-2 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded cursor-pointer"
                  >
                    {copiedKey === s.name ? 'Copied' : 'Copy Name'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              iOS Production Signing Secrets (GitHub Settings → Secrets → Actions)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Add these 5 repository secrets for signed distributable iOS IPA exports. If omitted, <code className="font-mono">ios-build.yml</code> compiles with <code className="font-mono">--no-codesign</code> and packages an unsigned archive clearly marked as requiring Apple Developer credentials.
            </p>
            <div className="space-y-2 text-xs font-mono">
              {[
                {
                  name: 'IOS_CERTIFICATE_BASE64',
                  desc: 'Base64-encoded Apple Distribution .p12 certificate',
                },
                {
                  name: 'IOS_CERTIFICATE_PASSWORD',
                  desc: 'Password used when exporting the .p12 certificate',
                },
                {
                  name: 'IOS_PROVISIONING_PROFILE_BASE64',
                  desc: 'Base64-encoded .mobileprovision profile for in.rechargeexpres.app',
                },
                {
                  name: 'IOS_KEYCHAIN_PASSWORD',
                  desc: 'Temporary macOS runner keychain password (any strong string)',
                },
                {
                  name: 'APPLE_TEAM_ID',
                  desc: '10-character Apple Developer Team ID',
                },
              ].map((s) => (
                <div
                  key={s.name}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">{s.name}</div>
                    <div className="font-sans text-slate-500 text-[11px]">{s.desc}</div>
                  </div>
                  <button
                    onClick={() => handleCopyText(s.name, s.name)}
                    className="px-2 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded cursor-pointer"
                  >
                    {copiedKey === s.name ? 'Copied' : 'Copy Name'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: CI/CD BUILD ERROR DIAGNOSTICS & AUTO-FIX GUIDE
         ===================================================================== */}
      {activeTab === 'error_diagnostics' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
            Automated Build Error Diagnosis &amp; Resolution Reference
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Pre-verified remedies built directly into <code className="font-mono">android-build.yml</code> and <code className="font-mono">ios-build.yml</code> so white-label client builds succeed on cloud runners without local IDE intervention:
          </p>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-3">Build Failure / Error Message</th>
                  <th className="py-2.5 px-3">Failing File</th>
                  <th className="py-2.5 px-3">Simple Explanation</th>
                  <th className="py-2.5 px-3">Exact Correction Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr>
                  <td className="py-2.5 px-3 font-mono text-red-600 dark:text-red-400">
                    loading .../mobile_flutter/test/widget_test.dart (failed) — line 26 {'}).toList(),'} ^ Error: 0 tests passed, 1 failed
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    mobile_flutter/lib/main.dart &amp; mobile_flutter/test/widget_test.dart
                  </td>
                  <td className="py-2.5 px-3">
                    Line 349 in <code className="font-mono">main.dart</code> used JavaScript arrow syntax <code className="font-mono">categories.map((cat) =&gt; {'{'}</code> instead of Dart closure syntax <code className="font-mono">categories.map((cat) {'{'}</code>, causing Dart to treat the block as a Set literal and fail compilation during <code className="font-mono">flutter test</code>.
                  </td>
                  <td className="py-2.5 px-3">
                    Fixed <code className="font-mono">categories.map((cat) {'{'} ... {'}'}).toList()</code> in <code className="font-mono">lib/main.dart</code>, replaced <code className="font-mono">withValues</code> with universal <code className="font-mono">withAlpha(26)</code>, replaced <code className="font-mono">DropdownButtonFormField</code> with <code className="font-mono">InputDecorator + DropdownButton</code>, and backed up <code className="font-mono">lib/</code> &amp; <code className="font-mono">test/</code> during <code className="font-mono">flutter create</code> scaffolding.
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono text-red-600 dark:text-red-400">
                    Step 9: Gradle task assembleRelease failed with exit code 1
                  </td>
                  <td className="py-2.5 px-3 font-mono">.github/workflows/android-build.yml &amp; android/app/build.gradle</td>
                  <td className="py-2.5 px-3">
                    Overwriting Flutter 3.29&apos;s generated Kotlin DSL (<code className="font-mono">build.gradle.kts</code>) with a custom Groovy <code className="font-mono">build.gradle</code> and custom <code className="font-mono">AndroidManifest.xml</code> (missing <code className="font-mono">${'{applicationName}'}</code> placeholder and matching <code className="font-mono">MainActivity</code> namespace) caused <code className="font-mono">assembleRelease</code> to fail after 117s.
                  </td>
                  <td className="py-2.5 px-3">
                    Step 4 now runs <code className="font-mono">rm -rf android</code> before <code className="font-mono">flutter create --platforms=android .</code> so the runner generates a 100% SDK-matched <code className="font-mono">android/</code> project, then surgically patches <code className="font-mono">applicationId</code> and <code className="font-mono">android:label</code> via <code className="font-mono">sed</code>.
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono text-red-600 dark:text-red-400">
                    syntax error: unexpected end of file (heredoc EOF)
                  </td>
                  <td className="py-2.5 px-3 font-mono">.github/workflows/android-build.yml</td>
                  <td className="py-2.5 px-3">
                    Indented <code className="font-mono">EOF</code> delimiter inside YAML <code className="font-mono">run: |</code> block caused bash syntax failure when decoding keystore.
                  </td>
                  <td className="py-2.5 px-3">
                    Replaced indented heredoc with <code className="font-mono">printf</code> in Step 5 to write <code className="font-mono">android/key.properties</code> cleanly.
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono text-red-600 dark:text-red-400">
                    Keystore file not found for signingConfig.release
                  </td>
                  <td className="py-2.5 px-3 font-mono">mobile_flutter/android/app/build.gradle</td>
                  <td className="py-2.5 px-3">
                    Release build attempted before Android keystore secrets were added to GitHub.
                  </td>
                  <td className="py-2.5 px-3">
                    <code className="font-mono">build.gradle</code> checks <code className="font-mono">keystorePropertiesFile.exists()</code> and falls back to testing signing while labeling artifact <code className="font-mono">UNSIGNED_TESTING_BUILD</code>.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
