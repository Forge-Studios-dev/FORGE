import { redirect } from 'next/navigation';

/** Channel points oversight retired with skill-economy LMS; keep route from 404ing. */
export default function ChannelPointsOversightPage() {
  redirect('/dashboard');
}
