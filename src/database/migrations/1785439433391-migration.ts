import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1785439433391 implements MigrationInterface {
  name = 'Migration1785439433391';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`country_regions\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`code\` varchar(16) NOT NULL, \`label\` text NOT NULL, \`country_id\` varchar(16) NOT NULL, UNIQUE INDEX \`IDX_8ef62f21aefd2db74ed5860ef1\` (\`country_id\`, \`code\`), UNIQUE INDEX \`IDX_b856bc22c6ec07eda24fb99927\` (\`country_id\`, \`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`countries\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`iso2\` char(2) NOT NULL, \`iso3\` char(3) NOT NULL, \`flag_url\` varchar(255) NOT NULL, \`calling_code\` varchar(8) NOT NULL, \`phone_national_placeholder\` varchar(32) NOT NULL, \`phone_national_pattern\` varchar(128) NOT NULL, \`phone_format_groups\` text NOT NULL, \`postal_code_placeholder\` varchar(32) NOT NULL, \`postal_code_pattern\` varchar(128) NOT NULL, \`postal_code_format_groups\` text NOT NULL, \`postal_code_format_separator\` varchar(8) NOT NULL, UNIQUE INDEX \`IDX_a318337c8cc3824514d3dfe2a6\` (\`key\`), UNIQUE INDEX \`IDX_9706e3c52695ce44a202f24c26\` (\`iso2\`), UNIQUE INDEX \`IDX_b29f9172f8b660e7834000c424\` (\`iso3\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`genders\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, UNIQUE INDEX \`IDX_39523689c025976b5c89521ab0\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`profile_addresses\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`address_line_1\` text NOT NULL, \`address_line_2\` text NULL, \`city\` text NOT NULL, \`postal_code\` text NOT NULL, \`region_id\` varchar(16) NOT NULL, \`country_id\` varchar(16) NOT NULL, \`profile_id\` varchar(16) NOT NULL, UNIQUE INDEX \`REL_56b42e153434fec87f1a7b2730\` (\`profile_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`images\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`storage_key\` varchar(255) NOT NULL, \`filename\` varchar(255) NOT NULL, \`mime_type\` varchar(128) NOT NULL, \`size_bytes\` int NOT NULL, \`width\` int NOT NULL, \`height\` int NOT NULL, \`alt_text\` varchar(255) NULL, INDEX \`IDX_2425fcf752ffcac4e4e8f90ccf\` (\`storage_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_phones\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`phone_calling_code\` varchar(8) NOT NULL, \`phone_national_number\` varchar(20) NOT NULL, \`phone_e164\` varchar(20) NOT NULL, \`phone_country_id\` varchar(16) NOT NULL, \`profile_id\` varchar(16) NOT NULL, INDEX \`IDX_b56470c89ee26f6d89f30e4e49\` (\`phone_country_id\`), INDEX \`IDX_0990202281d58188c350423042\` (\`phone_e164\`), UNIQUE INDEX \`REL_08a1cb4b6b3d42f8d26d03cd79\` (\`profile_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`timezones\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`long_name\` varchar(64) NOT NULL, \`region\` varchar(32) NOT NULL, \`exemplar_city\` varchar(64) NOT NULL, UNIQUE INDEX \`IDX_df44a14981c12b9b7aa3a799c9\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_profiles\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`gender_id\` varchar(16) NOT NULL, \`country_id\` varchar(16) NOT NULL, \`timezone_id\` varchar(16) NOT NULL, \`avatar_id\` varchar(16) NULL, \`first\` text NOT NULL, \`last\` text NOT NULL, \`preferred\` text NULL, \`bio\` varchar(255) NULL, \`dob\` date NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_sessions\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`refresh\` text NULL, \`token_version\` int NOT NULL DEFAULT '0', \`active\` tinyint NOT NULL DEFAULT 1, \`browser\` varchar(255) NULL, \`browser_version\` varchar(64) NULL, \`device\` varchar(255) NULL, \`os\` varchar(255) NULL, \`os_version\` varchar(64) NULL, \`ip_address\` varchar(45) NULL, \`user_agent\` text NULL, \`origin\` varchar(2048) NULL, \`userId\` varchar(16) NOT NULL, \`country_code\` varchar(2) NULL, \`country_name\` varchar(255) NULL, \`region_code\` varchar(16) NULL, \`region_name\` varchar(255) NULL, \`city\` varchar(255) NULL, \`source\` varchar(16) NULL, \`resolved_at\` datetime NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`account_statuses\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`description\` text NULL, UNIQUE INDEX \`IDX_3d9c0d5337245d3d44f8079751\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`account_tokens\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`type\` enum ('email_verification', 'password_reset', 'email_change', 'email_mfa') NOT NULL, \`token_hash\` varchar(128) NOT NULL, \`expires_at\` datetime NOT NULL, \`consumed_at\` datetime NULL, \`mfa_code_hash\` varchar(128) NULL, \`failed_attempts\` int UNSIGNED NOT NULL DEFAULT '0', \`locked_at\` datetime NULL, \`metadata\` json NULL, \`user_id\` varchar(16) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_mfa_settings\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`enabled\` tinyint NOT NULL DEFAULT 0, \`primary_method\` enum ('email_otp') NOT NULL DEFAULT 'email_otp', \`enabled_at\` datetime NULL, \`disabled_at\` datetime NULL, \`last_verified_at\` datetime NULL, \`user_id\` varchar(16) NOT NULL, UNIQUE INDEX \`REL_15e9b906c2a4b7bf3870a1b499\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`profile_id\` varchar(16) NOT NULL, \`status_id\` varchar(16) NOT NULL, \`email\` varchar(254) NOT NULL, \`password\` text NULL, \`last_sign_in\` datetime NULL, \`last_changed_email\` datetime NULL, \`last_changed_password\` datetime NULL, \`last_updated_at\` datetime NULL, \`mfa_enabled\` tinyint NOT NULL DEFAULT 0, UNIQUE INDEX \`REL_23371445bd80cb3e413089551b\` (\`profile_id\`), UNIQUE INDEX \`UQ_97672ac88f789774dd47f7c8be3\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`roles\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`description\` text NULL, UNIQUE INDEX \`IDX_a87cf0659c3ac379b339acf36a\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`permissions\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`description\` text NULL, UNIQUE INDEX \`IDX_017943867ed5ceef9c03edd974\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`registration_tokens\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`email\` varchar(254) NOT NULL, \`token_hash\` varchar(128) NOT NULL, \`expires_at\` datetime NOT NULL, \`consumed_at\` datetime NULL, \`mfa_code_hash\` varchar(128) NULL, \`failed_attempts\` int UNSIGNED NOT NULL DEFAULT '0', \`locked_at\` datetime NULL, \`metadata\` json NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`activity_audits\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`event\` varchar(128) NOT NULL, \`outcome\` varchar(32) NOT NULL, \`actor_type\` varchar(32) NOT NULL, \`actor_id\` varchar(255) NULL, \`subject_type\` varchar(64) NULL, \`subject_id\` varchar(255) NULL, \`resource_type\` varchar(64) NULL, \`resource_id\` varchar(255) NULL, \`operation_id\` varchar(128) NULL, \`idempotency_id\` varchar(128) NULL, \`domain\` varchar(64) NOT NULL, \`request_id\` varchar(64) NULL, \`session_id\` varchar(16) NULL, \`ip_address\` varchar(45) NULL, \`user_agent\` varchar(512) NULL, \`http_method\` varchar(16) NULL, \`route\` varchar(512) NULL, \`failure_reason\` varchar(512) NULL, \`failure_code\` varchar(64) NULL, \`source\` varchar(32) NOT NULL, \`occurred_at\` datetime(6) NOT NULL, \`before\` json NULL, \`after\` json NULL, \`changes\` json NULL, \`metadata\` json NULL, INDEX \`IDX_activity_audits_operation_id\` (\`operation_id\`), INDEX \`IDX_activity_audits_idempotency_id\` (\`idempotency_id\`), INDEX \`IDX_activity_audits_request_id\` (\`request_id\`), INDEX \`IDX_activity_audits_session_id\` (\`session_id\`), INDEX \`IDX_activity_audits_occurred_at\` (\`occurred_at\`), INDEX \`IDX_activity_audits_domain_event_time\` (\`domain\`, \`event\`, \`occurred_at\`), INDEX \`IDX_activity_audits_resource_time\` (\`resource_type\`, \`resource_id\`, \`occurred_at\`), INDEX \`IDX_activity_audits_subject_time\` (\`subject_type\`, \`subject_id\`, \`occurred_at\`), INDEX \`IDX_activity_audits_actor_time\` (\`actor_type\`, \`actor_id\`, \`occurred_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_roles\` (\`user_id\` varchar(16) NOT NULL, \`role_id\` varchar(16) NOT NULL, INDEX \`IDX_87b8888186ca9769c960e92687\` (\`user_id\`), INDEX \`IDX_b23c65e50a758245a33ee35fda\` (\`role_id\`), PRIMARY KEY (\`user_id\`, \`role_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`role_permissions\` (\`role_id\` varchar(16) NOT NULL, \`permission_id\` varchar(16) NOT NULL, INDEX \`IDX_178199805b901ccd220ab7740e\` (\`role_id\`), INDEX \`IDX_17022daf3f885f7d35423e9971\` (\`permission_id\`), PRIMARY KEY (\`role_id\`, \`permission_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`country_regions\` ADD CONSTRAINT \`FK_8719ea13b224a98a401bb241cfe\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` ADD CONSTRAINT \`FK_d30f5b77485b00ea7314fc3ec8c\` FOREIGN KEY (\`region_id\`) REFERENCES \`country_regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` ADD CONSTRAINT \`FK_9713871a604cf293846c87eeabf\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` ADD CONSTRAINT \`FK_56b42e153434fec87f1a7b27305\` FOREIGN KEY (\`profile_id\`) REFERENCES \`user_profiles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_phones\` ADD CONSTRAINT \`FK_b56470c89ee26f6d89f30e4e498\` FOREIGN KEY (\`phone_country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_phones\` ADD CONSTRAINT \`FK_08a1cb4b6b3d42f8d26d03cd795\` FOREIGN KEY (\`profile_id\`) REFERENCES \`user_profiles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_921e13ecb7520b5bdfc419638fe\` FOREIGN KEY (\`gender_id\`) REFERENCES \`genders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_08cebbf6264e68ce171deaf3e97\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_974e65f08b078104dde8d9850cf\` FOREIGN KEY (\`timezone_id\`) REFERENCES \`timezones\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_9f50920867e4a3d29eec4c74bd4\` FOREIGN KEY (\`avatar_id\`) REFERENCES \`images\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_sessions\` ADD CONSTRAINT \`FK_55fa4db8406ed66bc7044328427\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` ADD CONSTRAINT \`FK_1b5fea09efc20c7f63c4a09b3d6\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_mfa_settings\` ADD CONSTRAINT \`FK_15e9b906c2a4b7bf3870a1b4994\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_23371445bd80cb3e413089551bf\` FOREIGN KEY (\`profile_id\`) REFERENCES \`user_profiles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_9d295cb2f8df33c080e23acfb8f\` FOREIGN KEY (\`status_id\`) REFERENCES \`account_statuses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_87b8888186ca9769c960e926870\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_b23c65e50a758245a33ee35fda1\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_178199805b901ccd220ab7740ec\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_17022daf3f885f7d35423e9971e\` FOREIGN KEY (\`permission_id\`) REFERENCES \`permissions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_17022daf3f885f7d35423e9971e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_178199805b901ccd220ab7740ec\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_b23c65e50a758245a33ee35fda1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_87b8888186ca9769c960e926870\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_9d295cb2f8df33c080e23acfb8f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_23371445bd80cb3e413089551bf\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_mfa_settings\` DROP FOREIGN KEY \`FK_15e9b906c2a4b7bf3870a1b4994\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` DROP FOREIGN KEY \`FK_1b5fea09efc20c7f63c4a09b3d6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_sessions\` DROP FOREIGN KEY \`FK_55fa4db8406ed66bc7044328427\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_9f50920867e4a3d29eec4c74bd4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_974e65f08b078104dde8d9850cf\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_08cebbf6264e68ce171deaf3e97\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_921e13ecb7520b5bdfc419638fe\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_phones\` DROP FOREIGN KEY \`FK_08a1cb4b6b3d42f8d26d03cd795\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_phones\` DROP FOREIGN KEY \`FK_b56470c89ee26f6d89f30e4e498\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` DROP FOREIGN KEY \`FK_56b42e153434fec87f1a7b27305\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` DROP FOREIGN KEY \`FK_9713871a604cf293846c87eeabf\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` DROP FOREIGN KEY \`FK_d30f5b77485b00ea7314fc3ec8c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`country_regions\` DROP FOREIGN KEY \`FK_8719ea13b224a98a401bb241cfe\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_17022daf3f885f7d35423e9971\` ON \`role_permissions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_178199805b901ccd220ab7740e\` ON \`role_permissions\``,
    );
    await queryRunner.query(`DROP TABLE \`role_permissions\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_b23c65e50a758245a33ee35fda\` ON \`user_roles\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_87b8888186ca9769c960e92687\` ON \`user_roles\``,
    );
    await queryRunner.query(`DROP TABLE \`user_roles\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_actor_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_subject_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_resource_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_domain_event_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_occurred_at\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_session_id\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_request_id\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_idempotency_id\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_operation_id\` ON \`activity_audits\``,
    );
    await queryRunner.query(`DROP TABLE \`activity_audits\``);
    await queryRunner.query(`DROP TABLE \`registration_tokens\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_017943867ed5ceef9c03edd974\` ON \`permissions\``,
    );
    await queryRunner.query(`DROP TABLE \`permissions\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_a87cf0659c3ac379b339acf36a\` ON \`roles\``,
    );
    await queryRunner.query(`DROP TABLE \`roles\``);
    await queryRunner.query(
      `DROP INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\``,
    );
    await queryRunner.query(
      `DROP INDEX \`REL_23371445bd80cb3e413089551b\` ON \`users\``,
    );
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(
      `DROP INDEX \`REL_15e9b906c2a4b7bf3870a1b499\` ON \`user_mfa_settings\``,
    );
    await queryRunner.query(`DROP TABLE \`user_mfa_settings\``);
    await queryRunner.query(`DROP TABLE \`account_tokens\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_3d9c0d5337245d3d44f8079751\` ON \`account_statuses\``,
    );
    await queryRunner.query(`DROP TABLE \`account_statuses\``);
    await queryRunner.query(`DROP TABLE \`user_sessions\``);
    await queryRunner.query(`DROP TABLE \`user_profiles\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_df44a14981c12b9b7aa3a799c9\` ON \`timezones\``,
    );
    await queryRunner.query(`DROP TABLE \`timezones\``);
    await queryRunner.query(
      `DROP INDEX \`REL_08a1cb4b6b3d42f8d26d03cd79\` ON \`user_phones\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_0990202281d58188c350423042\` ON \`user_phones\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_b56470c89ee26f6d89f30e4e49\` ON \`user_phones\``,
    );
    await queryRunner.query(`DROP TABLE \`user_phones\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_2425fcf752ffcac4e4e8f90ccf\` ON \`images\``,
    );
    await queryRunner.query(`DROP TABLE \`images\``);
    await queryRunner.query(
      `DROP INDEX \`REL_56b42e153434fec87f1a7b2730\` ON \`profile_addresses\``,
    );
    await queryRunner.query(`DROP TABLE \`profile_addresses\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_39523689c025976b5c89521ab0\` ON \`genders\``,
    );
    await queryRunner.query(`DROP TABLE \`genders\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_b29f9172f8b660e7834000c424\` ON \`countries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_9706e3c52695ce44a202f24c26\` ON \`countries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_a318337c8cc3824514d3dfe2a6\` ON \`countries\``,
    );
    await queryRunner.query(`DROP TABLE \`countries\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_b856bc22c6ec07eda24fb99927\` ON \`country_regions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_8ef62f21aefd2db74ed5860ef1\` ON \`country_regions\``,
    );
    await queryRunner.query(`DROP TABLE \`country_regions\``);
  }
}
