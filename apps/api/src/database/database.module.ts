import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { buildTypeOrmPostgresOptions } from './typeorm-shared-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => buildTypeOrmPostgresOptions(process.env),
    }),
  ],
})
export class DatabaseModule {}
