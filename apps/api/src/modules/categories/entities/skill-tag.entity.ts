import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Subcategory } from './subcategory.entity';
import { Video } from '../../content/entities/video.entity';

@Entity('skill_tags')
@Index(['subcategoryId'])
export class SkillTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Subcategory, (sub) => sub.skillTags, { onDelete: 'CASCADE' })
  subcategory: Subcategory;

  @Column({ name: 'subcategory_id' })
  subcategoryId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 120 })
  slug: string;

  @ManyToMany(() => Video, (video) => video.skillTags)
  videos: Video[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
