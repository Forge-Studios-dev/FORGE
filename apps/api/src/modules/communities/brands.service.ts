import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from './entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
  ) {}

  async listBrands(creatorId: string) {
    const brands = await this.brandRepository.find({
      where: { creatorId },
      order: { createdAt: 'ASC' },
    });
    return brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      createdAt: b.createdAt,
    }));
  }

  async createBrand(creatorId: string, input: { name: string; slug?: string }) {
    const slug =
      input.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') ||
      input.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = await this.brandRepository.findOne({ where: { creatorId, slug } });
    if (existing) throw new BadRequestException('Brand slug already exists');

    const brand = await this.brandRepository.save(
      this.brandRepository.create({ creatorId, name: input.name.trim(), slug }),
    );
    return { id: brand.id, name: brand.name, slug: brand.slug };
  }

  async updateBrand(creatorId: string, brandId: string, input: { name?: string; slug?: string }) {
    const brand = await this.getOwnedBrand(creatorId, brandId);
    if (input.name !== undefined) brand.name = input.name.trim();
    if (input.slug !== undefined) {
      const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const clash = await this.brandRepository.findOne({ where: { creatorId, slug } });
      if (clash && clash.id !== brandId) throw new BadRequestException('Slug already in use');
      brand.slug = slug;
    }
    const saved = await this.brandRepository.save(brand);
    return { id: saved.id, name: saved.name, slug: saved.slug };
  }

  async deleteBrand(creatorId: string, brandId: string) {
    await this.getOwnedBrand(creatorId, brandId);
    await this.brandRepository.delete(brandId);
    return { deleted: true };
  }

  private async getOwnedBrand(creatorId: string, brandId: string): Promise<Brand> {
    const brand = await this.brandRepository.findOne({ where: { id: brandId } });
    if (!brand || brand.creatorId !== creatorId) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }
}
