import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/topic_chip.dart';
import '../data/onboarding_storage.dart';

const _interestOptions = <String>[
  'Music',
  'Coding',
  'Design',
  'Fitness',
  'Cooking',
  'Photography',
  'Business',
  'Language',
  'Art',
  'Writing',
  'Gaming',
  'Finance',
];

const _maxInterests = 5;

/// Three-screen, first-run onboarding: value prop, live + community, then an
/// interest picker (reusing [TopicChip]) so the feed can be personalized.
/// Shown once per signed-in user — see the onboarding gate in
/// `core/router/app_router.dart`.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  int _page = 0;
  final Set<String> _selected = {};
  bool _finishing = false;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _next() {
    if (_page == 2) {
      _finish();
      return;
    }
    _pageController.nextPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _finish() async {
    if (_finishing) return;
    setState(() => _finishing = true);
    try {
      await saveOnboardingInterests(_selected.toList());
      await markOnboardingComplete();
    } finally {
      if (mounted) {
        context.go('/feed');
      }
    }
  }

  void _toggleInterest(String label) {
    setState(() {
      if (_selected.contains(label)) {
        _selected.remove(label);
      } else if (_selected.length < _maxInterests) {
        _selected.add(label);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final canFinish = _page != 2 || _selected.isNotEmpty;
    return Scaffold(
      backgroundColor: ForgeTokens.of(context).background,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (_page < 2)
                    TextButton(
                      onPressed: _finishing ? null : _finish,
                      child: const Text('Skip'),
                    ),
                ],
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (i) => setState(() => _page = i),
                children: [
                  const _OnboardingSlide(
                    icon: Icons.play_circle_outline,
                    title: 'Videos you love',
                    description:
                        'Watch videos, Shorts, and live streams from creators you subscribe to — then save them to your library.',
                  ),
                  const _OnboardingSlide(
                    icon: Icons.subscriptions_outlined,
                    title: 'Subscribe & engage',
                    description:
                        'Subscribe to channels, join live chats, and stay notified when creators upload or go live.',
                  ),
                  _InterestPickerSlide(
                    selected: _selected,
                    onToggle: _toggleInterest,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(3, (i) => _Dot(active: i == _page)),
                  ),
                  const SizedBox(height: 20),
                  ForgeButton(
                    label: _page == 2 ? 'Get started' : 'Next',
                    onPressed: _finishing || !canFinish ? null : _next,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  final bool active;
  const _Dot({required this.active});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: active ? 20 : 8,
      height: 8,
      decoration: BoxDecoration(
        color: active ? ForgeTokens.of(context).primary : ForgeTokens.of(context).outlineVariant,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

class _OnboardingSlide extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _OnboardingSlide({
    required this.icon,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 72, color: ForgeTokens.of(context).primary),
          const SizedBox(height: 28),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: ForgeTokens.of(context).onSurface,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            description,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 15,
              height: 1.4,
              color: ForgeTokens.of(context).onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _InterestPickerSlide extends StatelessWidget {
  final Set<String> selected;
  final void Function(String) onToggle;

  const _InterestPickerSlide({required this.selected, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'What do you want to learn?',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: ForgeTokens.of(context).onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Pick up to $_maxInterests — we\'ll personalize your feed.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: ForgeTokens.of(context).onSurfaceVariant),
          ),
          const SizedBox(height: 24),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 10,
            runSpacing: 10,
            children: _interestOptions.map((label) {
              final isSelected = selected.contains(label);
              return GestureDetector(
                onTap: () => onToggle(label),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: isSelected ? ForgeTokens.of(context).primary : Colors.transparent,
                      width: 2,
                    ),
                  ),
                  child: Opacity(
                    opacity: isSelected ? 1 : 0.6,
                    child: TopicChip(label: label),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
