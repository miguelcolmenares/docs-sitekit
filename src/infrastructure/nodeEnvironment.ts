import { execFileSync } from "node:child_process";
import type { Environment, RepositoryVisibility } from "../application";
import { parseGitHubUrl } from "../domain";

/**
 * The environment for a child process, without the variables a git hook sets. Inside a hook,
 * GIT_DIR and GIT_INDEX_FILE would point `git` at the hook's repository instead of the folder asked about.
 */
function cleanEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
}

function run(command: string, args: string[], cwd?: string): string | undefined {
  try {
    return execFileSync(command, args, {
      cwd,
      env: cleanEnvironment(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
    }).trim();
  } catch {
    return undefined;
  }
}

/** The `Environment` backed by `git` and the GitHub CLI. Anything it cannot find is reported as unknown. */
export const nodeEnvironment: Environment = {
  remoteUrl: (directory) => run("git", ["remote", "get-url", "origin"], directory) || undefined,
  hasUncommittedChanges(directory) {
    const status = run("git", ["status", "--porcelain"], directory);
    // An empty answer is a clean tree. No answer at all means git failed or this is not a repository.
    return status === undefined ? undefined : status.length > 0;
  },
  repositoryVisibility(repositoryUrl): RepositoryVisibility {
    const repository = parseGitHubUrl(repositoryUrl);
    if (!repository) return "unknown";
    const answer = run("gh", [
      "repo",
      "view",
      `${repository.owner}/${repository.name}`,
      "--json",
      "visibility",
      "--jq",
      ".visibility",
    ]);
    const value = answer?.toLowerCase();
    return value === "public" || value === "private" || value === "internal" ? value : "unknown";
  },
};
