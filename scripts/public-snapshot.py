#!/usr/bin/env python3
"""Export only reviewed buildable source, never Git history or runtime files."""
import argparse, gzip, hashlib, io, json, os, pathlib, re, subprocess, tarfile

def allowed(name, policy):
    path = pathlib.PurePosixPath(name)
    forbidden = {"node_modules", ".git", ".next", "dist", "output", "runtime", "backups", ".data", "__pycache__", "AGENTS.md", "CLAUDE.md"}
    if any(part in forbidden for part in path.parts): return False
    if path.name.startswith(".env") and path.name != ".env.example": return False
    if path.suffix.lower() in {".pem", ".key", ".p12", ".pfx", ".sqlite", ".db", ".pmtiles", ".log", ".tsbuildinfo"}: return False
    if any(name == excluded or name.startswith(excluded + "/") for excluded in policy["exclude"]): return False
    return name in policy["files"] or any(name.startswith(directory + "/") for directory in policy["directories"])

def snapshot(root, revision, output, from_git=False):
    policy = json.loads((root / "scripts/public-source-allowlist.json").read_text())
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}", revision): raise ValueError("Invalid revision")
    if from_git:
        if not re.fullmatch(r"[a-f0-9]{40}", revision): raise ValueError("Git export requires a full canonical SHA")
        names = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", revision], cwd=root, text=True).splitlines()
        read = lambda name: subprocess.check_output(["git", "show", f"{revision}:{name}"], cwd=root)
    else:
        names = []
        for directory in policy["directories"]:
            for parent, directories, children in os.walk(root / directory):
                directories[:] = [d for d in directories if d not in {"node_modules", ".git", ".next", "dist", "output", "runtime", ".data", "__pycache__"} and not pathlib.Path(parent, d).is_symlink()]
                for child in children:
                    path = pathlib.Path(parent, child)
                    if not path.is_symlink(): names.append(path.relative_to(root).as_posix())
        names += [name for name in policy["files"] if (root / name).is_file()]
        read = lambda name: (root / name).read_bytes()
    files = {name: read(name) for name in sorted(set(names)) if allowed(name, policy)}
    # Public package-manager configuration is explicit, never copied from a host's config.
    files[".npmrc"] = b"auto-install-peers=true\nstrict-peer-dependencies=false\n"
    files["SOURCE_REVISION"] = (revision + "\n").encode()
    required = ["LICENSE", "README.md", "package.json", "pnpm-lock.yaml", "deploy/Dockerfile", "deploy/selfhost/Caddyfile", "deploy/selfhost/basemap-job.sh", "packages/embed/LICENSE"]
    missing = [name for name in required if name not in files]
    if missing: raise ValueError("Missing public build dependencies: " + ", ".join(missing))
    # Reject recognizable credentials and private host references without displaying them.
    forbidden = re.compile(rb"-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|https?://git\.[a-z0-9.-]+|/(?:home|Users)/[a-zA-Z0-9_-]+/(?:private|projects|Desktop)|https?://(?!127\.0\.0\.1)(?:[0-9]{1,3}\.){3}[0-9]{1,3}")
    for name, content in files.items():
        if name == "scripts/public-snapshot.py": continue  # the deny expressions themselves
        if forbidden.search(content): raise ValueError("Public-source review required for " + name)
    manifest = {"format": 1, "canonicalRevision": revision, "files": {name: hashlib.sha256(content).hexdigest() for name, content in files.items()}}
    files["SOURCE_MANIFEST.json"] = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed, tarfile.open(fileobj=compressed, mode="w") as archive:
        for name, content in sorted(files.items()):
            entry = tarfile.TarInfo(f"true-canadian-maps-{revision}/{name}")
            entry.size = len(content); entry.mode = 0o755 if name.endswith(".sh") else 0o644
            archive.addfile(entry, io.BytesIO(content))
    print(f"Reviewed source export: {len(files)} files; sha256 {hashlib.sha256(output.read_bytes()).hexdigest()}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[1])
    parser.add_argument("--revision", required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--git", action="store_true")
    args = parser.parse_args()
    snapshot(args.root.resolve(), args.revision, args.output, args.git)
