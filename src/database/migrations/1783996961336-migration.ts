import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1783996961336 implements MigrationInterface {
    name = 'Migration1783996961336'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_credentials\` DROP COLUMN \`referrer\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_credentials\` ADD \`referrer\` varchar(2048) NULL`);
    }

}
