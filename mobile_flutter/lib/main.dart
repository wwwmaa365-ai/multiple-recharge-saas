import 'package:flutter/material.dart';
import 'config/env_config.dart';

void main() {
  runApp(const RechargeExpresMobileApp());
}

class RechargeTransactionItem {
  final String txId;
  final String category;
  final String subscriberNumber;
  final String operatorName;
  final double amountInr;
  String status; // Initiated -> Processing -> Pending -> Successful / Failed / Refunded
  final String timestamp;

  RechargeTransactionItem({
    required this.txId,
    required this.category,
    required this.subscriberNumber,
    required this.operatorName,
    required this.amountInr,
    required this.status,
    required this.timestamp,
  });
}

class RechargeExpresMobileApp extends StatelessWidget {
  const RechargeExpresMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    final brandColor = TenantBuildConfig.primaryBrandColor;
    return MaterialApp(
      title: TenantBuildConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: brandColor),
        useMaterial3: true,
      ),
      home: const MobileRootShell(),
    );
  }
}

class MobileRootShell extends StatefulWidget {
  const MobileRootShell({super.key});

  @override
  State<MobileRootShell> createState() => _MobileRootShellState();
}

class _MobileRootShellState extends State<MobileRootShell> {
  bool _isAuthenticated = true;
  String _customerPhone = '9830012345';
  final String _customerName = 'Sanjit Customer';
  int _selectedTabIndex = 0;

  double _walletBalanceInr = 2450.00;
  String _activeCategory = 'Mobile Prepaid';
  String _selectedOperator = 'JIO_PREPAID';
  final TextEditingController _numberController =
      TextEditingController(text: '9876543210');
  final TextEditingController _amountController =
      TextEditingController(text: '299');
  final TextEditingController _otpController =
      TextEditingController(text: '123456');

  String _statusMessage = '';

  final List<RechargeTransactionItem> _transactions = [
    RechargeTransactionItem(
      txId: 'TXN_RX_9012',
      category: 'Mobile Prepaid',
      subscriberNumber: '9876543210',
      operatorName: 'JIO_PREPAID',
      amountInr: 299.0,
      status: 'Successful',
      timestamp: 'Today, 10:45 AM',
    ),
    RechargeTransactionItem(
      txId: 'TXN_RX_9011',
      category: 'DTH Recharge',
      subscriberNumber: '1029384756',
      operatorName: 'TATAPLAY_DTH',
      amountInr: 450.0,
      status: 'Successful',
      timestamp: 'Yesterday, 06:15 PM',
    ),
  ];

  final List<String> _notifications = [
    'Welcome to ${TenantBuildConfig.appName} (${TenantBuildConfig.tenantDomain}).',
    'Wallet top-up via isolated tenant UPI gateway is active.',
    'BBPS Utility Bill Payment categories enabled for your account.',
  ];

  void _handleAddWalletMoney(double amount) {
    setState(() {
      _walletBalanceInr += amount;
      _statusMessage =
          'Added ₹${amount.toStringAsFixed(0)} via Tenant Isolated Payment Gateway.';
      _notifications.insert(
        0,
        'Wallet Credited: ₹${amount.toStringAsFixed(2)} added to your ${TenantBuildConfig.appName} wallet.',
      );
    });
  }

  void _handleExecuteRecharge() {
    final subscriber = _numberController.text.trim();
    final amount = double.tryParse(_amountController.text.trim()) ?? 0;

    if (subscriber.length < 6 || amount <= 0) {
      setState(() {
        _statusMessage = 'Please enter a valid subscriber number and amount.';
      });
      return;
    }

    if (_walletBalanceInr < amount) {
      setState(() {
        _statusMessage =
            'Insufficient wallet balance. Please add money to your wallet first.';
      });
      return;
    }

    // Duplicate lock check
    final hasDuplicatePending = _transactions.any(
      (t) =>
          t.subscriberNumber == subscriber &&
          t.amountInr == amount &&
          t.status == 'Pending',
    );
    if (hasDuplicatePending) {
      setState(() {
        _statusMessage =
            'Duplicate Recharge Guard: Identical request is already Pending verification.';
      });
      return;
    }

    final txId = 'TXN_RX_${DateTime.now().millisecondsSinceEpoch % 100000}';
    setState(() {
      _walletBalanceInr -= amount;
      _transactions.insert(
        0,
        RechargeTransactionItem(
          txId: txId,
          category: _activeCategory,
          subscriberNumber: subscriber,
          operatorName: _selectedOperator,
          amountInr: amount,
          status: 'Pending',
          timestamp: 'Just now',
        ),
      );
      _statusMessage =
          'Order $txId submitted to ${TenantBuildConfig.tenantDomain} adapter (Status: Pending Webhook Verification).';
    });
  }

  void _handleVerifyWebhook(RechargeTransactionItem item, bool success) {
    setState(() {
      if (success) {
        item.status = 'Successful';
        _statusMessage = 'Webhook verified: ${item.txId} marked Successful.';
      } else {
        item.status = 'Refunded';
        _walletBalanceInr += item.amountInr;
        _statusMessage =
            'Operator reported failure for ${item.txId}. Auto-refunded ₹${item.amountInr.toStringAsFixed(0)} to wallet.';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final brandColor = TenantBuildConfig.primaryBrandColor;

    if (!_isAuthenticated) {
      return Scaffold(
        appBar: AppBar(
          backgroundColor: brandColor,
          foregroundColor: Colors.white,
          title: Text('${TenantBuildConfig.appName} — OTP Login'),
        ),
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Sign in to ${TenantBuildConfig.appName}',
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Tenant Domain: ${TenantBuildConfig.tenantDomain} (${TenantBuildConfig.packageId})',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              TextField(
                decoration: const InputDecoration(
                  labelText: 'Mobile Number',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.phone,
                onChanged: (v) => _customerPhone = v,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _otpController,
                decoration: const InputDecoration(
                  labelText: '6-Digit Mobile OTP',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: brandColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: () {
                  setState(() {
                    _isAuthenticated = true;
                  });
                },
                child: const Text('Verify OTP & Continue'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: brandColor,
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              TenantBuildConfig.appName,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              '${TenantBuildConfig.tenantDomain} · ${TenantBuildConfig.packageId}',
              style: const TextStyle(fontSize: 11),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Center(
              child: Text(
                '₹${_walletBalanceInr.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
      body: IndexedStack(
        index: _selectedTabIndex,
        children: [
          _buildHomeAndRechargeTab(brandColor),
          _buildWalletTab(brandColor),
          _buildHistoryTab(brandColor),
          _buildProfileAndSupportTab(brandColor),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedTabIndex,
        selectedItemColor: brandColor,
        unselectedItemColor: Colors.grey,
        type: BottomNavigationBarType.fixed,
        onTap: (idx) => setState(() => _selectedTabIndex = idx),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.bolt),
            label: 'Recharge & Bills',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.account_balance_wallet),
            label: 'Wallet',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long),
            label: 'History',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Account',
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _numberController.dispose();
    _amountController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Widget _buildHomeAndRechargeTab(Color brandColor) {
    final categories = [
      'Mobile Prepaid',
      'Mobile Postpaid',
      'DTH Recharge',
      'Electricity',
      'Gas',
      'Water Bill',
      'Broadband',
      'Landline',
      'Insurance',
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_statusMessage.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: brandColor.withAlpha(26),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: brandColor),
            ),
            child: Text(
              _statusMessage,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        const Text(
          'Select Recharge or BBPS Bill Service',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: categories.map((cat) {
            final selected = _activeCategory == cat;
            return ChoiceChip(
              label: Text(cat, style: const TextStyle(fontSize: 12)),
              selected: selected,
              onSelected: (_) => setState(() => _activeCategory = cat),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade300),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '$_activeCategory — ${TenantBuildConfig.appName}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _numberController,
                  decoration: const InputDecoration(
                    labelText: 'Mobile / Subscriber / Consumer Number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Select Telecom / BBPS Operator',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedOperator,
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(
                          value: 'JIO_PREPAID',
                          child: Text('Reliance Jio'),
                        ),
                        DropdownMenuItem(
                          value: 'AIRTEL_PREPAID',
                          child: Text('Airtel'),
                        ),
                        DropdownMenuItem(
                          value: 'VI_PREPAID',
                          child: Text('Vi (Vodafone Idea)'),
                        ),
                        DropdownMenuItem(
                          value: 'BSNL_TOPUP',
                          child: Text('BSNL'),
                        ),
                        DropdownMenuItem(
                          value: 'TATAPLAY_DTH',
                          child: Text('Tata Play DTH'),
                        ),
                        DropdownMenuItem(
                          value: 'WBSEDCL_EBILL',
                          child: Text('WBSEDCL Electricity (BBPS)'),
                        ),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedOperator = val);
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _amountController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Recharge / Bill Amount (INR)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: [199, 299, 349, 599, 999].map((planAmount) {
                    return ActionChip(
                      label: Text('₹$planAmount Plan'),
                      onPressed: () {
                        setState(() {
                          _amountController.text = planAmount.toString();
                        });
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: brandColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: _handleExecuteRecharge,
                  child: const Text('Confirm & Initiate Recharge'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildWalletTab(Color brandColor) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          elevation: 0,
          color: brandColor,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Isolated Tenant Customer Wallet Balance',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const SizedBox(height: 6),
                Text(
                  '₹${_walletBalanceInr.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Tenant ID: ${TenantBuildConfig.tenantId}',
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Instant Wallet Top-Up (Client Payment Gateway)',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [500.0, 1000.0, 2000.0, 5000.0].map((amt) {
            return ElevatedButton(
              onPressed: () => _handleAddWalletMoney(amt),
              child: Text('+ Add ₹${amt.toStringAsFixed(0)}'),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildHistoryTab(Color brandColor) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _transactions.length,
      itemBuilder: (context, idx) {
        final item = _transactions[idx];
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: ListTile(
            title: Text(
              '${item.operatorName} · ${item.subscriberNumber}',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${item.txId} · ${item.category} · ${item.timestamp}'),
                Text(
                  'Status: ${item.status}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: item.status == 'Successful'
                        ? Colors.green
                        : item.status == 'Pending'
                            ? Colors.orange
                            : Colors.red,
                  ),
                ),
                if (item.status == 'Pending')
                  Row(
                    children: [
                      TextButton(
                        onPressed: () => _handleVerifyWebhook(item, true),
                        child: const Text('Webhook: Success'),
                      ),
                      TextButton(
                        onPressed: () => _handleVerifyWebhook(item, false),
                        child: const Text('Webhook: Fail & Refund'),
                      ),
                    ],
                  ),
              ],
            ),
            trailing: Text(
              '₹${item.amountInr.toStringAsFixed(0)}',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
          ),
        );
      },
    );
  }

  Widget _buildProfileAndSupportTab(Color brandColor) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ListTile(
          leading: CircleAvatar(
            backgroundColor: brandColor,
            foregroundColor: Colors.white,
            child: const Icon(Icons.person),
          ),
          title: Text(_customerName),
          subtitle: Text('+91 $_customerPhone · ${TenantBuildConfig.tenantDomain}'),
          trailing: TextButton(
            onPressed: () => setState(() => _isAuthenticated = false),
            child: const Text('Logout'),
          ),
        ),
        const Divider(),
        const Text(
          'Notifications & Alerts',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        ..._notifications.map(
          (n) => Card(
            child: ListTile(
              leading: const Icon(Icons.notifications_active_outlined),
              title: Text(n, style: const TextStyle(fontSize: 12)),
            ),
          ),
        ),
      ],
    );
  }
}
