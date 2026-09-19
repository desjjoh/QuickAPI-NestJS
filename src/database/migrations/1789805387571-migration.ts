import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1789805387571 implements MigrationInterface {
    name = 'Migration1789805387571'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`last_changed_mfa\` datetime NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`last_changed_mfa\``);
    }

}
