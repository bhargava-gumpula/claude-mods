Write the handoff for the work done in this session. Do it in this order and report actual results, never assumed ones.

1. **What changed.** Run `git status`, `git log --oneline` for this session's commits and `git diff --stat` against where the session started. List the files touched and what each change does.
2. **Project rules.** If the repository has `AGENTS.md`, `CLAUDE.md` or `docs/HANDOFF.md`, follow their handoff rules exactly. In SolveLab that means: stop any dev server first, run `npm run validate` and `npx playwright test --workers=1`, and record the real pass/fail counts. If a check fails, report it with its output; do not fix things that were not asked for.
3. **Dev log.** If `docs/DEVELOPMENT_LOG.md` exists, append the next numbered entry in the same style as the latest ones: what was done, decisions, commands and checks run with their results, failures and how they were resolved, what was not done. No secrets or machine-private data.
4. **Handoff doc.** If `docs/HANDOFF.md` exists, update only the sections this work changed (current state, branches, known limitations, waiting on the owner).
5. **Commit.** Commit the code and doc changes as phase-scoped commits with accurate messages. Never push, merge or deploy; ask first.
6. **Summary.** End with a short handoff in chat: what changed, verification results, open questions for the owner, and the proposed next step. Then stop and wait for approval.
