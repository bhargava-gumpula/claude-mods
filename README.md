# claude-mods

Mods for Claude Code (terminal and the desktop Code tab).

| Mod | What it does |
| --- | --- |
| **usage-band** | A band above the prompt: 5h and 7d limits as bars with time to reset, session cost with a mood emoji, total session tokens, and a pacing hint |
| **chat-roster** | A side pane listing your other recently active Claude chats and what each was last asked (`/roster` opens it) |
| **cube** | `/cube`, `/cube 2`, `/cube 4`: random-state scrambles (the WCA method, via cubing.js) |
| **handoff** | `/handoff [focus]`: runs the project's checks, writes the dev log entry and HANDOFF.md update, commits (never pushes), and summarizes |
| **prompt-cleanup** | Fixes typos in what you type before Claude reads it (Haiku; skips commands, code and long pastes) |

```
 5h ████░░░ 52% (1h 30m)     7d ██░░░░░ 23% (3d 5h)     $1.23   💩     6.1M tokens     👌 on pace
```

Cost emoji: 💩 $0–$5 · 😒 >$5 · 🥱 >$10 · 😮‍💨 >$25 · 🫪 >$50 · 😛 >$100 · 🤑 >$500 · 🙀 >$1000.
Pacing: 🚀 spend freely (under an hour to reset, 70% or less used) · 🐢 slow down (15+ points ahead of the clock) · 👌 on pace · 🛑 nearly out (90%+).

Needs: `python3` (usage-band tokens, chat-roster), `node` and `npm` (cube installs cubing.js on first use).

## Install

In a Claude Code terminal session, one line per mod you want:

```
/plugin install usage-band --marketplace bhargava-gumpula/claude-mods
/plugin install chat-roster --marketplace bhargava-gumpula/claude-mods
/plugin install cube --marketplace bhargava-gumpula/claude-mods
/plugin install handoff --marketplace bhargava-gumpula/claude-mods
/plugin install prompt-cleanup --marketplace bhargava-gumpula/claude-mods
```

Answer `y` to add the marketplace, then pick the user scope.
