/** @type {import('jest').Config} */
const transform = {
  "^.+\\.(t|j)sx?$": [
    "@swc/jest",
    {
      jsc: {
        parser: { syntax: "typescript", tsx: true },
        transform: { react: { runtime: "automatic" } },
        target: "es2022",
      },
      module: { type: "commonjs" },
    },
  ],
};

// The template imports its own layers with `@/`, which is its `src/`. The CLI in `src/` uses relative imports, because a test
// loads both in one program, where two meanings of `@/` could not both hold.
const moduleNameMapper = { "^@/(.*)$": "<rootDir>/template/src/$1" };

module.exports = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      transform,
      moduleNameMapper,
      testMatch: [
        "<rootDir>/src/__tests__/*.test.ts",
        "<rootDir>/src/__tests__/*.test.tsx",
        "<rootDir>/src/__tests__/template/*.test.ts",
        "<rootDir>/src/__tests__/template/*.test.tsx",
      ],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      transform,
      moduleNameMapper,
      testMatch: [
        "<rootDir>/src/__tests__/integration/*.test.ts",
        "<rootDir>/src/__tests__/integration/*.test.tsx",
      ],
    },
  ],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/__tests__/**", "!src/**/index.ts"],
};
