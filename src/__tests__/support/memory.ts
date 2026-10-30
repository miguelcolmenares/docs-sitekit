import { createHash } from "node:crypto";
import type {
  ComponentRegistry,
  Environment,
  FileSystem,
  RepositoryVisibility,
  TemplateFile,
  TemplateSource,
} from "../../application";

/** A file system held in a map, so use cases run without touching the disk. */
export class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initial)) this.files.set(path, content);
  }

  exists(path: string): boolean {
    return this.files.has(path) || this.isDirectory(path);
  }

  isDirectory(path: string): boolean {
    const prefix = `${path.replace(/\/$/, "")}/`;
    return [...this.files.keys()].some((file) => file.startsWith(prefix));
  }

  readText(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }

  writeText(path: string, content: string): void {
    this.files.set(path, content);
  }

  listFiles(directory: string): string[] {
    const prefix = `${directory.replace(/\/$/, "")}/`;
    return [...this.files.keys()]
      .filter((file) => file.startsWith(prefix))
      .map((file) => file.slice(prefix.length))
      .sort();
  }
}

export const sha = (content: string) => createHash("sha256").update(content).digest("hex");

export function fakeEnv(
  options: {
    remoteUrl?: string;
    visibility?: RepositoryVisibility;
    uncommittedChanges?: boolean;
  } = {},
): Environment {
  return {
    remoteUrl: () => options.remoteUrl,
    repositoryVisibility: () => options.visibility ?? "public",
    hasUncommittedChanges: () => options.uncommittedChanges,
  };
}

export const registry: ComponentRegistry = {
  components: {
    cn: { description: "helper", files: ["src/cn.ts"], requires: [] },
    button: { description: "button", files: ["src/button.tsx"], requires: ["cn"] },
    hero: { description: "hero", files: ["src/Hero.astro"], requires: ["button", "cn"] },
  },
};

export function fakeTemplate(
  overrides: { files?: TemplateFile[]; version?: string } = {},
): TemplateSource {
  const files = overrides.files ?? [
    {
      path: "package.json",
      content: JSON.stringify({
        name: "sitekit-site",
        private: true,
        dependencies: { clsx: "^2.0.0", "tailwind-merge": "^3.0.0" },
      }),
    },
    {
      path: "package-lock.json",
      content: JSON.stringify({ name: "sitekit-site", packages: { "": { name: "sitekit-site" } } }),
    },
    {
      path: "src/cn.ts",
      content:
        'import { clsx } from "clsx";\nimport { twMerge } from "tailwind-merge";\nexport const cn = (...a: unknown[]) => twMerge(clsx(a));\n',
    },
    {
      path: "src/button.tsx",
      content:
        'import { cn } from "@/infrastructure/cn";\nimport { Slot } from "radix-ui";\nexport const Button = () => null;\n',
    },
    {
      path: "src/Hero.astro",
      content: "---\nimport { Button } from './button';\n---\n<section />\n",
    },
  ];
  return {
    files: () => files,
    workflow: () => "run: npx sitekit@__SITEKIT_VERSION__ check\n",
    registry: () => registry,
    version: () => overrides.version ?? "0.1.0",
  };
}
