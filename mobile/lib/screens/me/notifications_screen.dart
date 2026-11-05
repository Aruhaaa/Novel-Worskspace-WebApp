import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/models.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';

IconData _iconFor(String kind) => switch (kind) {
  'follow' => Icons.person_add_alt,
  'comment' => Icons.chat_bubble_outline,
  'review' => Icons.star_outline,
  'message' => Icons.mail_outline,
  'share_comment' => Icons.link,
  'collab' => Icons.group_add_outlined,
  _ => Icons.notifications_none,
};

/// How long ago, in a few words
String _ago(DateTime when) {
  final d = DateTime.now().difference(when);
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  if (d.inDays < 7) return '${d.inDays} d ago';
  return '${when.day}/${when.month}/${when.year}';
}

/// What happened while you were away, newest first, and what you want to hear about.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    // Look again as the screen opens, so it is never older than the moment it was opened
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppState>().loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final t = Theme.of(context);
    final items = state.notifications;
    final muted = state.notificationSettings.muted;
    final shown = (items ?? const <AppNotification>[]).where((n) => !muted.contains(n.kind)).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (state.unreadNotifications > 0)
            TextButton(
              onPressed: () => state.markNotificationsRead(),
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: state.loadNotifications,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            if (items == null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Text(
                  'Notifications come from the cloud database. Connect one, or ask the site owner to run the setup step, and they will show up here.',
                  style: t.textTheme.bodyMedium,
                ),
              )
            else if (shown.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Text(
                  'Nothing new yet. Follows, comments, reviews and messages will show up here.',
                  style: t.textTheme.bodyMedium,
                ),
              )
            else
              for (final n in shown)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(_iconFor(n.kind)),
                  title: Text(
                    n.title,
                    style: n.unread
                        ? const TextStyle(fontWeight: FontWeight.w700)
                        : null,
                  ),
                  subtitle: Text(
                    [if (n.detail.isNotEmpty) n.detail, _ago(n.createdAt)].join(' · '),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: n.unread
                      ? Icon(Icons.circle, size: 10, color: t.colorScheme.primary)
                      : null,
                  onTap: () => state.markNotificationsRead(ids: [n.id]),
                ),
            const Divider(height: 32),
            const Eyebrow('Choose what to hear about'),
            Text(
              'Switching a kind off means it is not recorded at all.',
              style: t.textTheme.bodySmall,
            ),
            for (final kind in notificationKinds)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(notificationKindLabels[kind] ?? kind),
                value: !muted.contains(kind),
                onChanged: (on) => state.setNotificationMuted(kind, !on),
              ),
          ],
        ),
      ),
    );
  }
}
