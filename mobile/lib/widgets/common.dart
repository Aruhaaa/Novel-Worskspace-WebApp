import 'package:flutter/material.dart';

import '../data/backend.dart';
import '../data/genres.dart';
import '../data/models.dart';
import '../theme.dart';

/// A small spaced-out label above a heading, like the web app's.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color});
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontFamily: Fonts.sans,
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.6,
        color: color ?? cs.primary,
      ),
    );
  }
}

/// The "n." mark.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 40});
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return Container(
      width: size * 0.9,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(border: Border.all(color: c)),
      child: Text(
        'n.',
        style: TextStyle(
          fontFamily: Fonts.display,
          fontStyle: FontStyle.italic,
          fontSize: size * 0.72,
          height: 1,
          color: c,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.text,
    this.action,
  });
  final IconData icon;
  final String title;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: t.colorScheme.outline),
            const SizedBox(height: 14),
            Text(
              title,
              style: t.textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              text,
              style: t.textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}

/// Shows a future's result with a spinner while it loads and a plain message, with Try again, if it fails.
class AsyncBody<T> extends StatelessWidget {
  const AsyncBody({
    super.key,
    required this.future,
    required this.builder,
    this.onRetry,
  });
  final Future<T> future;
  final Widget Function(BuildContext context, T data) builder;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snap.hasError) {
          final e = snap.error;
          final offline = e is BackendException && e.offline;
          return EmptyState(
            icon: offline ? Icons.cloud_off_outlined : Icons.error_outline,
            title: offline ? 'You seem to be offline' : 'That did not load',
            text: e is BackendException ? e.message : 'Something went wrong.',
            action: onRetry == null
                ? null
                : OutlinedButton(
                    onPressed: onRetry,
                    child: const Text('Try again'),
                  ),
          );
        }
        return builder(context, snap.data as T);
      },
    );
  }
}

/// A book cover: the cover image if there is one, otherwise the title on a colour taken from its genre.
class Cover extends StatelessWidget {
  const Cover({super.key, required this.project, this.width = 96});
  final Project project;
  final double width;

  @override
  Widget build(BuildContext context) {
    final height = width * 1.45;
    final color = project.genre.isEmpty
        ? Theme.of(context).colorScheme.primary
        : genreColor(project.genre);
    final fallback = Container(
      width: width,
      height: height,
      padding: EdgeInsets.all(width * 0.1),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(3),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        project.title,
        textAlign: TextAlign.center,
        maxLines: 5,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontFamily: Fonts.display,
          fontStyle: FontStyle.italic,
          color: Colors.white,
          fontSize: width * 0.17,
          height: 1.1,
        ),
      ),
    );
    if (project.coverUrl.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(3),
      child: Image.network(
        project.coverUrl,
        width: width,
        height: height,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
      ),
    );
  }
}

Future<String?> askForText(
  BuildContext context, {
  required String title,
  required String label,
  String initial = '',
  String? hint,
  String action = 'Save',
  bool multiline = false,
}) {
  final controller = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title, style: Theme.of(ctx).textTheme.titleLarge),
      content: TextField(
        controller: controller,
        autofocus: true,
        minLines: multiline ? 3 : 1,
        maxLines: multiline ? 6 : 1,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(labelText: label, hintText: hint),
        onSubmitted: multiline ? null : (v) => Navigator.pop(ctx, v.trim()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, controller.text.trim()),
          child: Text(action),
        ),
      ],
    ),
  );
}

Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String text,
  String action = 'Yes',
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title, style: Theme.of(ctx).textTheme.titleLarge),
      content: Text(text),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(action),
        ),
      ],
    ),
  );
  return ok ?? false;
}

void say(
  BuildContext context,
  String message, {
  String? actionLabel,
  VoidCallback? onAction,
}) {
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      content: Text(message),
      duration: Duration(seconds: actionLabel == null ? 4 : 8),
      action: actionLabel == null
          ? null
          : SnackBarAction(label: actionLabel, onPressed: onAction ?? () {}),
    ),
  );
}

String describe(Object e) => e is BackendException
    ? e.message
    : 'Something went wrong. Please try again.';
