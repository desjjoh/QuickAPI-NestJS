import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1782428350760 implements MigrationInterface {
    name = 'Migration1782428350760'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`account_tokens\` ADD \`mfa_code_hash\` varchar(128) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`last_sign_in\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`last_changed_email\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`last_changed_password\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`registration_tokens\` ADD \`mfa_code_hash\` varchar(128) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`registration_tokens\` DROP COLUMN \`mfa_code_hash\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`last_changed_password\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`last_changed_email\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`last_sign_in\``);
        await queryRunner.query(`ALTER TABLE \`account_tokens\` DROP COLUMN \`mfa_code_hash\``);
    }

}
