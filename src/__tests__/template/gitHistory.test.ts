import { readGitHistory } from "../../../template/src/infrastructure";
import type { GitRunner } from "../../../template/src/infrastructure";

/** A runner that answers from a table keyed by the git arguments, and fails (undefined) for the rest. */
const runner = (answers: Record<string, string>): { run: GitRunner; calls: string[][] } => {
  const calls: string[][] = [];
  return {
    calls,
    run: (_cwd, args) => {
      calls.push(args);
      return answers[args.join(" ")];
    },
  };
};

describe("readGitHistory", () => {
  it("reads the work tree, the shallow flag, the folder prefix and the date of one file", () => {
    const { run, calls } = runner({
      "rev-parse --is-inside-work-tree": "true",
      "rev-parse --is-shallow-repository": "false",
      "rev-parse --show-prefix": "packages/widget/",
      "log -1 --format=%aI -- docs/a.md": "2026-03-15T10:00:00+00:00",
    });
    const history = readGitHistory("/repo/packages/widget", run);
    expect(history).toMatchObject({ available: true, shallow: false, prefix: "packages/widget/" });
    expect(history.lastChange("docs/a.md")).toBe("2026-03-15T10:00:00+00:00");
    // The date is asked for the file: the path comes after --, so a name that starts with a dash is not an option.
    expect(calls[calls.length - 1]).toEqual(["log", "-1", "--format=%aI", "--", "docs/a.md"]);
  });

  it("reports a shallow clone", () => {
    const { run } = runner({
      "rev-parse --is-inside-work-tree": "true",
      "rev-parse --is-shallow-repository": "true",
      "rev-parse --show-prefix": "",
    });
    expect(readGitHistory("/repo", run)).toMatchObject({
      available: true,
      shallow: true,
      prefix: "",
    });
  });

  it("has no date for a file with no commits, and is not available outside git", () => {
    const inside = readGitHistory(
      "/repo",
      runner({
        "rev-parse --is-inside-work-tree": "true",
        "log -1 --format=%aI -- new.md": "",
      }).run,
    );
    expect(inside.lastChange("new.md")).toBeUndefined();

    const outside = readGitHistory("/nowhere", runner({}).run);
    expect(outside.available).toBe(false);
    expect(outside.lastChange("docs/a.md")).toBeUndefined();
  });
});
