import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1782349456928 implements MigrationInterface {
    name = 'Migration1782349456928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`registration_tokens\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`email\` varchar(254) NOT NULL, \`token_hash\` varchar(128) NOT NULL, \`expires_at\` datetime NOT NULL, \`consumed_at\` datetime NULL, \`metadata\` json NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`registration_tokens\``);
    }

}
