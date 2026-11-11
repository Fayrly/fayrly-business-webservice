import { SessionUser } from '../models/auth.model';

export const PERMISSIONS = {
  eventRead: 'event:read',
  eventWrite: 'event:write',
  eventDelete: 'event:delete',
  eventPublish: 'event:publish',
  reportRead: 'report:read',
  reportWrite: 'report:write',
  reportDelete: 'report:delete',
  reportApprove: 'report:approve',
  userRead: 'user:read',
  userWrite: 'user:write',
  userDelete: 'user:delete',
  roleRead: 'role:read',
  roleWrite: 'role:write',
} as const;

export const ORGANIZER_PERMISSIONS: string[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<string, string> = {
  'event:read': 'Melihat event',
  'event:write': 'Mengelola event',
  'event:delete': 'Menghapus event',
  'event:publish': 'Menerbitkan event',
  'report:read': 'Melihat laporan',
  'report:write': 'Menulis laporan',
  'report:delete': 'Menghapus laporan',
  'report:approve': 'Meninjau laporan',
  'user:read': 'Melihat pengguna',
  'user:write': 'Mengelola pengguna',
  'user:delete': 'Menghapus pengguna',
  'role:read': 'Melihat peran',
  'role:write': 'Mengubah peran',
};

const RESOURCE_LABELS: Record<string, string> = {
  event: 'Event',
  events: 'Event',
  report: 'Laporan',
  reports: 'Laporan',
  user: 'Pengguna',
  users: 'Pengguna',
  role: 'Peran',
  roles: 'Peran',
};

export function permissionLabel(key: string): string {
  return PERMISSION_LABELS[key] ?? key;
}

export function permissionResourceLabel(resource: string): string {
  return (
    RESOURCE_LABELS[resource] ??
    resource.charAt(0).toUpperCase() + resource.slice(1).replace(/[-_]/g, ' ')
  );
}

export function hasAnyPermission(user: SessionUser | null, keys: readonly string[]): boolean {
  if (!user) {
    return false;
  }
  return keys.some((key) => (user.permissions ?? []).includes(key));
}

export function isOrganizer(user: SessionUser | null): boolean {
  return hasAnyPermission(user, ORGANIZER_PERMISSIONS);
}
