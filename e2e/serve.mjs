#!/usr/bin/env node
// A static server that behaves like GitHub Pages, for the end-to-end tests:
// the site lives under a base path, a folder serves its index.html, a path without a trailing
// slash redirects to the one with it, and a missing file answers 404 with 404.html.
// With --compress a text file is sent gzipped, as GitHub Pages does, so a size measured here is the
// size a visitor downloads. It is off by default: the browser tests do not need it.
//
//   node e2e/serve.mjs --dist <folder> --base /repo/ --port 4401 [--compress]
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    dist: { type: "string" },
    base: { type: "string", default: "/" },
    port: { type: "string", default: "4401" },
    compress: { type: "boolean", default: false },
  },
});
if (!values.dist) throw new Error("--dist is required");

const DIST = resolve(values.dist);
const BASE = values.base;
const COMPRESSED = new Set([".html", ".css", ".js", ".mjs", ".json", ".xml", ".svg", ".txt"]);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

function notFound(response) {
  const page = join(DIST, "404.html");
  response.writeHead(404, { "Content-Type": TYPES[".html"] });
  response.end(existsSync(page) ? readFileSync(page) : "Not found");
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith(BASE)) return notFound(response);

  const relative = normalize(pathname.slice(BASE.length)).replace(/^(\.\.[/\\])+/, "");
  let file = join(DIST, relative);
  if (!file.startsWith(DIST)) return notFound(response);

  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith("/")) {
      response.writeHead(301, { Location: `${pathname}/${url.search}` });
      return response.end();
    }
    file = join(file, "index.html");
  }
  if (!existsSync(file)) return notFound(response);

  const type = TYPES[extname(file)] ?? "application/octet-stream";
  const body = readFileSync(file);
  const gzip =
    values.compress &&
    COMPRESSED.has(extname(file)) &&
    String(request.headers["accept-encoding"] ?? "").includes("gzip");
  if (gzip) {
    response.writeHead(200, {
      "Content-Type": type,
      "Content-Encoding": "gzip",
      Vary: "Accept-Encoding",
    });
    return response.end(gzipSync(body));
  }
  response.writeHead(200, { "Content-Type": type });
  response.end(body);
}).listen(Number(values.port), "127.0.0.1", () =>
  console.log(`Serving ${DIST} at http://127.0.0.1:${values.port}${BASE}`),
);
