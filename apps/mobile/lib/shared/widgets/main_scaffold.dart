import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/access/creator_status_provider.dart';
import '../../core/access/forge_access.dart';
import '../../core/theme/forge_tokens.dart';

class MainScaffold extends ConsumerWidget {
  final Widget child;
  const MainScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final tierAsync = ref.watch(creatorTierProvider);
    final isCreator = tierAsync.maybeWhen(
      data: (tier) => ForgeAccess.isApprovedCreator(tier),
      orElse: () => false,
    );

    return Scaffold(
      backgroundColor: ForgeTokens.background,
      body: child,
      bottomNavigationBar: NavigationBar(
        backgroundColor: ForgeTokens.surfaceContainerLow,
        indicatorColor: ForgeTokens.primary.withValues(alpha: 0.15),
        selectedIndex: _selectedIndex(location, isCreator),
        onDestinationSelected: (index) => _onTap(context, index, isCreator),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          const NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Explore'),
          const NavigationDestination(icon: Icon(Icons.sensors), selectedIcon: Icon(Icons.sensors), label: 'Live'),
          isCreator
              ? const NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Studio')
              : const NavigationDestination(icon: Icon(Icons.video_library_outlined), selectedIcon: Icon(Icons.video_library), label: 'Library'),
          const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  int _selectedIndex(String location, bool isCreator) {
    if (location.startsWith('/feed') || location.startsWith('/watch')) return 0;
    if (location.startsWith('/explore')) return 1;
    if (location.startsWith('/live')) return 2;
    // Only the Studio *root* (`/studio`) lives in the shell — sub-screens
    // (`/studio/videos`, `/studio/analytics`, …) remain full-screen pushes
    // outside the shell, so this only ever matches the shell tab itself.
    if (location.startsWith('/studio')) return isCreator ? 3 : 4;
    if (!isCreator && (location.startsWith('/library') || location.startsWith('/history') || location.startsWith('/notifications'))) return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  void _onTap(BuildContext context, int index, bool isCreator) {
    switch (index) {
      case 0:
        context.go('/feed');
        break;
      case 1:
        context.go('/explore');
        break;
      case 2:
        context.go('/live');
        break;
      case 3:
        context.go(isCreator ? '/studio' : '/library');
        break;
      case 4:
        context.go('/profile/me');
        break;
    }
  }
}
