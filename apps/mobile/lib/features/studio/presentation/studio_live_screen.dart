import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

class StudioLiveScreen extends ConsumerStatefulWidget {
  const StudioLiveScreen({super.key});

  @override
  ConsumerState<StudioLiveScreen> createState() => _StudioLiveScreenState();
}

class _StudioLiveScreenState extends ConsumerState<StudioLiveScreen> {
  final _titleCtrl = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (_titleCtrl.text.trim().length < 3) return;
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/streams/start', data: {'title': _titleCtrl.text.trim()});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Stream created. Open Live tab for RTMP details.')),
        );
        context.go('/live');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not start stream')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Go live'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Teach in real time. After starting, use the Live tab for your RTMP URL and stream key in OBS.',
            style: TextStyle(color: ForgeTokens.onSurfaceVariant, height: 1.5),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Session title',
              hintText: 'e.g. Live wheel throwing basics',
            ),
          ),
          const SizedBox(height: 16),
          ForgeButton(
            label: _loading ? 'Starting…' : 'Go live',
            onPressed: _loading ? null : _start,
          ),
          const SizedBox(height: 24),
          ForgeCard(
            onTap: () => context.go('/live'),
            child: const Row(
              children: [
                Icon(Icons.live_tv, color: ForgeTokens.primary),
                SizedBox(width: 12),
                Expanded(child: Text('Browse live sessions')),
                Icon(Icons.chevron_right, color: ForgeTokens.outline),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
