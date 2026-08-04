import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';

@ApiTags('Brands')
@Controller('creators/me/brands')
@UseGuards(SkillEconomyLmsGuard, CreatorApprovedGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'List creator brands' })
  list(@CurrentUser() user: JwtPayload) {
    return this.brandsService.listBrands(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a brand' })
  create(@CurrentUser() user: JwtPayload, @Body() body: { name: string; slug?: string }) {
    return this.brandsService.createBrand(user.sub, body);
  }

  @Patch(':brandId')
  @ApiOperation({ summary: 'Update a brand' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('brandId') brandId: string,
    @Body() body: { name?: string; slug?: string },
  ) {
    return this.brandsService.updateBrand(user.sub, brandId, body);
  }

  @Delete(':brandId')
  @ApiOperation({ summary: 'Delete a brand' })
  remove(@CurrentUser() user: JwtPayload, @Param('brandId') brandId: string) {
    return this.brandsService.deleteBrand(user.sub, brandId);
  }
}
