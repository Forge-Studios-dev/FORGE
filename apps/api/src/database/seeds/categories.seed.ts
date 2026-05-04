import { DataSource } from 'typeorm';
import { Category } from '../../modules/categories/entities/category.entity';
import { Subcategory } from '../../modules/categories/entities/subcategory.entity';
import { SkillTag } from '../../modules/categories/entities/skill-tag.entity';

const SEED_DATA = [
  {
    name: 'Physical Crafts',
    slug: 'physical-crafts',
    sortOrder: 1,
    subcategories: [
      {
        name: 'Woodworking',
        slug: 'woodworking',
        skills: ['Carving', 'Joinery', 'Furniture Making', 'Wood Burning'],
      },
      {
        name: 'Pottery & Ceramics',
        slug: 'pottery-ceramics',
        skills: ['Wheel Throwing', 'Hand Building', 'Glazing'],
      },
      {
        name: 'Leatherwork',
        slug: 'leatherwork',
        skills: ['Tooling', 'Stitching', 'Dyeing'],
      },
    ],
  },
  {
    name: 'Art & Design',
    slug: 'art-design',
    sortOrder: 2,
    subcategories: [
      {
        name: 'Drawing & Illustration',
        slug: 'drawing-illustration',
        skills: ['Sketching', 'Portrait', 'Character Design', 'Botanical Art'],
      },
      {
        name: 'Digital Art',
        slug: 'digital-art',
        skills: ['Procreate', 'Photoshop', 'Figma', 'Motion Graphics'],
      },
      {
        name: 'Painting',
        slug: 'painting',
        skills: ['Oil', 'Watercolour', 'Acrylic', 'Gouache'],
      },
    ],
  },
  {
    name: 'Tech',
    slug: 'tech',
    sortOrder: 3,
    subcategories: [
      {
        name: 'Programming',
        slug: 'programming',
        skills: ['JavaScript', 'Python', 'Rust', 'Go', 'TypeScript'],
      },
      {
        name: 'Electronics & Robotics',
        slug: 'electronics-robotics',
        skills: ['Arduino', 'Raspberry Pi', 'Circuit Design', 'PCB'],
      },
      {
        name: '3D Printing & CAD',
        slug: '3d-printing-cad',
        skills: ['FDM Printing', 'Resin Printing', 'Fusion 360', 'Blender'],
      },
    ],
  },
  {
    name: 'Fitness',
    slug: 'fitness',
    sortOrder: 4,
    subcategories: [
      {
        name: 'Calisthenics',
        slug: 'calisthenics',
        skills: ['Handstand', 'Muscle Up', 'Planche', 'Front Lever'],
      },
      {
        name: 'Yoga & Flexibility',
        slug: 'yoga-flexibility',
        skills: ['Hatha', 'Vinyasa', 'Yin Yoga', 'Stretching'],
      },
      {
        name: 'Martial Arts',
        slug: 'martial-arts',
        skills: ['BJJ', 'Boxing', 'Muay Thai', 'Judo'],
      },
    ],
  },
  {
    name: 'Learning',
    slug: 'learning',
    sortOrder: 5,
    subcategories: [
      {
        name: 'Languages',
        slug: 'languages',
        skills: ['Spanish', 'Japanese', 'French', 'Mandarin', 'Arabic'],
      },
      {
        name: 'Productivity',
        slug: 'productivity',
        skills: ['Note-taking', 'Time Management', 'Speed Reading', 'PKM'],
      },
      {
        name: 'Mathematics',
        slug: 'mathematics',
        skills: ['Calculus', 'Linear Algebra', 'Statistics', 'Number Theory'],
      },
    ],
  },
  {
    name: 'Music',
    slug: 'music',
    sortOrder: 6,
    subcategories: [
      {
        name: 'Instruments',
        slug: 'instruments',
        skills: ['Guitar', 'Piano', 'Drums', 'Violin', 'Bass'],
      },
      {
        name: 'Music Production',
        slug: 'music-production',
        skills: ['Ableton', 'FL Studio', 'Mixing', 'Mastering', 'Sound Design'],
      },
      {
        name: 'Vocals',
        slug: 'vocals',
        skills: ['Singing', 'Beatboxing', 'Songwriting', 'Choir'],
      },
    ],
  },
];

export async function seedCategories(dataSource: DataSource) {
  const categoryRepo = dataSource.getRepository(Category);
  const subcategoryRepo = dataSource.getRepository(Subcategory);
  const skillTagRepo = dataSource.getRepository(SkillTag);

  for (const catData of SEED_DATA) {
    let category = await categoryRepo.findOne({ where: { slug: catData.slug } });
    if (!category) {
      category = await categoryRepo.save(
        categoryRepo.create({
          name: catData.name,
          slug: catData.slug,
          sortOrder: catData.sortOrder,
        }),
      );
    }

    for (const subData of catData.subcategories) {
      let sub = await subcategoryRepo.findOne({ where: { slug: subData.slug, categoryId: category.id } });
      if (!sub) {
        sub = await subcategoryRepo.save(
          subcategoryRepo.create({
            name: subData.name,
            slug: subData.slug,
            categoryId: category.id,
          }),
        );
      }

      for (const skillName of subData.skills) {
        const slug = skillName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const existing = await skillTagRepo.findOne({ where: { slug, subcategoryId: sub.id } });
        if (!existing) {
          await skillTagRepo.save(
            skillTagRepo.create({ name: skillName, slug, subcategoryId: sub.id }),
          );
        }
      }
    }
  }

  console.log('✓ Categories seed complete');
}
