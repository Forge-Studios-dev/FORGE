'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, Video, Eye } from 'lucide-react';
import { api } from '@/lib/api';

interface Stats {
  userCount: number;
  videoCount: number;
  readyVideoCount: number;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{label}</p>
        <div className="p-2 bg-indigo-600/10 rounded-lg">
          <Icon size={18} className="text-indigo-400" />
        </div>
      </div>
      <p className="text-3xl font-bold">{value?.toLocaleString() ?? '—'}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stats');
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <StatCard label="Total Users" value={stats?.userCount || 0} icon={Users} />
        <StatCard label="Total Videos" value={stats?.videoCount || 0} icon={Video} />
        <StatCard label="Published Videos" value={stats?.readyVideoCount || 0} icon={Eye} />
      </div>
    </div>
  );
}
