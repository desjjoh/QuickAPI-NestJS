import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1791562242974 implements MigrationInterface {
    name = 'Migration1791562242974'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`email_intents\` (\`delivery_id\` varchar(36) NOT NULL, \`ciphertext\` longtext NULL, \`state\` varchar(16) NOT NULL, \`available_at\` datetime(3) NOT NULL, \`expires_at\` datetime(3) NOT NULL, \`created_at\` datetime(3) NOT NULL, \`delivered_at\` datetime(3) NULL, \`cancellation_scope\` char(64) NULL, INDEX \`IDX_email_intents_scope\` (\`cancellation_scope\`), INDEX \`IDX_email_intents_expiry\` (\`expires_at\`), INDEX \`IDX_email_intents_due\` (\`state\`, \`available_at\`), PRIMARY KEY (\`delivery_id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_email_intents_due\` ON \`email_intents\``);
        await queryRunner.query(`DROP INDEX \`IDX_email_intents_expiry\` ON \`email_intents\``);
        await queryRunner.query(`DROP INDEX \`IDX_email_intents_scope\` ON \`email_intents\``);
        await queryRunner.query(`DROP TABLE \`email_intents\``);
    }

}
