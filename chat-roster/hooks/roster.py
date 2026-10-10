# Prints JSON: the person's other Claude chats active in the last N hours, newest first,
# each with its title, project folder, seconds since last activity and last prompt.
import glob, json, os, sys, time

me, hours = sys.argv[1], float(sys.argv[2])
now, chats = time.time(), []
for path in glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')):
    sid = os.path.basename(path)[:-6]
    age = now - os.path.getmtime(path)
    if sid == me or age > hours * 3600:
        continue
    title = prompt = cwd = ''
    with open(path, 'rb') as f:
        f.seek(max(0, os.path.getsize(path) - 256 * 1024))
        for raw in f.read().decode('utf-8', 'replace').splitlines():
            try:
                row = json.loads(raw)
            except ValueError:
                continue
            title = row.get('customTitle') or row.get('agentName') or title
            prompt = row.get('lastPrompt') or prompt
            cwd = row.get('cwd') or cwd
    if not (title or prompt):
        continue
    chats.append({'id': sid, 'title': title or prompt[:40], 'project': os.path.basename(cwd) or '?',
                  'agoSec': int(age), 'lastPrompt': ' '.join(prompt.split())[:120]})
chats.sort(key=lambda c: c['agoSec'])
print(json.dumps(chats[:30]))
