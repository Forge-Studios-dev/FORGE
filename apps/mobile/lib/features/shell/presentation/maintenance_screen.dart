import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';

class MaintenanceScreen extends StatelessWidget {
  const MaintenanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.build_circle_outlined, size: 64, color: ForgeTokens.of(context).primary),
                const SizedBox(height: 20),
                Text(
                  'Under maintenance',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: ForgeTokens.of(context).onSurface),
                ),
                const SizedBox(height: 12),
                Text(
                  "FORGE is being upgraded. We'll be back shortly.",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, height: 1.5),
                ),
                const SizedBox(height: 28),
                ForgeButton(label: 'Back home', onPressed: () => context.go('/feed')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
