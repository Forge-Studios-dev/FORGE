import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BrandsService } from './brands.service';
import { Brand } from './entities/brand.entity';

describe('BrandsService', () => {
  let service: BrandsService;
  let brandRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    brandRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((x) => Promise.resolve({ ...x, id: 'brand-1' })),
      create: jest.fn((x) => x),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BrandsService, { provide: getRepositoryToken(Brand), useValue: brandRepository }],
    }).compile();

    service = module.get(BrandsService);
  });

  it('lists brands for creator', async () => {
    brandRepository.find.mockResolvedValue([
      { id: 'b1', name: 'Brand', slug: 'brand', createdAt: new Date() },
    ]);
    const result = await service.listBrands('creator-1');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('brand');
  });

  it('creates brand with slug', async () => {
    const result = await service.createBrand('creator-1', { name: 'My Brand' });
    expect(result.slug).toBe('my-brand');
  });

  it('rejects duplicate slug', async () => {
    brandRepository.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.createBrand('creator-1', { name: 'Dup' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deletes owned brand', async () => {
    brandRepository.findOne.mockResolvedValue({ id: 'brand-1', creatorId: 'creator-1' });
    const result = await service.deleteBrand('creator-1', 'brand-1');
    expect(result.deleted).toBe(true);
  });

  it('rejects delete for unknown brand', async () => {
    brandRepository.findOne.mockResolvedValue(null);
    await expect(service.deleteBrand('creator-1', 'brand-1')).rejects.toThrow(NotFoundException);
  });
});
