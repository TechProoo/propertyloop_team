// Granular staff permissions.
//
// WHY THIS EXISTS: the backend today has a single binary check —
// AdminController calls `checkAdminAccess(user.role)`, which throws unless
// `role === Role.ADMIN`. Handing the seven staff positions ADMIN accounts
// would give the Secretary and the Ambassador the same powers as the CEO:
// suspend any user, change any listing status, approve withdrawals, resolve
// escrow disputes and read KYC identity documents.
//
// This file is the frontend half of the fix. The backend half is a
// StaffProfile table (userId, staffRole, permissions String[]) and replacing
// checkAdminAccess with a permission check. Until that lands, this gating is
// cosmetic — it shapes the UI but does not secure the API. Do not treat a
// hidden button as an enforced rule.

import type { StaffRole } from './types'

export const Permission = {
  /** See company-wide revenue and the owner dashboard. */
  VIEW_REVENUE: 'VIEW_REVENUE',
  /** See every staff member's scorecard, not just your own. */
  VIEW_ALL_TARGETS: 'VIEW_ALL_TARGETS',
  /** Set and edit monthly targets. */
  MANAGE_TARGETS: 'MANAGE_TARGETS',
  /** Create and move deals in the developer / mandate pipeline. */
  MANAGE_DEALS: 'MANAGE_DEALS',
  /** Add properties and edit their details. */
  MANAGE_PROPERTIES: 'MANAGE_PROPERTIES',
  /** Move a property to Published — the gate onto the live website. */
  PUBLISH_PROPERTY: 'PUBLISH_PROPERTY',
  /** Mark documents verified. */
  VERIFY_DOCUMENTS: 'VERIFY_DOCUMENTS',
  /** Work the lead pipeline. */
  MANAGE_LEADS: 'MANAGE_LEADS',
  /** Flag a lead as qualified — the number Marketing and the GM share. */
  QUALIFY_LEAD: 'QUALIFY_LEAD',
  /** Schedule shoots and manage the content calendar. */
  MANAGE_CONTENT: 'MANAGE_CONTENT',
  /** Work the operations queue (reports, enquiries, listing review). */
  HANDLE_OPS: 'HANDLE_OPS',
  /** Review KYC submissions — real identity documents. */
  REVIEW_KYC: 'REVIEW_KYC',
  /** Approve a withdrawal. This moves money out of the business. */
  APPROVE_WITHDRAWAL: 'APPROVE_WITHDRAWAL',
  /** Resolve an escrow dispute. */
  RESOLVE_DISPUTE: 'RESOLVE_DISPUTE',
  /** Read every person's daily log, not just your own. */
  VIEW_ALL_LOGS: 'VIEW_ALL_LOGS',
  /** Add, suspend or edit staff. */
  MANAGE_STAFF: 'MANAGE_STAFF',
} as const
export type Permission = (typeof Permission)[keyof typeof Permission]

export const PERMISSION_LABEL: Record<Permission, string> = {
  VIEW_REVENUE: 'View company revenue',
  VIEW_ALL_TARGETS: 'View all scorecards',
  MANAGE_TARGETS: 'Set monthly targets',
  MANAGE_DEALS: 'Manage deal pipeline',
  MANAGE_PROPERTIES: 'Manage properties',
  PUBLISH_PROPERTY: 'Publish to website',
  VERIFY_DOCUMENTS: 'Verify documents',
  MANAGE_LEADS: 'Manage leads',
  QUALIFY_LEAD: 'Qualify leads',
  MANAGE_CONTENT: 'Manage content & shoots',
  HANDLE_OPS: 'Handle operations queue',
  REVIEW_KYC: 'Review KYC',
  APPROVE_WITHDRAWAL: 'Approve withdrawals',
  RESOLVE_DISPUTE: 'Resolve disputes',
  VIEW_ALL_LOGS: 'Read all daily logs',
  MANAGE_STAFF: 'Manage staff',
}

/** Permissions that move money or touch identity documents. */
export const SENSITIVE_PERMISSIONS: Permission[] = [
  'APPROVE_WITHDRAWAL',
  'REVIEW_KYC',
  'RESOLVE_DISPUTE',
  'MANAGE_STAFF',
]

const ALL: Permission[] = Object.values(Permission)

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  // Everything. One person, deliberately.
  MD_CEO: ALL,

  // Runs the team and the revenue line. Not KYC, and not payouts — the
  // person carrying the sales number should not also release the money.
  GM: [
    'VIEW_REVENUE',
    'VIEW_ALL_TARGETS',
    'MANAGE_TARGETS',
    'MANAGE_DEALS',
    'MANAGE_PROPERTIES',
    'PUBLISH_PROPERTY',
    'VERIFY_DOCUMENTS',
    'MANAGE_LEADS',
    'QUALIFY_LEAD',
    'MANAGE_CONTENT',
    'HANDLE_OPS',
    'RESOLVE_DISPUTE',
    'VIEW_ALL_LOGS',
  ],

  // Ola and Sodiq (1st). Inventory quality is theirs end to end.
  PROPERTY_LISTING: [
    'MANAGE_DEALS',
    'MANAGE_PROPERTIES',
    'PUBLISH_PROPERTY',
    'VERIFY_DOCUMENTS',
    'MANAGE_LEADS',
    'HANDLE_OPS',
  ],

  // Generates leads and owns the content calendar. Can qualify a lead, which
  // is what the shared definition with the GM is for.
  MARKETING: ['MANAGE_LEADS', 'QUALIFY_LEAD', 'MANAGE_CONTENT'],

  // Ngozi. The operations queue is the job, so this is the widest ops access
  // outside management — including KYC, which is currently unowned.
  OPERATIONS: [
    'MANAGE_LEADS',
    'QUALIFY_LEAD',
    'HANDLE_OPS',
    'REVIEW_KYC',
    'MANAGE_PROPERTIES',
  ],

  // On camera. Needs to see what is being shot and nothing else.
  AMBASSADOR: ['MANAGE_CONTENT'],

  // Preps shoots. Same content scope as the Ambassador, plus the ops queue
  // for correspondence and follow-ups.
  SECRETARY: ['MANAGE_CONTENT', 'HANDLE_OPS'],
}

export function can(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function canAny(role: StaffRole, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p))
}
