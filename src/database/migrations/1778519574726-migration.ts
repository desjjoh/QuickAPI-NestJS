import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1778519574726 implements MigrationInterface {
  name = 'Migration1778519574726';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_caed45fe7b9ee802ffa015c300f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`credentials_id\` \`credentials_id\` varchar(16) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_caed45fe7b9ee802ffa015c300f\` FOREIGN KEY (\`credentials_id\`) REFERENCES \`user_credentials\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_caed45fe7b9ee802ffa015c300f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`credentials_id\` \`credentials_id\` varchar(16) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_caed45fe7b9ee802ffa015c300f\` FOREIGN KEY (\`credentials_id\`) REFERENCES \`user_credentials\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\` (\`email\`)`,
    );
  }
}
