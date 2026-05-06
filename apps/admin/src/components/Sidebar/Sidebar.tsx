'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Video, Tag, Settings, LogOut, UserCheck } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/creator-approvals', label: 'Creator Approvals', icon: UserCheck },
  { href: '/content', label: 'Content', icon: Video },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <span className="text-xl font-bold text-white">FORGE</span>
        <span className="ml-2 text-xs text-gray-500 font-medium uppercase tracking-wider">Admin</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => {
            localStorage.removeItem('forge_admin_token');
            window.location.href = '/login';
          }}
          className="flex items-center gap-3 px-3 py-2 w-full text-left text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
