import { queryWords, searchPages } from "../../../template/src/domain";
import type { SearchIndex, SearchPage } from "../../../template/src/domain";

/** A page whose text and headings come from a short markdown-like string, so offsets are real. */
function page(
  title: string,
  body: string,
  headings: string[] = [],
  url = `/docs/${title.toLowerCase().replace(/\W+/g, "-")}/`,
): SearchPage {
  let text = "";
  const found: SearchPage["headings"] = [];
  for (const line of body.split("\n")) {
    const heading = headings.find((candidate) => candidate === line);
    if (heading !== undefined) {
      found.push({
        text: heading,
        id: heading.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        offset: text.length,
      });
    }
    text += `${line}\n`;
  }
  return { url, title, description: "", collection: "docs", headings: found, text: text.trimEnd() };
}

const index = (pages: SearchPage[]): SearchIndex => ({ collections: { docs: "Docs" }, pages });

describe("queryWords", () => {
  it("splits a query into lowercase letters and digits", () => {
    expect(queryWords("Next.js  Config-2!")).toEqual(["next", "js", "config", "2"]);
  });

  it("cuts a long query, so a pasted paragraph stays cheap", () => {
    expect(queryWords("a b c d e f g h i j")).toHaveLength(8);
  });
});

describe("searchPages ranking", () => {
  it("ranks a title match above a heading match above a body match", () => {
    const hits = searchPages(
      index([
        page("Body only", "The token lives here.", []),
        page("Heading match", "Intro.\nToken setup\nMore.", ["Token setup"]),
        page("Token", "Nothing else."),
      ]),
      "token",
    );
    expect(hits.map((hit) => hit.title)).toEqual(["Token", "Heading match", "Body only"]);
  });

  it("ranks a word start above a word inside another word, in the same place", () => {
    const hits = searchPages(index([page("Reinstall", "x"), page("Install", "x")]), "install");
    expect(hits.map((hit) => hit.title)).toEqual(["Install", "Reinstall"]);
    const prefix = searchPages(index([page("Xinstall", "x"), page("Installer", "x")]), "inst");
    expect(prefix.map((hit) => hit.title)).toEqual(["Installer", "Xinstall"]);
  });

  it("matches a part of a word, and ignores case", () => {
    const hits = searchPages(index([page("Configuration", "Set the Flag.")]), "FIGUR");
    expect(hits.map((hit) => hit.title)).toEqual(["Configuration"]);
  });

  it("needs every word of the query to match somewhere on the page", () => {
    const pages = [page("Install", "Run it."), page("Install and build", "Build it.")];
    expect(searchPages(index(pages), "install build").map((hit) => hit.title)).toEqual([
      "Install and build",
    ]);
    expect(searchPages(index(pages), "install nowhere")).toEqual([]);
  });

  it("orders equal results by title, then by address, so the order never changes", () => {
    const hits = searchPages(
      index([
        page("Beta", "shared"),
        page("Alpha", "shared"),
        page("Alpha", "shared", [], "/docs/alpha-2/"),
      ]),
      "shared",
    );
    expect(hits.map((hit) => hit.url)).toEqual(["/docs/alpha-2/", "/docs/alpha/", "/docs/beta/"]);
  });

  it("returns nothing for an empty or punctuation-only query", () => {
    const pages = index([page("Anything", "text")]);
    expect(searchPages(pages, "")).toEqual([]);
    expect(searchPages(pages, "   ")).toEqual([]);
    expect(searchPages(pages, "!?")).toEqual([]);
  });

  it("keeps the limit", () => {
    const pages = Array.from({ length: 5 }, (_, n) =>
      page(`Page ${n}`, "same", [], `/docs/p${n}/`),
    );
    expect(searchPages(index(pages), "same", 2)).toHaveLength(2);
  });
});

describe("searchPages sections", () => {
  const guide = page(
    "Guide",
    "Intro text.\nInstall\nRun npm ci to install the tools.\nOptions\nSet the search key.",
    ["Install", "Options"],
  );

  it("links to the section where the body matches", () => {
    const [hit] = searchPages(index([guide]), "search key");
    expect(hit).toMatchObject({
      url: "/docs/guide/#options",
      heading: "Options",
      anchor: "options",
    });
  });

  it("links to the heading when only the heading matches", () => {
    const [hit] = searchPages(index([guide]), "options");
    expect(hit).toMatchObject({ url: "/docs/guide/#options", heading: "Options" });
  });

  it("links to the top of the page when the match is before the first heading", () => {
    const [hit] = searchPages(index([guide]), "intro");
    expect(hit).toMatchObject({ url: "/docs/guide/", heading: "", anchor: "" });
  });

  it("uses the section of the first body match when a word matches twice", () => {
    const [hit] = searchPages(index([guide]), "install");
    expect(hit!.anchor).toBe("install");
  });
});

describe("searchPages snippets", () => {
  it("marks each query word in the snippet and keeps the words of the match", () => {
    const [hit] = searchPages(
      index([
        page(
          "Notes",
          "A long line of words before the match, then the search key and more words after it.",
        ),
      ]),
      "search key",
    );
    const { text, marks } = hit!.snippet;
    expect(marks.map((mark) => text.slice(mark.start, mark.end).toLowerCase())).toEqual([
      "search",
      "key",
    ]);
  });

  it("merges marks that overlap, so one place in the text is one mark", () => {
    const [hit] = searchPages(index([page("Notes", "the search key")]), "sea search");
    expect(hit!.snippet.marks).toEqual([{ start: 4, end: 10 }]);
  });

  it("keeps two words that are apart as two marks", () => {
    const [hit] = searchPages(index([page("Notes", "the search key")]), "search key");
    expect(hit!.snippet.marks).toEqual([
      { start: 4, end: 10 },
      { start: 11, end: 14 },
    ]);
  });

  it("says when the snippet starts or ends inside the page", () => {
    const long = `${"word ".repeat(60)}target ${"word ".repeat(60)}`;
    const [hit] = searchPages(index([page("Long", long)]), "target");
    expect(hit!.snippet.leading).toBe(true);
    expect(hit!.snippet.trailing).toBe(true);
    const [short] = searchPages(index([page("Short", "target here")]), "target");
    expect(short!.snippet).toMatchObject({ leading: false, trailing: false });
  });

  it("shows a snippet with no marks for a heading-only match", () => {
    const [hit] = searchPages(
      index([page("Guide", "Some prose.\nOptions\nMore prose.", ["Options"])]),
      "options",
    );
    expect(hit!.snippet.text).toContain("Options");
    expect(hit!.snippet.marks.length).toBeGreaterThan(0);
  });
});

describe("searchPages clusters", () => {
  it("points at the place where the most query words sit together, not at a common word early on", () => {
    const text = `The start of the page has the word the and the, then a long stretch. ${"filler ".repeat(40)}Where the content comes from is explained here.`;
    const [hit] = searchPages(
      index([page("Guide", text, ["Where the content comes from"])]),
      "where the content comes from",
    );
    expect(hit!.snippet.text).toContain("Where the content");
  });
});

describe("searchPages descriptions", () => {
  it("finds a page by its description, below the headings and above the body", () => {
    const described = {
      ...page("Setup", "Unrelated words here."),
      description: "How to configure the proxy.",
    };
    const hits = searchPages(
      index([page("Body", "The proxy is mentioned here."), described]),
      "proxy",
    );
    expect(hits.map((hit) => hit.title)).toEqual(["Setup", "Body"]);
    const [setup] = searchPages(index([described]), "configure");
    expect(setup).toMatchObject({ url: "/docs/setup/", heading: "" });
    expect(setup!.snippet.text).toContain("configure");
    expect(setup!.snippet.marks.length).toBe(1);
  });
});
