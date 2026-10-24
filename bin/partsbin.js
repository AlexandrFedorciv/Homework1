#!/usr/bin/env node
// Lets `npx partsbin` / `npm link` run the TypeScript sources directly via tsx.
import { register } from "tsx/esm/api";
register();
await import("../src/cli/index.ts");
