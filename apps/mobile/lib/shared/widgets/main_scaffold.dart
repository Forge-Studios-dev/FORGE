import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/forge_tokens.dart';

class MainScaffold extends StatelessWidget {
  final Widget child;
  const MainScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;

    return Scaffold(
      backgroundColor: ForgeTokens.background,
      body: child,
      bottomNavigationBar: NavigationBar(
        backgroundColor: ForgeTokens.surfaceContainerLow,
        indicatorColor: ForgeTokens.primary.withValues(alpha: 0.15),
        selectedIndex: _selectedIndex(location),
        onDestinationSelected: (index) => _onTap(context, index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.sensors), selectedIcon: Icon(Icons.sensors), label: 'Live'),
          NavigationDestination(icon: Icon(Icons.video_library_outlined), selectedIcon: Icon(Icons.video_library), label: 'Library'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  int _selectedIndex(String location) {
    if (location.startsWith('/feed') || location.startsWith('/watch')) return 0;
    if (location.startsWith('/explore')) return 1;
    if (location.startsWith('/live')) return 2;
    if (location.startsWith('/library') || location.startsWith('/history') || location.startsWith('/notifications')) return 3;
    if (location.startsWith('/profile') || location.startsWith('/studio')) return 4;
    return 0;
  }

  void _onTap(BuildContext context, int index) {
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
        context.go('/library');
        break;
      case 4:
        context.go('/profile/me');
        break;
    }
  }
}
