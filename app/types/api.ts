export type Language = 'ES' | 'EN' | 'CA'

export type RoleName = 'USER' | 'ADMIN'

export type OrganizationRole = 'OWNER' | 'MANAGER' | 'USER' | 'SPECTATOR'

export type PieceStatus = 'ACTIVE' | 'PENDING'

export interface Role {
  id: number
  name: RoleName
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface User {
  id: number
  username: string
  name: string
  lastName: string
  email: string
  emailVerified: boolean
  enabled: boolean
  language: Language
  role: Role
  twoFactorEnabled?: boolean
}

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'EMAIL_VERIFIED'
  | 'TWO_FACTOR_ENABLED'
  | 'TWO_FACTOR_DISABLED'
  | 'TWO_FACTOR_CHALLENGE_FAILED'
  | 'OAUTH_LINKED'
  | 'OAUTH_UNLINKED'
  | 'REFRESH_REUSE_DETECTED'
  | 'NEW_DEVICE_LOGIN'
  | 'SESSION_REVOKED'

export interface SecurityActivityEntry {
  id: number
  eventType: SecurityEventType
  success: boolean
  ipAddress: string | null
  userAgent: string | null
  metadata: string | null
  createdAt: string
}

export interface PagedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface UserSession {
  id: number
  displayName: string
  userAgent: string | null
  lastIp: string | null
  firstSeenAt: string
  lastSeenAt: string
  current: boolean
}

export interface TwoFactorSetupResponse {
  setupToken: string
  secret: string
  otpAuthUri: string
}

export interface TwoFactorRecoveryCodesResponse {
  recoveryCodes: string[]
}

export interface LoginUserDto {
  email: string
  password: string
  rememberMe?: boolean
}

export interface LoginResponseDto {
  accessToken: string
  expiresIn: number
  user: User
}

export interface RegisterUserDto {
  username: string
  name: string
  lastName: string
  email: string
  password: string
  repeatPassword: string
  language: Language
}

export interface ForgotPasswordRequestDto {
  email: string
}

export interface ResetPasswordRequestDto {
  token: string
  newPassword: string
  repeatPassword: string
}

export interface VerifyEmailRequestDto {
  token: string
}

export interface ResendVerificationRequestDto {
  email: string
}

export interface UpdateUserProfileDto {
  name?: string
  lastName?: string
  email?: string
  username?: string
  language?: Language
}

export interface ChangePasswordDto {
  currentPassword: string
  newPassword: string
  repeatPassword: string
}

export interface OrganizationResponseDto {
  id: number
  name: string
  slug: string
  currentUserRole: OrganizationRole
  /**
   * Whether the private "piece-type actions" feature is available to the current user for this
   * organization (only enabled when the organization's owner is a global admin). Optional so older
   * payloads without the flag are treated as disabled.
   */
  pieceTypeActionsEnabled?: boolean
  /**
   * Whether the private "ports" feature is available to the current user for this organization
   * (only enabled when the organization's owner is a global admin). Optional so older payloads
   * without the flag are treated as disabled.
   */
  portsEnabled?: boolean
}

export interface OrganizationLookupResponseDto {
  org: OrganizationResponseDto
  historical: boolean
  currentSlug: string
}

export interface CreateOrganizationDto {
  name: string
  slug: string
}

export interface UpdateOrganizationDto {
  name?: string
  slug?: string
}

export interface PieceTypeRefDto {
  id: number
  name: string
}

export interface PieceListItemDto {
  id: number
  name: string
  serialNumber?: string | null
  pieceTypes: PieceTypeRefDto[]
  ownerUserId?: number
  locationId?: number
  coverAttachmentId?: number | null
  status: PieceStatus
  createdAt: string
  updatedAt: string
}

export interface SortObject {
  empty: boolean
  sorted: boolean
  unsorted: boolean
}

export interface PageableObject {
  offset: number
  paged: boolean
  pageNumber: number
  pageSize: number
  sort: SortObject
  unpaged: boolean
}

export interface Page<T> {
  totalElements: number
  totalPages: number
  size: number
  content: T[]
  number: number
  pageable: PageableObject
  sort: SortObject
  numberOfElements: number
  first: boolean
  last: boolean
  empty: boolean
}

export type PagePieceListItemDto = Page<PieceListItemDto>

export interface LocationTreeNodeDto {
  id: number
  name: string
  description?: string
  children: LocationTreeNodeDto[]
}

export interface LocationBreadcrumbItemDto {
  id: number
  name: string
}

export interface LocationResponseDto {
  id: number
  organizationId: number
  name: string
  description?: string
  parentId?: number
  createdAt: string
  updatedAt: string
  breadcrumb: LocationBreadcrumbItemDto[]
}

export interface CreateLocationDto {
  name: string
  description?: string
  parentId?: number
}

export interface UpdateLocationDto {
  name?: string
  description?: string
  parentId?: number
  moveToRoot?: boolean
}

export interface UpdatePieceLocationDto {
  locationId?: number
  clearLocation?: boolean
}

export type PieceAttachmentKind = 'IMAGE' | 'DOCUMENT'

export type PieceHistoryAction =
  | 'PIECE_CREATED'
  | 'PIECE_UPDATED'
  | 'PIECE_DELETED'
  | 'OWNER_CHANGED'
  | 'LOCATION_CHANGED'
  | 'STATUS_CHANGED'
  | 'ATTRIBUTE_VALUE_CHANGED'
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_REMOVED'
  | 'PIECE_TYPES_CHANGED'

export type AttributeScope = 'TYPE' | 'ORG'

export interface AttributeValueInputDto {
  attributeId: number
  scope?: AttributeScope
  value: string | null
}

export interface PieceAttributeValueResponseDto {
  attributeId: number
  scope: AttributeScope
  attributeName: string
  displayName: string
  type: AttributeType
  value: string | null
}

export interface PieceAttachmentResponseDto {
  id: number
  kind: PieceAttachmentKind
  originalFilename: string
  mimeType: string
  sizeBytes: number
  uploadedByUserId?: number
  createdAt: string
}

export interface PieceResponseDto {
  id: number
  organizationId: number
  name: string
  serialNumber?: string | null
  description?: string
  pieceTypes: PieceTypeRefDto[]
  ownerUserId?: number
  locationId?: number
  coverAttachmentId?: number | null
  status: PieceStatus
  createdAt: string
  updatedAt: string
  attributeValues: PieceAttributeValueResponseDto[]
  attachments: PieceAttachmentResponseDto[]
}

export interface CreatePieceDto {
  name: string
  serialNumber?: string | null
  description?: string
  pieceTypeIds: number[]
  ownerUserId?: number
  locationId?: number
  attributeValues?: AttributeValueInputDto[]
}

export interface UpdatePieceDto {
  name?: string
  serialNumber?: string | null
  description?: string
  pieceTypeIds?: number[]
  ownerUserId?: number
  clearOwner?: boolean
  locationId?: number
  clearLocation?: boolean
  coverAttachmentId?: number | null
  clearCover?: boolean
  attributeValues?: AttributeValueInputDto[]
}

export interface PieceHistoryItemDto {
  id: number
  actorUserId?: number
  action: PieceHistoryAction
  fieldName?: string
  oldValue?: string
  newValue?: string
  createdAt: string
}

export interface PieceListFilters {
  typeId?: number
  locationId?: number
  ownerUserId?: number
  status?: PieceStatus
  q?: string
  page?: number
  size?: number
  sort?: string
}

export type AttributeType =
  | 'TEXT'
  | 'LONGTEXT'
  | 'INTEGER'
  | 'DECIMAL'
  | 'PRICE'
  | 'DATE'
  | 'DATETIME'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'URL'
  | 'EMAIL'
  | 'MEMBER'

export interface AttributeValidatorsDto {
  minLength?: number
  maxLength?: number
  regex?: string
  min?: number
  max?: number
  decimals?: number
  currency?: string
  minDate?: string
  maxDate?: string
  allowFuture?: boolean
  allowPast?: boolean
  options?: string[]
  minItems?: number
  maxItems?: number
  eligibleRoles?: OrganizationRole[]
}

export interface PieceTypeAttributeResponseDto {
  id: number
  name: string
  displayName: string
  type: AttributeType
  required: boolean
  position: number
  validators: AttributeValidatorsDto
}

export interface PieceTypeResponseDto {
  id: number
  organizationId: number
  name: string
  createdAt: string
  updatedAt: string
  attributes: PieceTypeAttributeResponseDto[]
}

export interface CreatePieceTypeAttributeDto {
  name: string
  displayName: string
  type: AttributeType
  required?: boolean
  position?: number
  validators?: AttributeValidatorsDto
}

export interface CreatePieceTypeDto {
  name: string
  attributes?: CreatePieceTypeAttributeDto[]
}

export interface UpdatePieceTypeDto {
  name?: string
}

export interface UpdatePieceTypeAttributeDto {
  name?: string
  displayName?: string
  type?: AttributeType
  required?: boolean
  position?: number
  validators?: AttributeValidatorsDto
}

/**
 * A single typed parameter of a piece-type action (e.g. `tiempo` of type `INTEGER`). Reuses the
 * attribute {@link AttributeType} and {@link AttributeValidatorsDto} typing system.
 *
 * Binding mode:
 * - `dynamic === false` (the default): the value is fixed once here in `staticValue` and shared by
 *   every piece of the type, in every timeline.
 * - `dynamic === true`: no value is stored; it is supplied per clip in the timeline editor, so
 *   `staticValue` stays empty.
 * `staticValue` is the canonical serialized string of the value (e.g. `"true"`, a JSON array for
 * MULTI_SELECT), matching how piece attribute values are stored.
 */
export interface ActionParameterDto {
  name: string
  displayName: string
  type: AttributeType
  required: boolean
  position?: number
  validators?: AttributeValidatorsDto
  dynamic?: boolean
  staticValue?: string | null
  // When true (only one numeric param per action), this parameter's value (in seconds) is the clip
  // length on the timeline, so there is no separate clip-duration field.
  isDuration?: boolean
}

export interface PieceTypeActionResponseDto {
  id: number
  name: string
  displayName: string
  description?: string | null
  position: number
  parameters: ActionParameterDto[]
}

export interface CreatePieceTypeActionDto {
  name: string
  displayName: string
  description?: string
  position?: number
  parameters: ActionParameterDto[]
}

export interface UpdatePieceTypeActionDto {
  name?: string
  displayName?: string
  description?: string
  position?: number
  parameters?: ActionParameterDto[]
}

/**
 * A port (Raspberry Pi GPIO output) declared by an organization, e.g. "Salida tira led 1" wired to
 * pin 21 and related to an existing piece type via {@link pieceTypeId} ({@link pieceTypeName} is its
 * resolved display name, {@code null} if the type was deleted), with a list of typed
 * {@link parameters} (reusing the same {@link ActionParameterDto} machinery as piece-type actions).
 * Private, organization-gated feature — see {@link OrganizationResponseDto.portsEnabled}.
 */
export interface PortResponseDto {
  id: number
  name: string
  pieceTypeId: number
  pieceTypeName: string | null
  pin: number | null
  position: number
  parameters: ActionParameterDto[]
}

export interface CreatePortDto {
  name: string
  pieceTypeId: number
  pin: number
  parameters: ActionParameterDto[]
}

export interface UpdatePortDto {
  name?: string
  pieceTypeId?: number
  pin?: number
  parameters?: ActionParameterDto[]
}

/**
 * A timeline (línea de tiempo) belonging to an organization. Identified by a {@link name} that is
 * unique within its organization; {@link createdAt}/{@link updatedAt} are managed automatically.
 */
export interface TimelineResponseDto {
  id: number
  organizationId: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface CreateTimelineDto {
  name: string
}

export interface UpdateTimelineDto {
  name?: string
}

export interface OrganizationPieceAttributeResponseDto {
  id: number
  name: string
  displayName: string
  type: AttributeType
  required: boolean
  position: number
  validators: AttributeValidatorsDto
}

export interface CreateOrganizationPieceAttributeDto {
  name: string
  displayName: string
  type: AttributeType
  required?: boolean
  position?: number
  validators?: AttributeValidatorsDto
}

export interface UpdateOrganizationPieceAttributeDto {
  name?: string
  displayName?: string
  type?: AttributeType
  required?: boolean
  position?: number
  validators?: AttributeValidatorsDto
}

export interface MemberResponseDto {
  id: number
  userId: number
  name: string
  lastName: string
  email: string
  role: OrganizationRole
}

export interface UpdateMemberRoleDto {
  role: OrganizationRole
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'

export interface OrganizationSummaryDto {
  id: number
  name: string
  slug: string
}

export interface InvitationResponseDto {
  id: number
  email: string
  role: OrganizationRole
  status: InvitationStatus
  expiresAt: string
  createdAt?: string | null
  acceptedAt?: string | null
  token: string | null
  organization: OrganizationSummaryDto
}

export interface CreateInvitationDto {
  email: string
  role: OrganizationRole
}

export interface ApiError {
  message?: string
  status?: number
  error?: string
  fieldErrors?: Record<string, string>
}

export type AvailabilityReason = 'TAKEN' | 'RESERVED' | 'INVALID_FORMAT'

export interface AvailabilityResponse {
  available: boolean
  reason: AvailabilityReason | null
}

// ---- Notification preferences -----------------------------------------

export type LifecycleAction = 'CREATED' | 'EDITED' | 'DELETED'

export type PieceScope = 'ALL' | 'OWNED_ONLY'

export interface NotificationPreferenceResponseDto {
  organizationId: number
  organizationName: string
  organizationSlug: string
  pieces: LifecycleAction[]
  pieceScope: PieceScope
  locations: LifecycleAction[]
  pieceTypes: LifecycleAction[]
}

export interface UpdateNotificationPreferenceDto {
  pieces: LifecycleAction[]
  pieceScope: PieceScope
  locations: LifecycleAction[]
  pieceTypes: LifecycleAction[]
}

// ---- Piece import / export ----------------------------------------------

/** File formats accepted by the bulk import/export endpoints. */
export type SpreadsheetFormat = 'csv' | 'xlsx'

/** Behaviour applied to a row whose serial number already exists. */
export type ImportMode = 'create' | 'upsert'

/** Outcome computed for a single import row. */
export type ImportRowAction = 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR'

export interface ImportRowResultDto {
  rowNumber: number
  action: ImportRowAction
  pieceId: number | null
  serialNumber: string | null
  name: string | null
  errors: string[]
}

export interface PieceImportReportDto {
  dryRun: boolean
  applied: boolean
  mode: ImportMode
  totalRows: number
  created: number
  updated: number
  skipped: number
  failed: number
  rows: ImportRowResultDto[]
  warnings: string[]
}
