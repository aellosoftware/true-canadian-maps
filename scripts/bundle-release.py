#!/usr/bin/env python3
"""Create a complete, versioned installer from a reviewed public snapshot."""
import argparse, hashlib, io, pathlib, re, tarfile
parser=argparse.ArgumentParser()
parser.add_argument("version")
parser.add_argument("--output",type=pathlib.Path,default=pathlib.Path("release"))
args=parser.parse_args()
if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:[.-][a-zA-Z0-9.-]+)?", args.version): raise ValueError("Invalid release version")
root=pathlib.Path(__file__).resolve().parents[1]
args.output.mkdir(parents=True,exist_ok=True)
name=f"true-canadian-maps-{args.version}-linux-x64"
installer=["docker-compose.yml", ".env.example", "Caddyfile", "Caddyfile.multi", "install.sh", "basemap-job.sh", "backup.sh", "restore.sh"]
files={name:root/"deploy/selfhost"/name for name in installer}
files.update({name:root/name for name in ["LICENSE","LICENSING.md","THIRD_PARTY_NOTICES.md"]})
files.update({"SELF_HOSTING.md":root/"docs/SELF_HOSTING.md","UPGRADING.md":root/"docs/UPGRADING.md","ACCOUNT_RECOVERY.md":root/"docs/ACCOUNT_RECOVERY.md","SDK-MIT.txt":root/"packages/embed/LICENSE","browser-notices.txt":root/"apps/marketing/third-party-notices.txt"})
required={"docker-compose.yml",".env.example","Caddyfile","Caddyfile.multi","install.sh","basemap-job.sh","backup.sh","restore.sh"}
if not required.issubset(files): raise ValueError("Installer is incomplete")
archive=args.output/(name+".tar.gz")
with tarfile.open(archive,"w:gz") as tar:
    for relative,path in sorted(files.items()):
        content=path.read_bytes().replace(b"\r\n", b"\n")
        item=tarfile.TarInfo(name+"/"+relative)
        item.size=len(content)
        item.uid=item.gid=0; item.uname=item.gname=""; item.mode=0o755 if relative.endswith(".sh") else 0o644
        tar.addfile(item,io.BytesIO(content))
checksums=[]
for path in sorted(args.output.iterdir()):
    if path.is_file() and path.name!="SHA256SUMS": checksums.append(hashlib.sha256(path.read_bytes()).hexdigest()+"  "+path.name)
(args.output/"SHA256SUMS").write_text("\n".join(checksums)+"\n")
print(f"Packaged {len(files)} installer files")
