import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountStrikesController } from './account-strikes.controller';
import { AccountStrikesService } from './account-strikes.service';
import { AccountStrike } from './entities/account-strike.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccountStrike, User])],
  controllers: [AccountStrikesController],
  providers: [AccountStrikesService],
  exports: [AccountStrikesService],
})
export class AccountStrikesModule {}
