import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Report } from './entities/report.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Comment } from '../engagement/entities/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Report, Video, User, Comment])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
