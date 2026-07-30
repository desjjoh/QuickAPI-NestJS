import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1785438584876 implements MigrationInterface {
    name = 'Migration1785438584876'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`activity_audits\` ADD \`operation_id\` varchar(128) NULL`);
        await queryRunner.query(`ALTER TABLE \`activity_audits\` ADD \`idempotency_id\` varchar(128) NULL`);
        await queryRunner.query(`CREATE INDEX \`IDX_activity_audits_operation_id\` ON \`activity_audits\` (\`operation_id\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activity_audits_idempotency_id\` ON \`activity_audits\` (\`idempotency_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_activity_audits_idempotency_id\` ON \`activity_audits\``);
        await queryRunner.query(`DROP INDEX \`IDX_activity_audits_operation_id\` ON \`activity_audits\``);
        await queryRunner.query(`ALTER TABLE \`activity_audits\` DROP COLUMN \`idempotency_id\``);
        await queryRunner.query(`ALTER TABLE \`activity_audits\` DROP COLUMN \`operation_id\``);
    }

}
