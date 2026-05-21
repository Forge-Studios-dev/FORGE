import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { Report } from '../reports/entities/report.entity';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { PlaylistsModule } from '../playlists/playlists.module';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Video, Report]),
    ContentModule,
    ReportsModule,
    AnalyticsModule,
    CategoriesModule,
    UsersModule,
    PlaylistsModule,
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
