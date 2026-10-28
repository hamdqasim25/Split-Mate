import { definePrismaConfig } from "@prisma/cli-engine";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";
import { testConfig } from "./tests/integration/config.mjs";

export default definePrismaConfig({
  orm: ormConfig({ contract: "./src/prisma/contract.prisma", db: { connection: testConfig().url } }),
});
