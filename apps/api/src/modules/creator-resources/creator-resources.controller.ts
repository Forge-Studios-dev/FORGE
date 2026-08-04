import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatorResourcesService } from './creator-resources.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { ResourceVisibility } from './entities/creator-resource.entity';

@ApiTags('Creator Resources')
@Controller()
export class CreatorResourcesController {
  constructor(private readonly resourcesService: CreatorResourcesService) {}

  @Post('creators/me/resources/upload-url')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Get presigned S3 URL to upload a resource file' })
  getUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      fileName: string;
      mimeType: string;
      fileSizeBytes?: number;
    },
  ) {
    return this.resourcesService.getUploadUrl(
      user.sub,
      body.fileName,
      body.mimeType,
      body.fileSizeBytes,
    );
  }

  @Post('creators/me/resources')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Register a resource after upload' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      title: string;
      description?: string;
      fileKey: string;
      fileUrl: string;
      fileName: string;
      mimeType: string;
      fileSizeBytes?: number;
      visibility?: ResourceVisibility;
      requiredTierId?: string;
    },
  ) {
    return this.resourcesService.create(user.sub, body);
  }

  @Patch('creators/me/resources/:resourceId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a resource (title, description, visibility)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      visibility?: ResourceVisibility;
      requiredTierId?: string | null;
      isActive?: boolean;
    },
  ) {
    return this.resourcesService.update(user.sub, resourceId, body);
  }

  @Delete('creators/me/resources/:resourceId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Delete a resource (removes S3 file)' })
  remove(@CurrentUser() user: JwtPayload, @Param('resourceId', ParseUUIDPipe) resourceId: string) {
    return this.resourcesService.remove(user.sub, resourceId);
  }

  @Get('creators/me/resources')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List all creator resources (studio)' })
  listForCreator(@CurrentUser() user: JwtPayload) {
    return this.resourcesService.listForCreator(user.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/resources')
  @ApiOperation({ summary: 'List active resources for a creator (consumer)' })
  listPublic(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @CurrentUser() user?: JwtPayload,
    @Query('limit') _limit?: string,
  ) {
    return this.resourcesService.listPublic(creatorId, user?.sub);
  }

  @Get('resources/:resourceId/download-url')
  @ApiOperation({ summary: 'Get a presigned download URL (access-checked)' })
  getDownloadUrl(@Param('resourceId', ParseUUIDPipe) resourceId: string, @CurrentUser() user: JwtPayload) {
    return this.resourcesService.getDownloadUrl(resourceId, user.sub);
  }
}
