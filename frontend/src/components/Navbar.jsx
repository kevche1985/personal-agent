import { NavLink } from 'react-router-dom';
import { CheckSquare, DollarSign, FileText, MessageSquare, LayoutDashboard, Settings } from 'lucide-react';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/budget', label: 'Budget', icon: DollarSign },
  { to: '/statements', label: 'Statements', icon: FileText },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
];

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
      <span className="font-bold text-brand-700 text-lg mr-4">Personal Agent</span>
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-1.5 text-sm font-medium transition-colors ${
              isActive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800'
            }`
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
      <div className="ml-auto">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-1.5 text-sm font-medium transition-colors ${
              isActive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800'
            }`
          }
        >
          <Settings size={16} />
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
