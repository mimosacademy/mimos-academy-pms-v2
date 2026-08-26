import {
  LayoutDashboard, GraduationCap, Building2, Target, FileText, Receipt, CreditCard,
  CalendarClock, Users, CheckSquare, BarChart3, Settings, ClipboardList,
} from 'lucide-react';

export const ROLES = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  staff: 'Staff / PIC',
  finance: 'Finance',
  sales: 'Sales',
  programme_pic: 'Programme PIC',
  trainer: 'Trainer',
  viewer: 'Viewer',
};

const ALL = Object.keys(ROLES);
const MANAGEMENT = ['super_admin', 'manager'];
const OPERATIONAL = [...MANAGEMENT, 'staff'];

export const NAV_SECTIONS = [
  { label: 'Overview', items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL }] },
  { label: 'Pipeline', items: [
    { path: '/opportunities', label: 'Opportunities', icon: Target, roles: [...OPERATIONAL, 'sales'] },
    { path: '/quotations', label: 'Quotations', icon: FileText, roles: [...OPERATIONAL, 'sales', 'finance'] },
    { path: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList, roles: [...OPERATIONAL, 'sales', 'finance'] },
  ] },
  { label: 'Programmes', items: [
    { path: '/programmes', label: 'Programmes', icon: GraduationCap, roles: [...OPERATIONAL, 'programme_pic', 'trainer', 'viewer', 'sales', 'finance'] },
    { path: '/clients', label: 'Clients', icon: Building2, roles: [...OPERATIONAL, 'sales', 'finance', 'programme_pic'] },
    { path: '/training', label: 'Training Delivery', icon: CalendarClock, roles: [...OPERATIONAL, 'programme_pic', 'trainer'] },
    { path: '/participants', label: 'Participants', icon: Users, roles: [...OPERATIONAL, 'programme_pic', 'trainer'] },
  ] },
  { label: 'Finance', items: [
    { path: '/invoices', label: 'Invoices', icon: Receipt, roles: [...OPERATIONAL, 'finance'] },
    { path: '/payments', label: 'Payment Collection', icon: CreditCard, roles: [...OPERATIONAL, 'finance'] },
  ] },
  { label: 'Workspace', items: [
    { path: '/action-items', label: 'Action Items', icon: CheckSquare, roles: ALL },
    { path: '/reports', label: 'Programme Reports', icon: BarChart3, roles: [...OPERATIONAL, 'finance', 'sales', 'viewer'] },
  ] },
  { label: 'System', items: [{ path: '/administration', label: 'Administration', icon: Settings, roles: ['super_admin'] }] },
];

export const canAccess = (role, path) => NAV_SECTIONS.some((section) =>
  section.items.some((item) => item.path === path && item.roles.includes(role))
);

export const visibleSections = (role) => NAV_SECTIONS
  .map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(role)) }))
  .filter((section) => section.items.length > 0);
