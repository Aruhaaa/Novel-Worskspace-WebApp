import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_quill/flutter_quill.dart'
    show FlutterQuillLocalizations;
import 'package:provider/provider.dart';

import 'data/backend.dart';
import 'screens/mode_screen.dart';
import 'screens/shell.dart';
import 'screens/welcome_screen.dart';
import 'state/app_state.dart';
import 'theme.dart';
import 'widgets/common.dart';

class NovelistApp extends StatelessWidget {
  const NovelistApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AppState>.value(value: state),
        Provider<Backend>.value(value: state.backend),
      ],
      child: Consumer<AppState>(
        builder: (context, s, _) => MaterialApp(
          title: 'Novelist Workspace',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(s.theme),
          localizationsDelegates: const [
            ...FlutterQuillLocalizations.localizationsDelegates,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: FlutterQuillLocalizations.supportedLocales,
          home: const _RootGate(),
        ),
      ),
    );
  }
}

/// Decides what to show: the front door, the one question, or the app.
class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    if (s.booting) {
      return const Scaffold(body: Center(child: BrandMark(size: 56)));
    }
    if (!s.inApp) return const WelcomeScreen();
    if (s.signedIn && s.mode == null) return const ModeScreen();
    return const Shell();
  }
}
