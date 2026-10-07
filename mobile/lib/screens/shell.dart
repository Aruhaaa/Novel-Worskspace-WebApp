import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import 'me/account_screen.dart';
import 'read/discover_screen.dart';
import 'write/projects_screen.dart';

/// Read, Write and Me. The person's own choice decides which opens first; nothing is hidden from anyone.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  late int _index = context.read<AppState>().mode == UseMode.write ? 1 : 0;

  @override
  Widget build(BuildContext context) {
    final userId = context.select<AppState, String?>((s) => s.user?.id);
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          const DiscoverScreen(),
          ProjectsScreen(key: ValueKey(userId)),
          const AccountScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book),
            label: 'Read',
          ),
          NavigationDestination(
            icon: Icon(Icons.edit_note_outlined),
            selectedIcon: Icon(Icons.edit_note),
            label: 'Write',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Me',
          ),
        ],
      ),
    );
  }
}
