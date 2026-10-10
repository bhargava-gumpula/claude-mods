# Prints JSON for the org chart of the chat you are in: the sidebar group of the most
# recently focused Claude Code chat (desktop app), every chat in that group, which ones are
# working, and the subagents each is running now. The orchestrator is the group's chat whose
# title matches TOP; without one, the group itself is the top dot.
import glob, json, os, re, time

TOP = re.compile(r'orch|head of operations|\blead\b', re.I)
STALE = 1800  # a "running" transcript silent this long (a crashed turn) is treated as stopped
APP = os.path.expanduser('~/Library/Application Support/Claude')
now = time.time()

def last_turn_row(path, size):
    """The newest user or assistant row, parsing only lines that can be one (runs every second)."""
    with open(path, 'rb') as f:
        f.seek(max(0, os.path.getsize(path) - size))
        lines = f.read().decode('utf-8', 'replace').splitlines()
    for raw in reversed(lines):
        if '"type":"assistant"' in raw or '"type":"user"' in raw:
            try:
                return json.loads(raw)
            except ValueError:
                continue
    return None

def is_working(path, size=64 * 1024):
    """A turn is in progress until the newest reply has ended (or was interrupted)."""
    if not path or now - os.path.getmtime(path) > STALE:
        return False
    row = last_turn_row(path, size)
    if row is None:
        return False
    if row.get('type') == 'assistant':
        return (row.get('message') or {}).get('stop_reason') not in ('end_turn', 'stop_sequence', 'max_tokens', 'refusal')
    return 'Request interrupted' not in json.dumps(row.get('message', ''))[:4000]

def transcript(cli_id):
    found = glob.glob(os.path.expanduser(f'~/.claude/projects/*/{cli_id}.jsonl')) if cli_id else []
    return found[0] if found else None

DONE = re.compile(r'<task-id>([0-9a-f]+)</task-id>')

def finished_ids(path):
    """Subagent ids the parent chat got a completion notice for (completed, failed, killed or
    stopped). Read incrementally: only the bytes added since the last run are scanned."""
    entry = done_cache.get(path, {'offset': 0, 'ids': []})
    size = os.path.getsize(path)
    if size < entry['offset']:
        entry = {'offset': 0, 'ids': []}
    if size > entry['offset']:
        with open(path, 'rb') as f:
            f.seek(max(0, entry['offset'] - 64))  # overlap, so an id split across reads is kept
            found = DONE.findall(f.read().decode('utf-8', 'replace'))
        entry = {'offset': size, 'ids': sorted(set(entry['ids']) | set(found))}
    done_cache[path] = entry
    return set(entry['ids'])

def running_agents(path):
    """Subagents still working: no completion notice in the parent, and their own transcript
    shows an unfinished turn."""
    out = []
    agents = sorted(glob.glob(os.path.join(path[:-6], 'subagents', 'agent-*.jsonl'))) if path else []
    recent = [a for a in agents if now - os.path.getmtime(a) <= STALE]
    if not recent:
        return out
    done = finished_ids(path)
    for a in recent:
        agent_id = os.path.basename(a)[len('agent-'):-6]
        if agent_id in done or not is_working(a, 32 * 1024):
            continue
        try:
            desc = json.load(open(a[:-6] + '.meta.json')).get('description', '')
        except (OSError, ValueError):
            desc = ''
        out.append({'key': 'agent:' + agent_id, 'title': desc or 'Subagent', 'working': True})
    return out

SEND = re.compile(r'"name":"SendMessage","input":\{"to":"([^"]+)"')
SEND_CHAT = re.compile(r'"name":"mcp__ccd_session_mgmt__send_message","input":\{"session_id":"(local_[0-9a-f-]+)"')
FROM_AGENT = re.compile(r'"origin":\{"kind":"peer","from":"([0-9a-f]{12,})"')
SPAWN = re.compile(r'"name":"(?:Agent|Task)","input":\{')

def recipient(to):
    """The node a SendMessage `to` names: a subagent id, a chat's session id, or a chat's
    name as ListAgents lists it (its title)."""
    if re.fullmatch(r'[0-9a-f]{12,}', to):
        return 'agent:' + to
    if to.startswith('local_'):
        return 'chat:' + to
    return titles.get(to.strip().lower())

def new_events(path, key):
    """Messages written to this chat's transcript since the last run, as (from, to) keys:
    what it sent to its subagents or to other chats, and its subagents' hand-backs and
    completion notices. The first look at a transcript only records where it ends."""
    size = os.path.getsize(path)
    seen = event_offsets.get(path)
    event_offsets[path] = size
    if seen is None or size <= seen:
        return []
    with open(path, 'rb') as f:
        f.seek(seen)
        text = f.read().decode('utf-8', 'replace')
    events = [(key, k) for k in map(recipient, SEND.findall(text)) if k and k != key]
    events += [(key, 'chat:' + c) for c in SEND_CHAT.findall(text)]
    events += [(key, 'spawn') for _ in SPAWN.findall(text)]
    events += [('agent:' + a, key) for a in FROM_AGENT.findall(text)]
    events += [('agent:' + a, key) for a in DONE.findall(text)]
    return list(dict.fromkeys(events))  # one flash per pair, however many rows repeat it

# The app's per-chat files are large; keep the few fields used, re-read only when a file changes.
CACHE = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'claude-orgchart-cache.json')
KEEP = ('sessionId', 'cliSessionId', 'title', 'isArchived', 'lastFocusedAt', 'createdAt')
try:
    stored_text = open(CACHE).read()
    stored = json.loads(stored_text)
except (OSError, ValueError):
    stored_text, stored = '', {}
cache, done_cache, event_offsets = stored.get('sessions', {}), stored.get('done', {}), stored.get('events', {})
fresh, sessions = {}, []
for f in glob.glob(os.path.join(APP, 'claude-code-sessions', '*', '*', 'local_*.json')):
    mtime = os.path.getmtime(f)
    hit = cache.get(f)
    if hit and hit[0] == mtime:
        s = hit[1]
    else:
        try:
            full = json.load(open(f))
        except (OSError, ValueError):
            continue
        s = {k: full.get(k) for k in KEEP}
    fresh[f] = [mtime, s]
    if not s.get('isArchived'):  # only the chats in the sidebar now
        sessions.append(s)

assignments, names = {}, {}
try:
    prefs = json.load(open(os.path.join(APP, 'claude_desktop_config.json')))['preferences']['epitaxyPrefs']
    for scope in prefs.get('dframe-group-scopes', {}).values():
        assignments.update(scope.get('assignments', {}))
        names.update({g['id']: g['name'] for g in scope.get('groups', [])})
except (OSError, ValueError, KeyError):
    pass

current = max(sessions, key=lambda s: s.get('lastFocusedAt') or 0, default=None)
group = assignments.get('code:' + current['sessionId']) if current else None
members = [s for s in sessions if group and assignments.get('code:' + s['sessionId']) == group] or ([current] if current else [])
members.sort(key=lambda s: s.get('createdAt') or 0)

events = []
titles = {(s.get('title') or '').strip().lower(): 'chat:' + s['sessionId'] for s in members}

def node(s):
    path = transcript(s.get('cliSessionId'))
    key = 'chat:' + s['sessionId']
    if path:
        events.extend(new_events(path, key))
    return {'key': key, 'title': s.get('title') or 'Untitled chat', 'working': is_working(path), 'agents': running_agents(path),
            'current': s is current}

top_s = next((s for s in members if TOP.search(s.get('title') or '')), None)
top = node(top_s) if top_s else {'key': 'group', 'title': names.get(group, 'Chats'), 'working': False, 'agents': [], 'current': False}
chats = [node(s) for s in members if s is not top_s]
# Demo: `touch $TMPDIR/claude-orgchart-demo` plays one round of messages, the orchestrator
# to every chat and every chat back.
DEMO = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'claude-orgchart-demo')
if os.path.exists(DEMO):
    os.remove(DEMO)
    events += [(top['key'], c['key']) for c in chats] + [(c['key'], top['key']) for c in chats]
# Compared as text: the caches above were updated in place, so `stored` changed with them.
new = json.dumps({'sessions': fresh, 'done': done_cache, 'events': event_offsets})
if new != stored_text:
    tmp = CACHE + '.tmp'
    open(tmp, 'w').write(new)
    os.replace(tmp, CACHE)
print(json.dumps({'group': names.get(group), 'top': top, 'chats': chats, 'events': [{'from': a, 'to': b} for a, b in dict.fromkeys(events)]}))
