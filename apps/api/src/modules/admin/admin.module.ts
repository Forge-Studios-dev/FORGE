import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { User } from '../users/entities/user.entity';
import { Video } from '../content/entities/video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Video])],
  controllers: [AdminController],
})
export class AdminModule {}
