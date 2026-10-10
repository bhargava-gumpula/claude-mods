# Prints the session's total tokens (input + output + cache read + cache write),
# summed over its transcript and its subagents' transcripts, one count per API message.
import glob, json, os, sys

sid = sys.argv[1]
base = os.path.expanduser('~/.claude/projects/*/')
files = glob.glob(base + sid + '.jsonl') + glob.glob(base + sid + '/**/*.jsonl', recursive=True)
seen, total = set(), 0
for path in files:
    with open(path, encoding='utf-8', errors='replace') as f:
        for raw in f:
            if '"usage"' not in raw:
                continue
            try:
                row = json.loads(raw)
            except ValueError:
                continue
            msg = row.get('message')
            u = msg.get('usage') if isinstance(msg, dict) else None
            if not isinstance(u, dict):
                continue
            key = (msg.get('id'), row.get('requestId'))
            if key[0] and key in seen:
                continue
            seen.add(key)
            total += sum(int(u.get(k) or 0) for k in
                         ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'))
print(total)
