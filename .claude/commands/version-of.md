---
description: Look up which released client version each ticket shipped in (read-only)
argument-hint: BB-xxx [BB-yyy …] — optionally "BB-xxx: short description" to also search by feature
---
Find the released version for each ticket. Tickets: $ARGUMENTS

This is **read-only**. Don't edit files, create branches, or run anything beyond the searches below.
Don't look tickets up in any external tracker (there is none, per CLAUDE.md).

For each ticket:

1. **Search both sources** (word-boundary match, so BB-12 doesn't match BB-125):
   - `docs/changelog-v*.md`: which changelog files mention it, and whether it has its own
     `## BB-xxx` section or is only mentioned in passing (for example "superseded by" or "carried from").
   - Commit messages on `master`: `git log master --format='%h %s'`, plus the version in the
     release commit's subject.
2. **Decide:**
   - Both sources agree → report that version and the release commit hash.
   - They disagree, or the ticket appears in more than one version (for example a part 1 / part 2,
     or a later fix) → list each version and say what shipped in each.
   - The ticket appears only on an unmerged branch (`git log --all`), in an uncommitted file
     (`git status`), or in a non-changelog doc → report **none (not released)** and say where it
     was found.
   - No match at all → **none**.
3. **Delivered under another ticket:** if Carlo gave a short description, or the ticket isn't found,
   search the changelogs and source for the feature itself. If it shipped as part of another
   ticket, report "vX.Y.Z (delivered under BB-yyy)" and name the file and lines it rests on.
   Never guess from memory notes alone.

**Reply** with a table (Ticket | Version) and, only where needed, one line of notes per ticket
(server version it needs, partial delivery, where an unreleased ticket was found). Mention the
server version from the changelog when it's stated.

Only this client repo is searched. Server-only tickets will come back as none here. Say so
when a ticket looks server-side.
