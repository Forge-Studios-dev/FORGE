import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { SkillTag } from './skill-tag.entity';

@Entity('subcategories')
@Index(['categoryId'])
export class Subcategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Category, (cat) => cat.subcategories, { onDelete: 'CASCADE' })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 120 })
  slug: string;

  @OneToMany(() => SkillTag, (tag) => tag.subcategory)
  skillTags: SkillTag[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
