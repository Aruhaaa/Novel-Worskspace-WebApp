import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Typefaces. Headings use the same Instrument Serif as the web app. Chapters are read and written in a
/// serif of the writer's choice; those are fetched once and kept, and the phone's own serif is used until then.
class Fonts {
  Fonts._();

  /// Off in tests, which must not reach for the network.
  static bool webFonts = false;

  static const sans = 'DM Sans';
  static const display = 'Instrument Serif';

  static TextStyle prose(
    String family, {
    double size = 18,
    double height = 1.7,
    Color? color,
  }) {
    final base = TextStyle(
      fontSize: size,
      height: height,
      color: color,
      fontFamily: 'serif',
    );
    if (!webFonts) return base;
    try {
      return GoogleFonts.getFont(family, textStyle: base);
    } catch (_) {
      return base;
    }
  }
}

class ProseFont {
  const ProseFont(this.id, this.label, this.family);
  final String id;
  final String label;
  final String family;
}

const proseFonts = <ProseFont>[
  ProseFont('lora', 'Lora', 'Lora'),
  ProseFont('merriweather', 'Merriweather', 'Merriweather'),
  ProseFont('crimson', 'Crimson Pro', 'Crimson Pro'),
  ProseFont('garamond', 'EB Garamond', 'EB Garamond'),
  ProseFont('playfair', 'Playfair Display', 'Playfair Display'),
  ProseFont('inter', 'Inter', 'Inter'),
];

ProseFont proseFontById(String id) =>
    proseFonts.firstWhere((f) => f.id == id, orElse: () => proseFonts.first);

/// The six themes of the web app, with the same colours.
class ThemeOption {
  const ThemeOption({
    required this.id,
    required this.name,
    required this.description,
    required this.canvas,
    required this.surface,
    required this.border,
    required this.ink,
    required this.muted,
    required this.accent,
    this.dark = false,
  });

  final String id;
  final String name;
  final String description;
  final Color canvas;
  final Color surface;
  final Color border;
  final Color ink;
  final Color muted;
  final Color accent;
  final bool dark;

  Color get onAccent =>
      ThemeData.estimateBrightnessForColor(accent) == Brightness.dark
      ? Colors.white
      : const Color(0xFF1B1B1B);
}

const themeOptions = <ThemeOption>[
  ThemeOption(
    id: 'studio',
    name: 'Literary Studio',
    description: 'Paper, ink and oxblood. The default.',
    canvas: Color(0xFFF5F2EB),
    surface: Color(0xFFFCFAF6),
    border: Color(0xFFDCD8CD),
    ink: Color(0xFF262722),
    muted: Color(0xFF716E63),
    accent: Color(0xFF813F38),
  ),
  ThemeOption(
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Plain black on white.',
    canvas: Color(0xFFFFFFFF),
    surface: Color(0xFFF6F7F9),
    border: Color(0xFFE5E7EB),
    ink: Color(0xFF111827),
    muted: Color(0xFF6B7280),
    accent: Color(0xFF0A0A0A),
  ),
  ThemeOption(
    id: 'parchment',
    name: 'Archival Parchment',
    description: 'Warm cream paper and iron-gall ink, for long reading.',
    canvas: Color(0xFFFAF6F0),
    surface: Color(0xFFF0EAE1),
    border: Color(0xFFDDD3C4),
    ink: Color(0xFF2D2825),
    muted: Color(0xFF6E645D),
    accent: Color(0xFF8A3324),
  ),
  ThemeOption(
    id: 'hardcover',
    name: 'Classic Hardcover',
    description: 'Crisp white pages with book-cloth green.',
    canvas: Color(0xFFF7F8F6),
    surface: Color(0xFFFFFFFF),
    border: Color(0xFFE1E4DD),
    ink: Color(0xFF1B2421),
    muted: Color(0xFF55605A),
    accent: Color(0xFF1C4035),
  ),
  ThemeOption(
    id: 'midnight',
    name: 'Midnight Reading Nook',
    description: 'Dark slate with candlelit text and a warm lamp accent.',
    canvas: Color(0xFF16171B),
    surface: Color(0xFF212328),
    border: Color(0xFF31343D),
    ink: Color(0xFFECE8DF),
    muted: Color(0xFF9A9890),
    accent: Color(0xFFE09F3E),
    dark: true,
  ),
  ThemeOption(
    id: 'coastal',
    name: 'Coastal Vintage',
    description: 'Calm paper grey with a terracotta touch.',
    canvas: Color(0xFFF4F5F6),
    surface: Color(0xFFFFFFFF),
    border: Color(0xFFDFE2E6),
    ink: Color(0xFF1E252B),
    muted: Color(0xFF535D66),
    accent: Color(0xFF354F52),
  ),
];

ThemeOption themeById(String id) => themeOptions.firstWhere(
  (t) => t.id == id,
  orElse: () => themeOptions.first,
);

ThemeData buildTheme(ThemeOption t) {
  final scheme = ColorScheme(
    brightness: t.dark ? Brightness.dark : Brightness.light,
    primary: t.accent,
    onPrimary: t.onAccent,
    secondary: t.accent,
    onSecondary: t.onAccent,
    error: const Color(0xFFB3261E),
    onError: Colors.white,
    surface: t.surface,
    onSurface: t.ink,
    outline: t.border,
    outlineVariant: t.border,
    surfaceContainerHighest: t.canvas,
  );

  TextStyle sans(
    double size, {
    FontWeight weight = FontWeight.w400,
    Color? color,
    double? height,
  }) => TextStyle(
    fontFamily: Fonts.sans,
    fontSize: size,
    fontWeight: weight,
    color: color ?? t.ink,
    height: height,
  );

  final text = TextTheme(
    displayLarge: TextStyle(
      fontFamily: Fonts.display,
      fontSize: 44,
      height: 1.05,
      color: t.ink,
    ),
    displayMedium: TextStyle(
      fontFamily: Fonts.display,
      fontSize: 36,
      height: 1.1,
      color: t.ink,
    ),
    headlineMedium: TextStyle(
      fontFamily: Fonts.display,
      fontSize: 30,
      height: 1.15,
      color: t.ink,
    ),
    headlineSmall: TextStyle(
      fontFamily: Fonts.display,
      fontSize: 26,
      height: 1.15,
      color: t.ink,
    ),
    titleLarge: TextStyle(
      fontFamily: Fonts.display,
      fontSize: 22,
      height: 1.2,
      color: t.ink,
    ),
    titleMedium: sans(16, weight: FontWeight.w600),
    titleSmall: sans(14, weight: FontWeight.w600),
    bodyLarge: sans(16, height: 1.55),
    bodyMedium: sans(14, height: 1.55),
    bodySmall: sans(12, color: t.muted, height: 1.5),
    labelLarge: sans(14, weight: FontWeight.w600),
    labelMedium: sans(12, weight: FontWeight.w500),
    labelSmall: sans(11, weight: FontWeight.w600, color: t.muted),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: t.canvas,
    canvasColor: t.canvas,
    dividerColor: t.border,
    textTheme: text,
    fontFamily: Fonts.sans,
    appBarTheme: AppBarTheme(
      backgroundColor: t.canvas,
      foregroundColor: t.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: Fonts.display,
        fontSize: 24,
        color: t.ink,
      ),
      shape: Border(bottom: BorderSide(color: t.border)),
    ),
    cardTheme: CardThemeData(
      color: t.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(6),
        side: BorderSide(color: t.border),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: t.canvas,
      surfaceTintColor: Colors.transparent,
      indicatorColor: t.accent.withValues(alpha: 0.14),
      height: 66,
      labelTextStyle: WidgetStatePropertyAll(sans(12, weight: FontWeight.w600)),
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(
          color: s.contains(WidgetState.selected) ? t.accent : t.muted,
        ),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: t.accent,
        foregroundColor: t.onAccent,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 22),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        textStyle: sans(15, weight: FontWeight.w600, color: t.onAccent),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: t.ink,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 22),
        side: BorderSide(color: t.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        textStyle: sans(15, weight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: t.accent,
        minimumSize: const Size(48, 44),
        textStyle: sans(14, weight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: t.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: t.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: t.accent, width: 1.6),
      ),
      labelStyle: sans(14, color: t.muted),
      hintStyle: sans(14, color: t.muted),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: t.surface,
      selectedColor: t.ink,
      side: BorderSide(color: t.border),
      shape: const StadiumBorder(),
      labelStyle: sans(13),
      secondaryLabelStyle: sans(13, color: t.canvas),
      showCheckmark: false,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: t.canvas,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: t.canvas,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: t.ink,
      contentTextStyle: sans(14, color: t.canvas),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
    ),
    dividerTheme: DividerThemeData(color: t.border, thickness: 1, space: 1),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: t.accent,
      linearTrackColor: t.border,
    ),
    listTileTheme: ListTileThemeData(iconColor: t.muted, textColor: t.ink),
  );
}
