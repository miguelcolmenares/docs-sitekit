/** Everything the use cases need from the outside world. Adapters live in infrastructure. */
export interface FileSystem {
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  readText(path: string): string;
  writeText(path: string, content: string): void;
  /** Every file under a directory, as paths relative to it, with forward slashes. */
  listFiles(directory: string): string[];
}

/** Whether a repository is public, private, internal, or could not be determined. */
export type RepositoryVisibility = "public" | "private" | "internal" | "unknown";

/** What the use cases ask of the machine they run on: the git remote, the working tree and the repository visibility. */
export interface Environment {
  /** `git remote get-url origin`, or undefined. */
  remoteUrl(directory: string): string | undefined;
  /** Ask the host whether a repository is private. */
  repositoryVisibility(repositoryUrl: string): RepositoryVisibility;
  /**
   * Whether the working tree of the repository has changes that are not committed, new files
   * included. Undefined when it cannot be told, for example when the folder is not a git repository.
   */
  hasUncommittedChanges(directory: string): boolean | undefined;
  /**
   * The branch the repository is developed on: the one `origin` points its HEAD at, else the branch
   * that is checked out. Undefined when git cannot tell.
   */
  defaultBranch(directory: string): string | undefined;
  /** Whether the clone is shallow (its history was cut). Undefined when it cannot be told, for example outside git. */
  isShallowClone(directory: string): boolean | undefined;
}

/** One file of the template, with its path inside the template and its text. */
export interface TemplateFile {
  /** Path inside the template, with forward slashes. */
  path: string;
  content: string;
}

/** The files the package ships for a new site. */
export interface TemplateSource {
  files(): TemplateFile[];
  /** The deploy workflow, with the version placeholder still in it. */
  workflow(): string;
  /** The component registry. */
  registry(): ComponentRegistry;
  /** Version of this package, pinned in the generated workflow. */
  version(): string;
}

/** A registry entry: what the component is, the files it owns and the components it needs. */
export interface ComponentEntry {
  description: string;
  files: string[];
  requires: string[];
  /**
   * The folder, relative to the template, of the examples that the documentation of this project shows for the
   * component. Only the documentation of the kit reads it: `add` ignores it, and the folder is not in the package.
   */
  example?: string;
}

/** Every component the template offers, by name. */
export interface ComponentRegistry {
  components: Record<string, ComponentEntry>;
}
