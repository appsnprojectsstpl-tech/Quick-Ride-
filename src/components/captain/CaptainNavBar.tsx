import { Home, Navigation, Wallet, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/captain', icon: Home, label: 'Home' },
  { path: '/captain/rides', icon: Navigation, label: 'Rides' },
  { path: '/captain/earnings', icon: Wallet, label: 'Earnings' },
  { path: '/captain/profile', icon: User, label: 'Profile' },
];

const CaptainNavBar = () => {
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

export default CaptainNavBar;
