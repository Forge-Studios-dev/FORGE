import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_envelope.dart';
import '../../../core/platform/platform_config.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

class ProgramViewerScreen extends ConsumerStatefulWidget {
  const ProgramViewerScreen({
    super.key,
    required this.username,
    required this.slug,
  });

  final String username;
  final String slug;

  @override
  ConsumerState<ProgramViewerScreen> createState() => _ProgramViewerScreenState();
}

class _ProgramViewerScreenState extends ConsumerState<ProgramViewerScreen> with WidgetsBindingObserver {
  Map<String, dynamic>? _program;
  bool _loading = true;
  bool _enrolled = false;
  bool _checkoutBusy = false;
  bool _awaitingPurchase = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _awaitingPurchase) {
      _awaitingPurchase = false;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final profileRes = await client.dio.get('/users/by-username/${widget.username}');
      final creatorId = profileRes.data['data']['id'] as String;
      final res = await client.dio.get(
        '/creators/$creatorId/programs/${widget.slug}',
      );
      setState(() {
        _program = readApiMap(res.data);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _enroll() async {
    final id = _program?['id'] as String?;
    if (id == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/programs/$id/enroll');
      setState(() => _enrolled = true);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enrollment failed — check membership')),
        );
      }
    }
  }

  Future<void> _checkout() async {
    final id = _program?['id'] as String?;
    if (id == null) return;
    setState(() => _checkoutBusy = true);
    try {
      final client = ref.read(apiClientProvider);
      final appBase = AppConstants.webBaseUrl.replaceAll(RegExp(r'/+$'), '');
      final path = '/${widget.username}/programs/${widget.slug}';
      final res = await client.dio.post('/programs/$id/checkout', data: {
        'successUrl': '$appBase$path?purchased=1',
        'cancelUrl': '$appBase$path',
      });
      final checkoutUrl = readApiMap(res.data)?['checkoutUrl'] as String?;
      if (checkoutUrl != null && checkoutUrl.isNotEmpty) {
        _awaitingPurchase = true;
        await launchUrl(Uri.parse(checkoutUrl), mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Checkout failed — billing or Connect may not be ready')),
        );
      }
    } finally {
      if (mounted) setState(() => _checkoutBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final platformConfig = ref.watch(platformConfigProvider).asData?.value ?? {};
    if (!platformSkillEconomyLmsEnabled(platformConfig)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/profile/${widget.username}');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final program = _program;
    final courses = (program?['courses'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return Scaffold(
      appBar: AppBar(title: Text(program?['name'] as String? ?? 'Program')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : program == null
              ? const Center(child: Text('Program not found'))
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    if ((program['description'] as String?)?.isNotEmpty == true)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          program['description'] as String,
                          style: const TextStyle(color: ForgeTokens.onSurfaceVariant),
                        ),
                      ),
                    if (program['isFree'] == true)
                      ForgeButton(
                        label: _enrolled ? 'Enrolled' : 'Enroll in program',
                        onPressed: _enrolled ? null : _enroll,
                      )
                    else if (program['hasPurchased'] == true)
                      const Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          'You own this program — open any course below.',
                          style: const TextStyle(color: ForgeTokens.onSurfaceVariant),
                        ),
                      )
                    else
                      ForgeButton(
                        label: _checkoutBusy
                            ? 'Opening checkout…'
                            : 'Buy program · \$${((program['priceCents'] as num? ?? 0) / 100).toStringAsFixed(2)}',
                        onPressed: _checkoutBusy ? null : _checkout,
                      ),
                    const SizedBox(height: 20),
                    const Text('Courses in this program', style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    ...courses.map((item) {
                      final course = item['course'] as Map<String, dynamic>?;
                      final courseId = course?['id'] as String?;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ForgeCard(
                          onTap: courseId != null ? () => context.push('/courses/$courseId') : null,
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  course?['title'] as String? ?? 'Course',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                              ),
                              if (courseId != null)
                                const Icon(Icons.chevron_right, color: ForgeTokens.outline),
                            ],
                          ),
                        ),
                      );
                    }),
                  ],
                ),
    );
  }
}
