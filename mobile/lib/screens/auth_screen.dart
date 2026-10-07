import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/backend.dart';
import '../state/app_state.dart';
import '../widgets/common.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.signUp});
  final bool signUp;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late bool _signUp = widget.signUp;
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _showPassword = false;
  String? _error;
  String? _notice;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() {
        _error = 'Enter your email address.';
      });
      return;
    }
    if (_password.text.length < 6) {
      setState(() {
        _error = 'Use a password of at least 6 characters.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    final state = context.read<AppState>();
    try {
      if (_signUp) {
        final signedIn = await state.signUp(email, _password.text);
        if (!signedIn && mounted) {
          setState(() {
            _notice =
                'Almost there. We sent a message to $email. Open it to confirm your address, then sign in.';
          });
          return;
        }
      } else {
        await state.signIn(email, _password.text);
      }
      // Signed in: the app now shows its own screens, so close this one
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } on BackendException catch (e) {
      if (mounted)
        setState(() {
          _error = e.message;
        });
    } finally {
      if (mounted)
        setState(() {
          _busy = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_signUp ? 'Create an account' : 'Welcome back'),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Eyebrow(_signUp ? 'Free, and it takes a moment' : 'Sign in'),
                const SizedBox(height: 10),
                Text(
                  _signUp
                      ? 'Start your first book, or just keep your place in someone else\'s.'
                      : 'Pick up where you left off.',
                  style: t.textTheme.headlineSmall,
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _password,
                  obscureText: !_showPassword,
                  autofillHints: [
                    _signUp
                        ? AutofillHints.newPassword
                        : AutofillHints.password,
                  ],
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _busy ? null : _submit(),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    suffixIcon: IconButton(
                      tooltip: _showPassword
                          ? 'Hide password'
                          : 'Show password',
                      icon: Icon(
                        _showPassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () =>
                          setState(() => _showPassword = !_showPassword),
                    ),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    _error!,
                    style: TextStyle(color: t.colorScheme.error),
                    key: const Key('auth-error'),
                  ),
                ],
                if (_notice != null) ...[
                  const SizedBox(height: 14),
                  Text(_notice!, style: t.textTheme.bodyMedium),
                ],
                const SizedBox(height: 22),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: _busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(_signUp ? 'Create account' : 'Sign in'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() {
                    _signUp = !_signUp;
                    _error = null;
                    _notice = null;
                  }),
                  child: Text(
                    _signUp ? 'I already have an account' : 'Create an account',
                  ),
                ),
                if (!context.read<AppState>().backend.isCloud) ...[
                  const SizedBox(height: 12),
                  Text(
                    'This copy of the app keeps everything on this phone, so any email and a password of 6 letters or more will do.',
                    style: t.textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
