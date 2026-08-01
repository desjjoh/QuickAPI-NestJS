import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1785552197050 implements MigrationInterface {
    name = 'Migration1785552197050'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_activity_audits_outcome\` ON \`activity_audits\` (\`outcome\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activity_audits_event\` ON \`activity_audits\` (\`event\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activity_audits_domain\` ON \`activity_audits\` (\`domain\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_activity_audits_domain\` ON \`activity_audits\``);
        await queryRunner.query(`DROP INDEX \`IDX_activity_audits_event\` ON \`activity_audits\``);
        await queryRunner.query(`DROP INDEX \`IDX_activity_audits_outcome\` ON \`activity_audits\``);
    }

}
