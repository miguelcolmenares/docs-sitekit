import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

// This project documents itself with its own template, so the site's address must follow the repository.
// A project page lives at /<repository>/, and a base path from an old name loads the HTML but no styles.
describe("the site of this project", () => {
  const { site } = readJson("template/sitekit.config.json");
  const repository = /github\.com\/([^/]+)\/([^/.]+)/.exec(readJson("package.json").repository.url);

  it("is served under the name of the repository", () => {
    expect(repository).not.toBeNull();
    const [, owner, name] = repository!;
    expect(site.base).toBe(`/${name}/`);
    expect(site.url).toBe(`https://${owner}.github.io`);
    expect(site.repository).toBe(`https://github.com/${owner}/${name}`);
  });
});
