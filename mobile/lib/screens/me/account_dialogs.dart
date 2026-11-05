import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';

/// Asks for the current password and a new one, twice.
Future<void> changePasswordFlow(BuildContext context) async {
  final done = await showDialog<bool>(
    context: context,
    builder: (_) => const _ChangePasswordDialog(),
  );
  if (done == true && context.mounted) say(context, 'Password changed.');
}

class _ChangePasswordDialog extends StatefulWidget {
  const _ChangePasswordDialog();

  @override
  State<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<_ChangePasswordDialog> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _again = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _again.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_next.text.length < 6) {
      setState(() => _error = 'Use at least 6 characters.');
      return;
    }
    if (_next.text != _again.text) {
      setState(() => _error = 'The two new passwords do not match.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AppState>().changePassword(_current.text, _next.text);
      if (mounted) Navigator.pop(context, true);
    } on BackendException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return AlertDialog(
      title: Text('Change password', style: t.textTheme.titleLarge),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _current,
              obscureText: true,
              autofillHints: const [AutofillHints.password],
              decoration: const InputDecoration(labelText: 'Current password'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _next,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              decoration: const InputDecoration(labelText: 'New password'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _again,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Type the new password again',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: TextStyle(color: t.colorScheme.error),
                key: const Key('password-error'),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: Text(_busy ? 'Saving…' : 'Change password'),
        ),
      ],
    );
  }
}

/// The last word before an account is deleted: say what goes, and ask for the password and the word DELETE.
Future<void> deleteAccountFlow(BuildContext context) async {
  final deleted = await showDialog<bool>(
    context: context,
    builder: (_) => const _DeleteAccountDialog(),
  );
  // On success the app signs out and shows the front door, so there is nothing more to do here
  if (deleted == true && context.mounted) {
    say(context, 'Your account has been deleted.');
  }
}

class _DeleteAccountDialog extends StatefulWidget {
  const _DeleteAccountDialog();

  @override
  State<_DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<_DeleteAccountDialog> {
  static const _word = 'DELETE';
  final _typed = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _typed.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AppState>().deleteAccount(_password.text);
      if (mounted) Navigator.pop(context, true);
    } on BackendException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final cloud = context.read<AppState>().backend.isCloud;
    final ready =
        _typed.text.trim() == _word && (!cloud || _password.text.isNotEmpty);
    return AlertDialog(
      title: Text('Delete your account?', style: t.textTheme.titleLarge),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This cannot be undone. Your novels and chapters, notebook, notes, word counts and profile are removed for good, and your published novels leave the library.',
              style: t.textTheme.bodyMedium,
            ),
            const SizedBox(height: 14),
            if (cloud) ...[
              TextField(
                controller: _password,
                obscureText: true,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Password'),
              ),
              const SizedBox(height: 10),
            ],
            TextField(
              controller: _typed,
              autocorrect: false,
              textCapitalization: TextCapitalization.characters,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Type DELETE'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: TextStyle(color: t.colorScheme.error),
                key: const Key('delete-error'),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context, false),
          child: const Text('Keep my account'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: t.colorScheme.error,
            foregroundColor: t.colorScheme.onError,
          ),
          onPressed: ready && !_busy ? _delete : null,
          child: Text(_busy ? 'Deleting…' : 'Delete everything'),
        ),
      ],
    );
  }
}
