# Prints JSON {"days": [...]}: the local dates (YYYY-MM-DD) on which any Claude Code
# transcript was started or written, read from file times, so no transcript is opened.
import datetime, glob, json, os

days = set()
for path in glob.glob(os.path.expanduser('~/.claude/projects/**/*.jsonl'), recursive=True):
    st = os.stat(path)
    for t in (getattr(st, 'st_birthtime', st.st_mtime), st.st_mtime):
        days.add(datetime.date.fromtimestamp(t).isoformat())
print(json.dumps({'days': sorted(days)}))
