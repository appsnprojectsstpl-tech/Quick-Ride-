import { Home, Clock, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/rider', icon: Home, label: 'Home' },
  { path: '/rider/history', icon: Clock, label: 'History' },
  { path: '/rider/profile', icon: User, label: 'Profile' },
];

const RiderNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="nav-bar">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={cn(
            'nav-item',
            location.pathname === item.path && 'active'
          )}
        >
          <item.icon className="w-5 h-5" />
          <span className="text-xs">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default RiderNavBar;
