import 'package:flutter_test/flutter_test.dart';
import 'package:recharge_expres_mobile/main.dart';
import 'package:recharge_expres_mobile/config/env_config.dart';

void main() {
  testWidgets('Recharge Expres white-label app boots and renders recharge console',
      (WidgetTester tester) async {
    await tester.pumpWidget(const RechargeExpresMobileApp());

    // Verify default branding and package identifier
    expect(TenantBuildConfig.appName, 'Recharge Expres');
    expect(TenantBuildConfig.packageId, 'in.rechargeexpres.app');
    expect(find.textContaining('Recharge Expres'), findsWidgets);
    expect(find.text('Confirm & Initiate Recharge'), findsOneWidget);
  });
}
