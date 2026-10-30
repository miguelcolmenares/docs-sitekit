import matter from "gray-matter";
import {
  buildVariables,
  expandFrontmatter,
  expandReusable,
  parseSiteConfig,
} from "../../../template/src/domain";
import type { ReusableIssue, ReusableOptions } from "../../../template/src/domain";

const SNIPPETS: Record<string, string> = {
  "install.md": "Run the installer for {{ package }}.\n\n```sh\nnpm install {{ package }}\n```\n",
  "two-lines.md": "First line.\n\nSecond line, for {{ package }}.\n",
  "nested.md": "Before.\n<!-- include: install.md -->\n",
  "unknown.md": "Line one.\nLine two uses {{ ghost }}.\n",
  "empty.md": "",
};

function setup(variables: Record<string, string> = { version: "1.2.3", package: "@demo/widget" }) {
  const issues: ReusableIssue[] = [];
  const options: ReusableOptions = {
    file: "docs/page.md",
    variables,
    readSnippet: (name) => SNIPPETS[name],
    onIssue: (issue) => issues.push(issue),
  };
  return { options, issues };
}

/** The text and the line map of a body, and the issues found while expanding it. */
const run = (content: string, variables?: Record<string, string>, lineOffset = 0) => {
  const { options, issues } = setup(variables);
  const expanded = expandReusable(content, { ...options, lineOffset });
  return { text: expanded.text, lines: expanded.lines, issues };
};

describe("variables", () => {
  it("are replaced in prose, headings and link text and addresses", () => {
    const { text } = run(
      [
        "# Widget {{ version }}",
        "",
        "Use version {{version}} of {{  package  }}.",
        "",
        "See [the {{ version }} notes](https://example.com/{{ version }}/notes).",
      ].join("\n"),
    );
    expect(text).toBe(
      [
        "# Widget 1.2.3",
        "",
        "Use version 1.2.3 of @demo/widget.",
        "",
        "See [the 1.2.3 notes](https://example.com/1.2.3/notes).",
      ].join("\n"),
    );
  });

  it("are left as written in code spans, of any length, and in fenced code", () => {
    const source = [
      "Write `{{ version }}` or ``a `{{ version }}` b`` in prose.",
      "",
      "```md",
      "Version {{ version }}",
      "```",
      "",
      "~~~",
      "{{ version }}",
      "~~~",
      "",
      "- item",
      "  ```",
      "  {{ version }}",
      "  ```",
    ].join("\n");
    const { text, issues } = run(source);
    expect(text).toBe(source);
    expect(issues).toEqual([]);
  });

  it("are replaced outside a code span on the same line, and after a fence closes", () => {
    const { text } = run("`{{ version }}` is {{ version }}.\n\n```\nx\n```\n\nThen {{ version }}.");
    expect(text).toBe("`{{ version }}` is 1.2.3.\n\n```\nx\n```\n\nThen 1.2.3.");
  });

  it("keep a longer fence open until a fence at least as long closes it", () => {
    const source = "````md\n```\n{{ version }}\n```\n{{ version }}\n````\n{{ version }}";
    expect(run(source).text).toBe("````md\n```\n{{ version }}\n```\n{{ version }}\n````\n1.2.3");
  });

  it("treat backticks without a closing run as plain text", () => {
    expect(run("A lone ` tick and {{ version }}.").text).toBe("A lone ` tick and 1.2.3.");
  });

  it("report an unknown variable with the file and line, and leave it as written", () => {
    const { text, issues } = run("One.\n\nTwo {{ ghost }} and {{ version }}.\n");
    expect(text).toBe("One.\n\nTwo {{ ghost }} and 1.2.3.\n");
    expect(issues).toEqual([
      expect.objectContaining({ kind: "variables", file: "docs/page.md", line: 3 }),
    ]);
    expect(issues[0]!.message).toMatch(/^Unknown variable "ghost"/);
  });

  it("count the lines of the file when the body starts after its frontmatter", () => {
    // Four lines of frontmatter come before the body, so the body's first line is line 5 of the file.
    const { issues } = run("Two {{ ghost }}.", undefined, 4);
    expect(issues).toEqual([expect.objectContaining({ file: "docs/page.md", line: 5 })]);
  });

  it("do not treat a name that is not declared as a variable, even one from Object.prototype", () => {
    const { text, issues } = run("{{ constructor }} {{ toString }}");
    expect(text).toBe("{{ constructor }} {{ toString }}");
    expect(issues).toHaveLength(2);
  });

  it("insert a value with a dollar sign literally", () => {
    expect(run("Price {{ cost }}.", { cost: "$& and $1" }).text).toBe("Price $& and $1.");
  });

  it("leave something that is not a variable alone", () => {
    const source = "{{ }} {{ 1abc }} {{a b}} { { version } }";
    const { text, issues } = run(source);
    expect(text).toBe(source);
    expect(issues).toEqual([]);
  });
});

describe("snippets", () => {
  it("replace an include comment that is alone on its line, with prose variables replaced inside and code left as written", () => {
    const { text } = run("Intro.\n\n<!-- include: install.md -->\n\nOutro.");
    expect(text).toBe(
      "Intro.\n\nRun the installer for @demo/widget.\n\n```sh\nnpm install {{ package }}\n```\n\nOutro.",
    );
  });

  it("keep the indentation of the include in front of every non-empty line, inside a list item", () => {
    const { text } = run("- Step one:\n  <!-- include: two-lines.md -->\n- Step two.");
    expect(text).toBe(
      "- Step one:\n  First line.\n\n  Second line, for @demo/widget.\n- Step two.",
    );
  });

  it("accept the comment with or without spaces", () => {
    expect(run("<!--include:empty.md-->").text).toBe("");
    expect(run("<!--   include:   two-lines.md   -->").text).toContain("First line.");
  });

  it("do not touch an include inside fenced code or a code span, or one with other text on its line", () => {
    const source = [
      "```md",
      "<!-- include: install.md -->",
      "```",
      "",
      "Write `<!-- include: install.md -->` to include it.",
      "",
      "Text <!-- include: install.md --> after.",
    ].join("\n");
    expect(run(source).text).toBe(source);
  });

  it("report a missing snippet with the file and line, and leave the include as written", () => {
    const { text, issues } = run("One.\nTwo.\n<!-- include: nope.md -->");
    expect(text).toBe("One.\nTwo.\n<!-- include: nope.md -->");
    expect(issues).toEqual([
      expect.objectContaining({ kind: "snippets", file: "docs/page.md", line: 3 }),
    ]);
    expect(issues[0]!.message).toMatch(/^Snippet "nope\.md" was not found/);
  });

  it("report an include inside a snippet, in the snippet and at its line", () => {
    const { issues } = run("<!-- include: nested.md -->");
    expect(issues).toEqual([
      expect.objectContaining({ kind: "snippets", file: "snippets/nested.md", line: 2 }),
    ]);
    expect(issues[0]!.message).toMatch(
      /^A snippet cannot include another snippet \("install\.md"\)/,
    );
  });

  it("report an unknown variable inside a snippet in the snippet, at its line, once per problem", () => {
    const { issues } = run("Page.\n<!-- include: unknown.md -->");
    expect(issues).toEqual([
      expect.objectContaining({ kind: "variables", file: "snippets/unknown.md", line: 2 }),
    ]);
  });

  it("map the lines after a snippet to the lines of the file, where the include is one line", () => {
    const { text, lines } = run("A\n<!-- include: two-lines.md -->\nB", undefined, 10);
    // The snippet has three lines, all from the include on line 12 of the file. `B` is line 13.
    expect(text.split("\n")).toHaveLength(lines.length);
    expect(lines.slice(-1)).toEqual([13]);
    expect(lines.slice(0, 1)).toEqual([11]);
    expect(lines.slice(1, 4)).toEqual([12, 12, 12]);
  });

  it("can be included more than once, and an empty snippet leaves nothing", () => {
    expect(run("<!-- include: empty.md -->\nA\n<!-- include: empty.md -->").text).toBe("A");
    const { text } = run("<!-- include: two-lines.md -->\n<!-- include: two-lines.md -->");
    expect(text.match(/First line\./g)).toHaveLength(2);
  });

  it("read a file with CRLF line endings", () => {
    expect(run("A {{ version }}\r\nB").text).toBe("A 1.2.3\nB");
  });
});

describe("a page that uses neither feature", () => {
  it("comes back as the very same text, even with CRLF and with a code fence", () => {
    const source = "# Title\r\n\r\nSome text.\r\n\r\n```ts\r\nconst a = { b: {} };\r\n```\r\n";
    const { options } = setup();
    expect(expandReusable(source, options).text).toBe(source);
  });

  it("never reads a snippet", () => {
    const { options } = setup();
    const readSnippet = jest.fn();
    expandReusable("# Plain\n\nNothing here.", { ...options, readSnippet });
    expect(readSnippet).not.toHaveBeenCalled();
  });
});

describe("expandFrontmatter", () => {
  const parse = (source: string) => {
    const parsed = matter(source);
    return { data: parsed.data, raw: parsed.matter };
  };

  it("replaces variables in string values, at any depth, and leaves other values alone", () => {
    const { options, issues } = setup();
    const { data, raw } = parse(
      "---\ntitle: Widget {{ version }}\ntags: ['a-{{ version }}']\norder: 3\n---\nBody",
    );
    expect(expandFrontmatter(data, raw, options)).toEqual({
      title: "Widget 1.2.3",
      tags: ["a-1.2.3"],
      order: 3,
    });
    expect(issues).toEqual([]);
  });

  it("names the line of an unknown variable in the file", () => {
    const { options, issues } = setup();
    const { data, raw } = parse("---\norder: 1\ndescription: About {{ ghost }}\n---\nBody");
    expandFrontmatter(data, raw, options);
    expect(issues).toEqual([
      expect.objectContaining({ kind: "variables", file: "docs/page.md", line: 3 }),
    ]);
  });

  it("returns the same object when there is nothing to replace", () => {
    const { options } = setup();
    const { data, raw } = parse("---\ntitle: Plain\n---\nBody");
    expect(expandFrontmatter(data, raw, options)).toBe(data);
  });
});

describe("buildVariables", () => {
  it("takes the version of the package, and lets vars win", () => {
    expect(buildVariables({}, "2.0.0")).toEqual({ version: "2.0.0" });
    expect(buildVariables({ version: "next" }, "2.0.0")).toEqual({ version: "next" });
  });

  it("has no version when there is none, so it is an unknown variable", () => {
    expect(buildVariables({ name: "x" }, undefined)).toEqual({ name: "x" });
  });
});

describe("the vars key of the config", () => {
  const valid = {
    site: { name: "Demo", description: "A demo", url: "https://me.github.io" },
    hero: { title: "Demo", lede: "Lede", primary: { label: "Start", href: "/docs/" } },
  };

  it("defaults to no variables, so a site without the key does not change", () => {
    expect(parseSiteConfig(valid).vars).toEqual({});
  });

  it("accepts string values", () => {
    expect(
      parseSiteConfig({ ...valid, vars: { package: "@demo/widget", "min-node": "22" } }).vars,
    ).toEqual({ package: "@demo/widget", "min-node": "22" });
  });

  it("rejects a value that is not a string, naming the key", () => {
    expect(() => parseSiteConfig({ ...valid, vars: { count: 3 } })).toThrow(/vars\.count/);
  });

  it("rejects a name that cannot be written as {{ name }}", () => {
    expect(() => parseSiteConfig({ ...valid, vars: { "two words": "x" } })).toThrow(/vars/);
  });
});
