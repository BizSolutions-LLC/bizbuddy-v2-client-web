---
description: Prepare a push — ask Carlo for the version, then branch, bump package.json, changelog, commit, and (after Carlo pushes) open the PR
argument-hint: [optional: ticket numbers in this push, e.g. BB-132 BB-133]
---
Prepare the next push following "Versioning, changelog and release" in CLAUDE.md.
Tickets mentioned: $ARGUMENTS

Before every Bash command that triggers an approval prompt, explain in plain language what it
does and why, as a separate message, per CLAUDE.md.

1. **Check (read-only).**
   - Run `git fetch origin`. It's safe, but explain it first.
   - Show the uncommitted and unpushed changes, grouped by ticket where possible.
   - Show these version references side by side and flag any disagreement:
     - `package.json` `"version"`;
     - the highest `docs/changelog-v*.md` (use `sort -V`);
     - the latest merge on `origin/master`;
     - the newest `origin/release/*` branch.
   - If the mobile developer (or anyone else) has merged since our last push, say so.
2. **Ask Carlo.** Use AskUserQuestion. Never pick or infer the number yourself.
   - Ask for the final version. Suggest the next patch and the next minor based on the highest
     reference.
   - Ask which tickets this push includes. Pre-fill the list from $ARGUMENTS and the changes.
   - Ask which changed files to leave out, e.g. `.vscode/settings.json` and other local-only
     files.
   - Stop until he answers.
3. **Branch.**
   - If the work isn't on `release/vX.Y.Z` yet, create it with
     `git switch -c release/vX.Y.Z --no-track origin/master`. Uncommitted work carries over.
   - If the work is already committed on another unpushed branch, ask before moving it.
   - Never reuse an older release branch for a new version.
4. **Version.** Run `npm version X.Y.Z --no-git-tag-version`. It updates `package.json` and
   `package-lock.json` and creates no tag.
5. **Changelog.** Create or append `docs/changelog-vX.Y.Z.md`.
   - Follow the latest changelog's layout: an intro paragraph per ticket, `---`, then a
     `## BB-xxx — title` section per ticket (Status, Why, server contract used, changes,
     Not changed, To test), with `## Open items` last.
   - State any required server version.
   - Show Carlo the changelog before committing.
6. **Commit.** Stage only the agreed files by path, never `git add -A`.
   - Message: `feat: vX.Y.Z - BB-xxx summary, BB-yyy summary`, plus the Co-Authored-By line from
     the system reminder.
   - Explain the command before it runs.
7. **Push — Carlo does it.** `git push` is hard-denied for Claude. Give Carlo the exact line and
   stop until he confirms it's pushed:
   `! git push -u origin release/vX.Y.Z`
8. **PR.**
   - Once he confirms the push, check `which gh` and `gh auth status`.
   - If gh is available: explain the command, then run
     `gh pr create --base master --head release/vX.Y.Z --title "vX.Y.Z – <tickets>" --body-file <scratchpad file>`.
     The body summarizes each ticket, the server dependency and "To test", and ends with the PR
     attribution line from the system reminder.
   - If gh is missing: write the body to the scratchpad and give Carlo the GitHub compare link
     (`https://github.com/BizSolutions-LLC/bizbuddy-v2-client-web/compare/master...release/vX.Y.Z`)
     to open it himself.
9. **Wrap up.** Summarize: version, branch, commit hash, files, PR link, and open items.
   - Update the relevant project memory.
   - Don't run, build, lint or test anything.
