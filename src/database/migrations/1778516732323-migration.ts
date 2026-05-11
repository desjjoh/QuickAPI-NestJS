import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1778516732323 implements MigrationInterface {
  name = 'Migration1778516732323';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`account_statuses\` (
        \`id\` varchar(16) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`key\` varchar(64) NOT NULL,
        \`label\` text NOT NULL,
        \`description\` text NULL,
        UNIQUE INDEX \`IDX_3d9c0d5337245d3d44f8079751\` (\`key\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`status_id\` varchar(16) NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`users\`
       ADD CONSTRAINT \`FK_9d295cb2f8df33c080e23acfb8f\`
       FOREIGN KEY (\`status_id\`)
       REFERENCES \`account_statuses\`(\`id\`)
       ON DELETE RESTRICT
       ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\`
       DROP FOREIGN KEY \`FK_9d295cb2f8df33c080e23acfb8f\``,
    );

    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`status_id\``);

    await queryRunner.query(`DROP TABLE \`account_statuses\``);
  }
}
