import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../widgets/common.dart';
import 'auth_screen.dart';
import 'link/reading_link_screen.dart';

/// The front door. Reading and writing are equal: nobody is asked to write just to read.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final state = context.read<AppState>();
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(28, 24, 28, 28),
              children: [
                const Align(
                  alignment: Alignment.centerLeft,
                  child: BrandMark(size: 52),
                ),
                const SizedBox(height: 40),
                const Eyebrow('Novelist Workspace'),
                const SizedBox(height: 14),
                Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Read a good story.\n'),
                      TextSpan(
                        text: 'Write your own.',
                        style: TextStyle(
                          fontStyle: FontStyle.italic,
                          color: t.colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                  style: t.textTheme.displayMedium,
                ),
                const SizedBox(height: 16),
                Text(
                  'Browse novels from writers around the world, keep your place wherever you stop, and when you are ready, plan and draft a book of your own.',
                  style: t.textTheme.bodyLarge?.copyWith(
                    color: t.colorScheme.onSurface.withValues(alpha: 0.75),
                  ),
                ),
                const SizedBox(height: 32),
                FilledButton.icon(
                  icon: const Icon(Icons.menu_book_outlined),
                  label: const Text('Start reading'),
                  onPressed: state.browseAsGuest,
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.edit_note),
                  label: const Text('Start writing'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const AuthScreen(signUp: true),
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                const Divider(),
                const SizedBox(height: 8),
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AuthScreen(signUp: false),
                        ),
                      ),
                      child: const Text('Sign in'),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.link, size: 18),
                      label: const Text('I have a reading link'),
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const ReadingLinkScreen(),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
