// Serves dev/index.html on a separate origin with project/key substituted.
// usage: PROJECT=prj_… KEY=pk_… MAPS=http://localhost:8081 node dev/serve.mjs [port]
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const port = Number(process.argv[2] ?? 8082);
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8")
  .replaceAll("__PROJECT__", process.env.PROJECT ?? "")
  .replaceAll("__KEY__", process.env.KEY ?? "")
  .replaceAll("__MAPS__", process.env.MAPS ?? "http://localhost:8081");
createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(html); }).listen(port, () => console.log(`embed test page on http://localhost:${port}/`));
