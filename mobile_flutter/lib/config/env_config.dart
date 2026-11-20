import 'package:flutter/material.dart';

/// Multi-Tenant White-Label & Environment Configuration
/// Values are injected at compile-time via `--dart-define` in GitHub Actions
/// (`android-build.yml` and `ios-build.yml`). No client API keys or payment
/// secrets are ever stored in mobile client code.
class TenantBuildConfig {
  static const String appName = String.fromEnvironment(
    'APP_NAME',
    defaultValue: 'Recharge Expres',
  );

  static const String packageId = String.fromEnvironment(
    'PACKAGE_ID',
    defaultValue: 'in.rechargeexpres.app',
  );

  static const String tenantId = String.fromEnvironment(
    'TENANT_ID',
    defaultValue: 'tenant_master_platform',
  );

  static const String tenantDomain = String.fromEnvironment(
    'TENANT_DOMAIN',
    defaultValue: 'rechargeexpres.in',
  );

  static const String primaryColorHex = String.fromEnvironment(
    'PRIMARY_COLOR_HEX',
    defaultValue: '4F46E5',
  );

  static const String appEnv = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'production',
  );

  static bool get isProduction => appEnv == 'production';

  static String get apiBaseUrl => isProduction
      ? 'https://$tenantDomain/api/v1'
      : 'https://dev.$tenantDomain/api/v1';

  static Color get primaryBrandColor {
    final cleaned = primaryColorHex.replaceAll('#', '').trim();
    final parsed = int.tryParse('FF$cleaned', radix: 16);
    return Color(parsed ?? 0xFF4F46E5);
  }
}
