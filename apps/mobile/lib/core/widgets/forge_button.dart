import 'package:flutter/material.dart';
import '../theme/forge_tokens.dart';

class ForgeButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool primary;

  const ForgeButton({super.key, required this.label, this.onPressed, this.primary = true});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: primary ? ForgeTokens.primaryContainer : ForgeTokens.surfaceContainerHigh,
        foregroundColor: primary ? ForgeTokens.onPrimary : ForgeTokens.onSurface,
        minimumSize: const Size.fromHeight(48),
        shape: const StadiumBorder(),
      ),
      child: Text(label),
    );
  }
}
