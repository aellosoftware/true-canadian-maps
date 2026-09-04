import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Existing async loading effects intentionally populate client state after mount.
      // Keep them visible without blocking the lint gate while they are migrated.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "public/vendor/**", "next-env.d.ts"]),
]);
