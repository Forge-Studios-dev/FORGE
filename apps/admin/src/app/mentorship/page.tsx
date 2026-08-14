import { redirect } from 'next/navigation';

/** Mentorship oversight retired with skill-economy LMS; keep route from 404ing. */
export default function MentorshipOversightPage() {
  redirect('/dashboard');
}
