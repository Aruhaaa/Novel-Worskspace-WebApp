import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../auth_screen.dart';
import '../link/reading_link_screen.dart';

/// You: your name and goal, how the app looks, and sign out.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final t = Theme.of(context);
    final p = state.profile;

    return Scaffold(
      appBar: AppBar(title: const Text('Me')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          if (state.signedIn) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: t.colorScheme.primary,
                          child: Text(
                            state.authorName.characters.first.toUpperCase(),
                            style: TextStyle(
                              color: t.colorScheme.onPrimary,
                              fontFamily: Fonts.display,
                              fontSize: 24,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                state.authorName,
                                style: t.textTheme.titleLarge,
                              ),
                              Text(
                                state.user!.email,
                                style: t.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Divider(),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Name shown on your novels'),
                      subtitle: Text(
                        p?.displayName.isEmpty ?? true
                            ? 'Not set'
                            : p!.displayName,
                      ),
                      trailing: const Icon(Icons.edit_outlined, size: 20),
                      onTap: () async {
                        final v = await askForText(
                          context,
                          title: 'Your name',
                          label: 'Display name',
                          initial: p?.displayName ?? '',
                        );
                        if (v != null && context.mounted)
                          await state.saveProfile(displayName: v);
                      },
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Daily word goal'),
                      subtitle: Text('${p?.dailyWordGoal ?? 1000} words'),
                      trailing: const Icon(Icons.edit_outlined, size: 20),
                      onTap: () async {
                        final v = await askForText(
                          context,
                          title: 'Daily word goal',
                          label: 'Words per day',
                          initial: '${p?.dailyWordGoal ?? 1000}',
                        );
                        final n = int.tryParse(v ?? '');
                        if (n != null && n > 0 && context.mounted)
                          await state.saveProfile(dailyWordGoal: n);
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 22),
            const Eyebrow('Where the app opens'),
            const SizedBox(height: 8),
            SegmentedButton<UseMode>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: UseMode.read, label: Text('Reading')),
                ButtonSegment(value: UseMode.write, label: Text('Writing')),
                ButtonSegment(value: UseMode.both, label: Text('Both')),
              ],
              selected: {state.mode ?? UseMode.both},
              onSelectionChanged: (v) => state.chooseMode(v.first),
            ),
          ] else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'You are browsing as a guest',
                      style: t.textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Reading and saving novels works without an account. Sign in to write, like novels and keep everything in step.',
                      style: t.textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AuthScreen(signUp: false),
                        ),
                      ),
                      child: const Text('Sign in or create an account'),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 26),
          const Eyebrow('Theme'),
          const SizedBox(height: 10),
          for (final th in themeOptions)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () => state.setTheme(th.id),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: th.canvas,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: state.theme.id == th.id
                          ? t.colorScheme.primary
                          : th.border,
                      width: state.theme.id == th.id ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: th.surface,
                          border: Border.all(color: th.border),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        alignment: Alignment.center,
                        child: Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: th.accent,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              th.name,
                              style: TextStyle(
                                fontFamily: Fonts.sans,
                                fontWeight: FontWeight.w600,
                                color: th.ink,
                              ),
                            ),
                            Text(
                              th.description,
                              style: TextStyle(
                                fontFamily: Fonts.sans,
                                fontSize: 12,
                                color: th.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (state.theme.id == th.id)
                        Icon(Icons.check_circle, color: th.accent),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 22),
          const Eyebrow('Reading and writing type'),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in proseFonts)
                ChoiceChip(
                  selected: state.proseFontId == f.id,
                  label: Text(f.label),
                  onSelected: (_) => state.setProseFont(f.id),
                ),
            ],
          ),
          Row(
            children: [
              const Icon(Icons.text_decrease, size: 20),
              Expanded(
                child: Slider(
                  value: state.fontScale,
                  min: 0.8,
                  max: 1.6,
                  divisions: 8,
                  label: '${(state.fontScale * 100).round()}%',
                  onChanged: state.setFontScale,
                ),
              ),
              const Icon(Icons.text_increase, size: 24),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'On the morning the sea disappeared, Ada was making tea.',
              style: Fonts.prose(
                proseFontById(state.proseFontId).family,
                size: 18 * state.fontScale,
                color: t.colorScheme.onSurface,
              ),
            ),
          ),
          const SizedBox(height: 18),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.link),
            title: const Text('Open a reading link'),
            subtitle: const Text('A writer sent you a private link'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ReadingLinkScreen()),
            ),
          ),
          const Divider(),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(
              state.backend.isCloud
                  ? Icons.cloud_done_outlined
                  : Icons.phone_android,
            ),
            title: Text(
              state.backend.isCloud
                  ? 'Connected to the cloud'
                  : 'Kept on this phone only',
            ),
            subtitle: Text(
              state.backend.isCloud
                  ? 'Your novels are the same here and on the web.'
                  : 'Nothing leaves this phone. Connect a database to share with the web app.',
            ),
          ),
          if (state.signedIn) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
              onPressed: () async {
                if (await confirm(
                  context,
                  title: 'Sign out?',
                  text: 'Your novels stay safe in your account.',
                  action: 'Sign out',
                ))
                  await state.signOut();
              },
            ),
          ] else
            const SizedBox.shrink(),
        ],
      ),
    );
  }
}
