import { redirect } from 'next/navigation';

type Props = {
  searchParams?: { type?: string };
};

export default function UploadPage({ searchParams }: Props) {
  const q = searchParams?.type === 'short' ? '?type=short' : '';
  redirect(`/upload/step/1${q}`);
}
