import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1782068883959 implements MigrationInterface {
    name = 'Migration1782068883959'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_phones\` DROP FOREIGN KEY \`FK_96bd55026671b792bb3ce699ffd\``);
        await queryRunner.query(`DROP INDEX \`REL_96bd55026671b792bb3ce699ff\` ON \`user_phones\``);
        await queryRunner.query(`ALTER TABLE \`user_phones\` CHANGE \`user_id\` \`profile_id\` varchar(16) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`user_profiles\` ADD \`bio\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`user_phones\` ADD UNIQUE INDEX \`IDX_08a1cb4b6b3d42f8d26d03cd79\` (\`profile_id\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`REL_08a1cb4b6b3d42f8d26d03cd79\` ON \`user_phones\` (\`profile_id\`)`);
        await queryRunner.query(`ALTER TABLE \`user_phones\` ADD CONSTRAINT \`FK_08a1cb4b6b3d42f8d26d03cd795\` FOREIGN KEY (\`profile_id\`) REFERENCES \`user_profiles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_phones\` DROP FOREIGN KEY \`FK_08a1cb4b6b3d42f8d26d03cd795\``);
        await queryRunner.query(`DROP INDEX \`REL_08a1cb4b6b3d42f8d26d03cd79\` ON \`user_phones\``);
        await queryRunner.query(`ALTER TABLE \`user_phones\` DROP INDEX \`IDX_08a1cb4b6b3d42f8d26d03cd79\``);
        await queryRunner.query(`ALTER TABLE \`user_profiles\` DROP COLUMN \`bio\``);
        await queryRunner.query(`ALTER TABLE \`user_phones\` CHANGE \`profile_id\` \`user_id\` varchar(16) NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`REL_96bd55026671b792bb3ce699ff\` ON \`user_phones\` (\`user_id\`)`);
        await queryRunner.query(`ALTER TABLE \`user_phones\` ADD CONSTRAINT \`FK_96bd55026671b792bb3ce699ffd\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
