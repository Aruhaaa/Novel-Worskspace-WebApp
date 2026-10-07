import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/app.dart';
import 'package:novelist_workspace/data/backend.dart';
import 'package:novelist_workspace/data/models.dart';
import 'package:novelist_workspace/data/local_backend.dart';
import 'package:novelist_workspace/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A phone-sized screen.
void usePhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 1700);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

class Booted {
  Booted(this.state, this.backend, this.prefs);
  final AppState state;
  final Backend backend;
  final SharedPreferences prefs;
}

/// Starts the whole app on a fresh phone.
Future<Booted> boot(
  WidgetTester tester, {
  Backend Function(SharedPreferences prefs)? makeBackend,
  Map<String, Object> initial = const {},
}) async {
  usePhone(tester);
  SharedPreferences.setMockInitialValues({...initial});
  final prefs = await SharedPreferences.getInstance();
  final backend = makeBackend != null
      ? makeBackend(prefs)
      : await LocalBackend.open(prefs);
  final state = AppState(backend: backend, prefs: prefs);
  await state.init();
  await tester.pumpWidget(NovelistApp(state: state));
  await tester.pumpAndSettle();
  return Booted(state, backend, prefs);
}

/// Shows one screen inside the app's providers and theme.
Future<void> pumpScreen(
  WidgetTester tester,
  AppState state,
  Widget screen,
) async {
  await tester.pumpWidget(NovelistApp(state: state));
  await tester.pumpAndSettle();
  final nav = tester.state<NavigatorState>(find.byType(Navigator).first);
  nav.push(MaterialPageRoute<void>(builder: (_) => screen));
  await tester.pumpAndSettle();
}

/// A local data source whose saves can be made to fail, like a dropped connection.
class FlakyBackend extends LocalBackend {
  FlakyBackend(SharedPreferences prefs)
    : super.withData(prefs, LocalBackend.seed());
  bool failing = false;
  int saveAttempts = 0;

  @override
  Future<Chapter> updateChapter(
    String id, {
    String? title,
    String? content,
    int? position,
  }) {
    saveAttempts++;
    if (failing)
      throw BackendException('You seem to be offline.', offline: true);
    return super.updateChapter(
      id,
      title: title,
      content: content,
      position: position,
    );
  }
}
