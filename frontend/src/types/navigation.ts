import type { LucideIcon } from 'lucide-react';
import type { UserRole } from './auth';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
}
