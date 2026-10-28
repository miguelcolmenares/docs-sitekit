import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const files = [
  "action.yml",
  "template/_github/workflows/docs.yml",
  ...readdirSync(join(ROOT, ".github", "workflows")).map((name) => `.github/workflows/${name}`),
];

/** Every `uses:` of a file, with the comment that follows it on the same line. */
function usesOf(path: string): Array<{ ref: string; line: string }> {
  return read(path)
    .split("\n")
    .filter((line) => /^\s*-?\s*uses:\s/.test(line))
    .map((line) => ({
      ref: line
        .replace(/^\s*-?\s*uses:\s*/, "")
        .split(/\s+#/)[0]!
        .trim(),
      line,
    }));
}

// A reference to this project's own action in a generated workflow is a version tag, and tags are immutable.
const ownAction = /^miguelcolmenares\/docs-sitekit@v(__SITEKIT_VERSION__|\d+\.\d+\.\d+)$/;

describe("workflows and the action", () => {
  it.each(files)("%s pins every action to a commit, with the version in a comment", (path) => {
    const loose = usesOf(path).filter(({ ref, line }) => {
      if (ref.startsWith("./") || ownAction.test(ref)) return false;
      return !/@[0-9a-f]{40}$/.test(ref) || !/#\s*v\d/.test(line);
    });
    expect(loose.map((entry) => entry.ref)).toEqual([]);
  });

  it("the generated workflow uses this project's action at the version init writes", () => {
    const refs = usesOf("template/_github/workflows/docs.yml").map((entry) => entry.ref);
    expect(refs).toContain("miguelcolmenares/docs-sitekit@v__SITEKIT_VERSION__");
  });

  it("the generated workflow rebuilds on a release, and does not deploy from a pull request", () => {
    const workflow = read("template/_github/workflows/docs.yml");
    expect(workflow).toMatch(/release:\s*\n\s*types: \[published\]/);
    expect(workflow).toMatch(/deploy:[\s\S]*if: github\.event_name != 'pull_request'/);
  });

  it("no workflow uses configure-pages, which needs Pages enabled and a permission the build job does not have", () => {
    for (const path of files) expect(read(path)).not.toMatch(/configure-pages/);
  });

  it("the action declares its inputs with defaults, an output and a composite runtime", () => {
    const action = read("action.yml");
    for (const input of ["dir", "version", "node-version", "check", "upload"])
      expect(action).toMatch(new RegExp(`^  ${input}:`, "m"));
    expect(action).toMatch(/^outputs:\n\s+dist:/m);
    expect(action).toMatch(/using: "composite"/);
    expect(action).toMatch(/default: "site"/);
  });

  it("the action has what the Marketplace listing needs: a short description, a name and a branding icon", () => {
    const action = read("action.yml");
    const description = /^description: "(.+)"$/m.exec(action)?.[1];
    // The Marketplace rejects a description of 125 characters or more.
    expect(description).toBeDefined();
    expect(description!.length).toBeLessThan(125);
    expect(action).toMatch(/^name: ".+"$/m);
    expect(action).toMatch(/^branding:\n\s+icon: "[a-z-]+"\n\s+color: "[a-z]+"/m);
  });

  it("the action passes inputs to the shell through env, never by interpolating them into the script", () => {
    const scripts = read("action.yml")
      .split("\n")
      .filter((line) => /^\s+run:\s/.test(line));
    expect(scripts.filter((line) => /\$\{\{/.test(line))).toEqual([]);
  });

  it("a deploy job has the permissions it needs and the build job has none beyond reading", () => {
    const workflow = read("template/_github/workflows/docs.yml");
    expect(workflow).toMatch(/permissions:\n\s+contents: read/);
    expect(workflow).toMatch(/permissions:\n\s+pages: write\n\s+id-token: write/);
  });
});
