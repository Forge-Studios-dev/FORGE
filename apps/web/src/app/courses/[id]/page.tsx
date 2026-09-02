import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@forge/design-system';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { getServerPlatformConfig } from '@/lib/server-platform-config';
import { isCoursesFeatureEnabled } from '@forge/shared-types';
import { JsonLd } from '@/components/seo/JsonLd';
import { CourseViewerSection } from '@/components/Courses/CourseViewerSection';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

type PublicCourse = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  lessonCount: number;
  creator: { id: string; username: string; displayName: string } | null;
};

async function getCourse(id: string): Promise<PublicCourse | null> {
  try {
    const { data } = await serverApi.get(`/courses/${id}/catalog`);
    return data.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await getCourse(params.id);
  if (!course) return { title: 'Course not found' };

  const description =
    course.description || `A ${course.lessonCount}-lesson course on FORGE${course.creator ? ` by ${course.creator.displayName}` : ''}`;

  return {
    title: course.title,
    description,
    openGraph: {
      title: course.title,
      description,
      type: 'website',
      url: `${SITE_URL}/courses/${course.id}`,
    },
    twitter: {
      card: 'summary',
      title: course.title,
      description,
    },
  };
}

export default async function CoursePage({ params }: Props) {
  const platformConfig = await getServerPlatformConfig();
  if (!isCoursesFeatureEnabled(platformConfig)) {
    redirect('/explore');
  }

  const course = await getCourse(params.id);
  if (!course) notFound();

  const lessonLabel = `${course.lessonCount} lesson${course.lessonCount === 1 ? '' : 's'}`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: course.title,
          description: course.description || course.title,
          url: `${SITE_URL}/courses/${course.id}`,
          provider: {
            '@type': 'Organization',
            name: 'FORGE',
            sameAs: SITE_URL,
          },
          ...(course.creator
            ? {
                instructor: {
                  '@type': 'Person',
                  name: course.creator.displayName,
                  url: `${SITE_URL}/${course.creator.username}`,
                },
              }
            : {}),
          hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: 'online',
          },
        }}
      />
      <PageHeader
        title={course.title}
        subtitle={course.creator ? `By ${course.creator.displayName} · ${lessonLabel}` : lessonLabel}
      />
      {course.description ? (
        <p className="mb-6 text-sm text-on-surface-variant">{course.description}</p>
      ) : null}
      <CourseViewerSection courseId={course.id} />
    </main>
  );
}
