import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^server-only$": "<rootDir>/test/server-only-stub.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
