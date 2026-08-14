import 'package:flutter/material.dart';
import '../theme/forge_tokens.dart';

class ForgeButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool primary;

  const ForgeButton({super.key, required this.label, this.onPressed, this.primary = true});

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: primary ? t.primaryContainer : t.surfaceContainerHigh,
        foregroundColor: primary ? t.onPrimary : t.onSurface,
        minimumSize: const Size.fromHeight(48),
        shape: const StadiumBorder(),
      ),
      child: Text(label),
    );
  }
}
