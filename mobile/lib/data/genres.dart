import 'dart:ui';

/// The same genres and colours as the web library.
const genreColors = <String, Color>{
  'Mystery': Color(0xFFB71C1C),
  'Thriller': Color(0xFF424242),
  'Horror': Color(0xFF1C1F2A),
  'Romance': Color(0xFFFF6F61),
  'Fantasy': Color(0xFF673AB7),
  'Sci-Fi': Color(0xFF1A1A6E),
  'Historical': Color(0xFFB76E79),
  'Contemporary': Color(0xFFFF7043),
};

List<String> get genres => genreColors.keys.toList();

Color genreColor(String genre) => genreColors[genre] ?? const Color(0xFF6B7280);
