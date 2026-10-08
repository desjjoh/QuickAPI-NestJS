import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1791491511806 implements MigrationInterface {
  name = 'Migration1791491511806';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`article_statuses\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`description\` text NULL, UNIQUE INDEX \`IDX_07e02ca7d56589e27c5edeb060\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`articles\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`hero_id\` varchar(16) NOT NULL, \`author_id\` varchar(16) NULL, \`status_id\` varchar(16) NOT NULL, \`publisher_id\` varchar(16) NULL, \`title\` varchar(255) NOT NULL, \`summary\` varchar(255) NOT NULL, \`body\` text NOT NULL, \`publishedAt\` datetime NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`articles\` ADD CONSTRAINT \`FK_2a0020f827c43db888aa2d4252d\` FOREIGN KEY (\`hero_id\`) REFERENCES \`images\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`articles\` ADD CONSTRAINT \`FK_6515da4dff8db423ce4eb841490\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`articles\` ADD CONSTRAINT \`FK_f2e59122c74687aa43ab8e59cc9\` FOREIGN KEY (\`status_id\`) REFERENCES \`article_statuses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`articles\` ADD CONSTRAINT \`FK_e806367428ff22eaaa06adc99ac\` FOREIGN KEY (\`publisher_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`articles\` DROP FOREIGN KEY \`FK_e806367428ff22eaaa06adc99ac\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`articles\` DROP FOREIGN KEY \`FK_f2e59122c74687aa43ab8e59cc9\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`articles\` DROP FOREIGN KEY \`FK_6515da4dff8db423ce4eb841490\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`articles\` DROP FOREIGN KEY \`FK_2a0020f827c43db888aa2d4252d\``,
    );
    await queryRunner.query(`DROP TABLE \`articles\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_07e02ca7d56589e27c5edeb060\` ON \`article_statuses\``,
    );
    await queryRunner.query(`DROP TABLE \`article_statuses\``);
  }
}
