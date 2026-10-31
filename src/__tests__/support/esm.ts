import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Call a function of an ES module from the scripts folder and return what it gives back as JSON.
 * Jest here runs as CommonJS and the scripts are ES modules that read `import.meta`, so they run in a node process of their own.
 */
export function callModule<T>(file: string, name: string, ...args: unknown[]): T {
  const script = [
    `const module = await import(${JSON.stringify(pathToFileURL(file).href)});`,
    `const result = await module[${JSON.stringify(name)}](...JSON.parse(process.argv[1]));`,
    "process.stdout.write(JSON.stringify(result ?? null));",
  ].join("\n");
  const output = execFileSync("node", ["--input-type=module", "-e", script, JSON.stringify(args)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output) as T;
}
