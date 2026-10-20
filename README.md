# claude-mods

Mods for Claude Code (terminal and the desktop Code tab).

| Mod | What it does |
| --- | --- |
| **usage-band** | A band above the prompt: 5h and 7d limits as bars with time to reset, session cost with a mood emoji, total session tokens, and a pacing hint |
| **chat-roster** | A floating org-chart window for the sidebar group of the chat you're in: the orchestrator on top, the group's chats below, running subagents under their chat. Filled = working, hover a dot for its title, a flash runs along the lines when messages pass. Shown only while Claude is in front; opens when a chat starts |
| **cube** | `/cube`, `/cube 2`, `/cube 4`: random-state scrambles (the WCA method, via cubing.js) |
| **handoff** | `/handoff [focus]`: runs the project's checks, writes the dev log entry and HANDOFF.md update, commits (never pushes), and summarizes |
| **streak** | Your streak of days in a row using Claude Code in the status line (`streak 🔥 3 days`); `/streak` adds your longest streak and total days |
| **elevenlabs-call** | A 📞 Call Claude Code button above the prompt (and `/call`): starts the [claude-voice](~/Projects/claude-voice) bridge if it is down and opens the ElevenLabs voice call with Claude Code |
| **prompt-cleanup** | Fixes typos in what you type before Claude reads it (Haiku; skips commands, code and long pastes) |

```
 5h ████░░░ 52% (1h 30m)     7d ██░░░░░ 23% (3d 5h)     $1.23   💩     6.1M tokens     👌 on pace
```

Cost emoji: 💩 $0–$5 · 😒 >$5 · 🥱 >$10 · 😮‍💨 >$25 · 🫪 >$50 · 😛 >$100 · 🤑 >$500 · 🙀 >$1000.
Pacing: 🚀 spend freely (under an hour to reset, 70% or less used) · 🐢 slow down (15+ points ahead of the clock) · 👌 on pace · 🛑 nearly out (90%+).

Needs: `python3` (usage-band tokens, chat-roster, streak), Xcode command line tools for `swiftc` (chat-roster builds its window on first use, macOS only), `node` and `npm` (cube installs cubing.js on first use).

## Install

In a Claude Code terminal session, one line per mod you want:

```
/plugin install usage-band --marketplace bhargava-gumpula/claude-mods
/plugin install chat-roster --marketplace bhargava-gumpula/claude-mods
/plugin install cube --marketplace bhargava-gumpula/claude-mods
/plugin install handoff --marketplace bhargava-gumpula/claude-mods
/plugin install prompt-cleanup --marketplace bhargava-gumpula/claude-mods
/plugin install streak --marketplace bhargava-gumpula/claude-mods
/plugin install elevenlabs-call --marketplace bhargava-gumpula/claude-mods
```

Answer `y` to add the marketplace, then pick the user scope.
