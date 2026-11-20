import 'package:flutter_test/flutter_test.dart';
import 'package:recharge_expres_mobile/main.dart';
import 'package:recharge_expres_mobile/config/env_config.dart';

void main() {
  testWidgets('Recharge Expres white-label app boots and renders recharge console',
      (WidgetTester tester) async {
    await tester.pumpWidget(const RechargeExpresMobileApp());
    await tester.pumpAndSettle();

    // Verify white-label branding and package identifier loaded
    expect(TenantBuildConfig.appName.isNotEmpty, isTrue);
    expect(TenantBuildConfig.packageId.isNotEmpty, isTrue);
    expect(find.textContaining(TenantBuildConfig.appName), findsWidgets);
    expect(find.text('Confirm & Initiate Recharge'), findsOneWidget);
  });
}
