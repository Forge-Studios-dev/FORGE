import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course, CourseCohort } from './entities/course.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseCohort) private readonly cohortRepository: Repository<CourseCohort>,
  ) {}

  async listForCreator(creatorId: string) {
    const courses = await this.courseRepository.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
    });
    return courses;
  }

  async createCourse(creatorId: string, input: { title: string; description?: string }) {
    const slug = input.title.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = await this.courseRepository.findOne({ where: { creatorId, slug } });
    if (existing) throw new BadRequestException('Course slug already exists');
    return this.courseRepository.save(
      this.courseRepository.create({
        creatorId,
        title: input.title.trim(),
        slug,
        description: input.description?.trim() || null,
      }),
    );
  }

  async createCohort(creatorId: string, courseId: string, input: { name: string }) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.cohortRepository.save(
      this.cohortRepository.create({ courseId, name: input.name.trim() }),
    );
  }
}
