import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../widgets/common.dart';

/// One question, asked once. It only decides where the app opens; both spaces stay one tap away.
class ModeScreen extends StatelessWidget {
  const ModeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final state = context.read<AppState>();
    Widget tile(UseMode mode, IconData icon, String title, String text) =>
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: InkWell(
            borderRadius: BorderRadius.circular(6),
            onTap: () => state.chooseMode(mode),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    Icon(icon, size: 30, color: t.colorScheme.primary),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: t.textTheme.titleLarge),
                          const SizedBox(height: 2),
                          Text(text, style: t.textTheme.bodySmall),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right, color: t.colorScheme.outline),
                  ],
                ),
              ),
            ),
          ),
        );
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.all(28),
              children: [
                const BrandMark(size: 44),
                const SizedBox(height: 32),
                const Eyebrow('Welcome'),
                const SizedBox(height: 10),
                Text('What brings you here?', style: t.textTheme.displayMedium),
                const SizedBox(height: 8),
                Text(
                  'This only decides where the app opens. You can switch whenever you like.',
                  style: t.textTheme.bodyMedium,
                ),
                const SizedBox(height: 28),
                tile(
                  UseMode.read,
                  Icons.menu_book_outlined,
                  'To read',
                  'Discover novels and keep your place.',
                ),
                tile(
                  UseMode.write,
                  Icons.edit_note,
                  'To write',
                  'Plan, draft and finish a book of my own.',
                ),
                tile(
                  UseMode.both,
                  Icons.auto_stories_outlined,
                  'Both',
                  'A bit of each, opening on reading.',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
