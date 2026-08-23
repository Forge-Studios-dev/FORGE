import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every migration from InitialSchema onward assumes uuid_generate_v4() is available,
 * but no migration ever created the uuid-ossp extension that provides it — it must have
 * been enabled out-of-band on existing (Neon) databases at some point outside migration
 * history. A genuinely fresh database (new environment, disaster recovery, local dev)
 * fails at InitialSchema with "function uuid_generate_v4() does not exist" without this.
 * Confirmed via a from-scratch `migration:run` against an empty local Postgres.
 */
export class EnableUuidOssp1714950000000 implements MigrationInterface {
  name = 'EnableUuidOssp1714950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(): Promise<void> {
    /* Intentionally no-op — dropping uuid-ossp would break every uuid_generate_v4() default. */
  }
}
