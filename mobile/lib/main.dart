import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'config.dart';
import 'data/backend.dart';
import 'data/local_backend.dart';
import 'data/supabase_backend.dart';
import 'state/app_state.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Fonts.webFonts = true;
  final prefs = await SharedPreferences.getInstance();

  // With cloud details the app shares its data with the web app; without, it runs on this phone alone
  final Backend backend;
  if (Config.hasCloud) {
    await Supabase.initialize(
      url: Config.supabaseUrl,
      // The anon key of an existing project works as is; the newer "publishable" naming is not needed
      // ignore: deprecated_member_use
      anonKey: Config.supabaseAnonKey,
    );
    backend = SupabaseBackend(prefs);
  } else {
    backend = await LocalBackend.open(prefs);
  }

  final state = AppState(backend: backend, prefs: prefs);
  await state.init();
  runApp(NovelistApp(state: state));
}
