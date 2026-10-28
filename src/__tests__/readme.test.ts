import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** The inputs of action.yml with their defaults, read from the file itself. */
function actionInputs(): Array<{ name: string; fallback: string }> {
  const block = read("action.yml")
    .split(/^inputs:\n/m)[1]!
    .split(/^outputs:/m)[0]!;
  const names = [...block.matchAll(/^ {2}([a-z-]+):\s*$/gm)].map((match) => match[1]!);
  return names.map((name) => {
    const body = block
      .split(new RegExp(`^ {2}${name}:\\s*$`, "m"))[1]!
      .split(/^ {2}[a-z-]+:\s*$/m)[0]!;
    return { name, fallback: /default:\s*"([^"]*)"/.exec(body)![1]! };
  });
}

// The same README is read on the repository and on the Marketplace page of the action, so it is part of the interface.
describe("the README documents the action", () => {
  const readme = read("README.md");
  const inputs = actionInputs();

  it("found the inputs in action.yml", () => {
    expect(inputs.map((input) => input.name)).toEqual([
      "dir",
      "version",
      "node-version",
      "check",
      "upload",
    ]);
  });

  it.each(inputs)("lists the input $name with its default $fallback", ({ name, fallback }) => {
    const row = readme.split("\n").find((line) => line.startsWith(`| \`${name}\``));
    expect(row).toBeDefined();
    expect(row).toContain(`\`${fallback}\``);
  });

  it("lists the output the action declares", () => {
    expect(read("action.yml")).toMatch(/^outputs:\n\s+dist:/m);
    expect(readme).toMatch(/\| `dist` \|/);
  });

  it("shows how to call it, rebuild on a release, and keep deploy in its own job", () => {
    expect(readme).toContain("uses: miguelcolmenares/docs-sitekit@v");
    expect(readme).toMatch(/release:\n\s+types: \[published\]/);
    expect(readme).toMatch(/pages: write\n\s+id-token: write/);
  });

  it("the example in the README is the one init generates, apart from the version", () => {
    const generated = read("template/_github/workflows/docs.yml");
    for (const needle of [
      "miguelcolmenares/docs-sitekit@v",
      "actions/deploy-pages",
      "types: [published]",
      "github-pages",
    ]) {
      expect(generated).toContain(needle);
      expect(readme).toContain(needle);
    }
  });
});
