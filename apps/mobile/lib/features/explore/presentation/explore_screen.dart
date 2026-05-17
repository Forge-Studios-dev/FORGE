import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../core/motion/forge_motion.dart';
import '../../../shared/models/video.dart';
import '../../../core/network/api_client.dart';
import '../data/search_repository.dart';

final exploreCategoriesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final client = ref.read(apiClientProvider);
  final res = await client.dio.get('/categories');
  final list = res.data['data'] as List<dynamic>? ?? [];
  return list.map((e) => e as Map<String, dynamic>).toList();
});

const _disciplines = [
  ('physical-crafts', 'Physical Crafts', Icons.handyman),
  ('art-design', 'Art & Design', Icons.palette),
  ('building-tech', 'Building & Tech', Icons.construction),
  ('fitness', 'Fitness', Icons.fitness_center),
  ('learning-journeys', 'Learning', Icons.school),
  ('music', 'Music', Icons.music_note),
];

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _lastQuery = '';
  Future<SearchResults>? _searchFuture;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _scheduleSearch(String raw) {
    _debounce?.cancel();
    final q = raw.trim();
    _lastQuery = q;
    if (q.length < 2) {
      setState(() => _searchFuture = null);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (!mounted || _lastQuery != q) return;
      setState(() {
        _searchFuture = ref.read(searchRepositoryProvider).search(q);
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Explore')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _controller,
              style: const TextStyle(color: ForgeTokens.onSurface),
              decoration: InputDecoration(
                hintText: 'Search videos and creators',
                hintStyle: const TextStyle(color: ForgeTokens.outline),
                prefixIcon: const Icon(Icons.search, color: ForgeTokens.outline),
                suffixIcon: _controller.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear, color: ForgeTokens.outline),
                        onPressed: () {
                          _controller.clear();
                          _scheduleSearch('');
                        },
                      ),
                filled: true,
                fillColor: ForgeTokens.surfaceContainerLow,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: ForgeTokens.outlineVariant.withValues(alpha: 0.4)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: ForgeTokens.outlineVariant.withValues(alpha: 0.4)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: ForgeTokens.primary),
                ),
              ),
              textInputAction: TextInputAction.search,
              onChanged: (v) {
                setState(() {});
                _scheduleSearch(v);
              },
            ),
          ),
          Expanded(child: _buildResultsArea()),
        ],
      ),
    );
  }

  Widget _buildResultsArea() {
    final q = _controller.text.trim();
    if (q.isEmpty) {
      final categoriesAsync = ref.watch(exploreCategoriesProvider);
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          categoriesAsync.when(
            data: (cats) {
              if (cats.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Categories',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                      letterSpacing: 0.08,
                      color: ForgeTokens.outline,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: cats.map((c) {
                      final name = c['name'] as String? ?? '';
                      return ActionChip(
                        label: Text(name),
                        onPressed: () {
                          _controller.text = name;
                          setState(() {});
                          _scheduleSearch(name);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                ],
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          const Text(
            'Core disciplines',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 12,
              letterSpacing: 0.08,
              color: ForgeTokens.outline,
            ),
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.35,
            ),
            itemCount: _disciplines.length,
            itemBuilder: (context, index) {
              final d = _disciplines[index];
              return ForgeMotion.fadeIn(
                index: index,
                child: ForgeCard(
                  padding: const EdgeInsets.all(14),
                  onTap: () {
                    _controller.text = d.$2;
                    setState(() {});
                    _scheduleSearch(d.$2);
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(d.$3, color: ForgeTokens.primary, size: 28),
                      const SizedBox(height: 10),
                      Text(
                        d.$2,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: ForgeTokens.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 20),
          const Text(
            'Or search above for videos and creators.',
            textAlign: TextAlign.center,
            style: TextStyle(color: ForgeTokens.onSurfaceVariant, fontSize: 13),
          ),
        ],
      );
    }
    if (q.length < 2) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Enter at least 2 characters to search.', style: TextStyle(color: ForgeTokens.onSurfaceVariant)),
        ),
      );
    }

    final future = _searchFuture;
    if (future == null) {
      return const Center(child: CircularProgressIndicator(color: ForgeTokens.primary));
    }

    return FutureBuilder<SearchResults>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: ForgeTokens.primary));
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: ForgeTokens.error),
                  const SizedBox(height: 12),
                  const Text('Search failed', style: TextStyle(fontWeight: FontWeight.w600, color: ForgeTokens.onSurface)),
                  const SizedBox(height: 8),
                  TextButton(onPressed: () => _scheduleSearch(q), child: const Text('Retry')),
                ],
              ),
            ),
          );
        }
        final data = snapshot.data;
        if (data == null) return const SizedBox.shrink();
        if (data.videos.isEmpty && data.users.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.search_off, size: 48, color: ForgeTokens.outline),
                  const SizedBox(height: 12),
                  Text('No results for "${data.query}"', style: const TextStyle(color: ForgeTokens.onSurfaceVariant)),
                ],
              ),
            ),
          );
        }
        return ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            if (data.videos.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Text('Videos', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ForgeTokens.onSurface)),
              ),
              ...data.videos.map((v) => _VideoSearchTile(video: v)),
            ],
            if (data.users.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text('Creators', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ForgeTokens.onSurface)),
              ),
              ...data.users.map((u) => _UserSearchTile(user: u)),
            ],
          ],
        );
      },
    );
  }
}

class _VideoSearchTile extends StatelessWidget {
  final VideoModel video;
  const _VideoSearchTile({required this.video});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 96,
          height: 54,
          child: video.thumbnailUrl != null
              ? CachedNetworkImage(
                  imageUrl: video.thumbnailUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(color: ForgeTokens.surfaceContainerHigh),
                  errorWidget: (_, __, ___) => Container(color: ForgeTokens.surfaceContainerHigh),
                )
              : Container(color: ForgeTokens.surfaceContainerHigh),
        ),
      ),
      title: Text(video.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: ForgeTokens.onSurface)),
      subtitle: Text('@${video.user.username}', style: const TextStyle(color: ForgeTokens.onSurfaceVariant)),
      onTap: () => context.push('/watch/${video.id}'),
    );
  }
}

class _UserSearchTile extends StatelessWidget {
  final UserModel user;
  const _UserSearchTile({required this.user});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: ForgeTokens.primaryContainer,
        backgroundImage: user.avatarUrl != null ? CachedNetworkImageProvider(user.avatarUrl!) : null,
        child: user.avatarUrl == null
            ? Text(
                user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : '?',
                style: const TextStyle(color: ForgeTokens.onPrimary, fontWeight: FontWeight.bold),
              )
            : null,
      ),
      title: Text(user.displayName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: ForgeTokens.onSurface)),
      subtitle: Text('@${user.username}', style: const TextStyle(color: ForgeTokens.onSurfaceVariant)),
      onTap: () => context.push('/profile/${user.username}'),
    );
  }
}
