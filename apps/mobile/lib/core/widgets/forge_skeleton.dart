import 'package:flutter/material.dart';
import '../theme/forge_tokens.dart';

class ForgeSkeleton extends StatelessWidget {
  final double? width;
  final double height;
  final BorderRadius borderRadius;

  const ForgeSkeleton({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = const BorderRadius.all(Radius.circular(8)),
  });

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: t.surfaceContainerHigh,
        borderRadius: borderRadius,
      ),
    );
  }
}

class FeedSkeletonList extends StatelessWidget {
  final int count;
  const FeedSkeletonList({super.key, this.count = 3});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      itemBuilder: (_, __) => const Padding(
        padding: EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ForgeSkeleton(height: 200, borderRadius: BorderRadius.all(Radius.circular(12))),
            SizedBox(height: 12),
            ForgeSkeleton(width: 200, height: 14),
            SizedBox(height: 8),
            ForgeSkeleton(width: 120, height: 12),
          ],
        ),
      ),
    );
  }
}
