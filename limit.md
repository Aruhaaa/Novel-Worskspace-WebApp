# Known limits

Things that are not done or not verified yet. Remove a line when it is fixed.

## Website: Read | Write

- Your answer to "What opens first" is saved per device, not on the profile. Another device asks once. Saving it to the profile needs a new database column.
- Existing signed-in writers see the question once, on their next visit.
- "Continue reading" reopens the novel, not the chapter you stopped at. The web reader does not store a reading place yet; the phone app does.
- Not tested against the real Supabase project. Browser testing ran in local mode (no cloud keys).
- Lint still reports 3 problems from before this work: `AuthView.tsx` (unused assignment) and two `any` types in `AppContext.tsx`.

## Phone app (`mobile/`)

- Not run on a real phone or emulator. The Android debug build compiles; the iOS build was not tried (needs a Mac).
- Not tested against the real Supabase project, only a stand-in server.
- Tapping a reading link in a message does not open the app. It needs Android App Links and iOS Universal Links on your domain. For now the link is pasted in Me, then Open a reading link.
- No version history, export, outline, timeline, tour or story search on the phone yet.
- The mention, highlight and scene-break buttons sit at the end of the scrolling editor toolbar.
- Reading typefaces download on first use; the phone's serif shows until then.
- The app id is still `com.novelist.novelist_workspace`. Change it and add signing keys before any store release.
- Chapter notes and the Recently deleted list sync to the cloud only after `supabase/migrations/20261003_cloud_sync.sql` has been run; until then they stay on the phone.
