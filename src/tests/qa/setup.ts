import { beforeAll } from "vitest";

import { requireLocalQaEnv } from "./helpers";

beforeAll(() => {
  requireLocalQaEnv();
});
