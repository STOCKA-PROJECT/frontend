import type { OutputKind } from '~/types/contract'

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
  /** Same-origin path to open after verifying the email (carried in the verification link). */
  next?: string
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

export type PieceOwnerKind = 'USER' | 'CONTACT'

/**
 * Resumen del propietario embebido en las respuestas de pieza: `kind` indica si
 * `id` apunta a un miembro (userId) o a un contacto externo (contactId), y
 * `displayName` ya viene resuelto por el backend para pintar sin cruzar listas.
 */
export interface PieceOwnerSummaryDto {
  kind: PieceOwnerKind
  id: number
  displayName: string
  email?: string | null
}

export interface PieceListItemDto {
  id: number
  name: string
  serialNumber?: string | null
  pieceTypes: PieceTypeRefDto[]
  ownerUserId?: number
  ownerContactId?: number
  owner?: PieceOwnerSummaryDto | null
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

export type PieceAttachmentKind = 'IMAGE' | 'DOCUMENT' | 'AUDIO'

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
  /** Audio length measured by the browser when uploading (AUDIO only; null when unknown). */
  durationMs?: number | null
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
  ownerContactId?: number
  owner?: PieceOwnerSummaryDto | null
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
  ownerContactId?: number
  locationId?: number
  attributeValues?: AttributeValueInputDto[]
}

export interface UpdatePieceDto {
  name?: string
  serialNumber?: string | null
  description?: string
  pieceTypeIds?: number[]
  ownerUserId?: number
  ownerContactId?: number
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

/**
 * Filtro sobre un atributo personalizado (scope ORG o TYPE). La interpretación de `values`
 * depende del `AttributeType` del atributo (el backend lo resuelve por id):
 * - SELECT / BOOLEAN / MEMBER / MULTI_SELECT: lista de valores (OR entre ellos).
 * - TEXT / LONGTEXT / URL / EMAIL: términos "contiene" case-insensitive (OR entre ellos).
 * - INTEGER / DECIMAL / PRICE / DATE / DATETIME: exactamente `[min, max]`; '' = extremo abierto.
 */
export interface PieceAttributeFilter {
  scope: AttributeScope
  attributeId: number
  values: string[]
}

export interface PieceListFilters {
  typeIds?: number[]
  locationId?: number
  ownerUserId?: number
  ownerContactId?: number
  status?: PieceStatus
  q?: string
  attrs?: PieceAttributeFilter[]
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
  /** Output kind the type drives (catalog id), or null for inventory-only types. */
  kind?: OutputKind | null
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
  kind?: OutputKind | null
  attributes?: CreatePieceTypeAttributeDto[]
}

export interface UpdatePieceTypeDto {
  name?: string
  /** Changing the kind re-validates the type's actions; clearing it is not supported. */
  kind?: OutputKind
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
  /** Output kind from the catalog; immutable after creation. */
  kind: OutputKind
  /** Null for infrastructure ports (strips, expanders, sensors). */
  pieceTypeId: number | null
  pieceTypeName: string | null
  /** GPIO pin for kinds that have one (led_strip; relay and sensor unless on an expander); null otherwise. */
  pin: number | null
  /** Kind-specific keys validated against the catalog (never includes `pin`). */
  config: Record<string, unknown>
  position: number
  /** Legacy typed parameters; the show package only uses `config`. */
  parameters: ActionParameterDto[]
}

export interface CreatePortDto {
  name: string
  kind: OutputKind
  pieceTypeId?: number | null
  pin?: number | null
  config?: Record<string, unknown>
  parameters?: ActionParameterDto[]
}

export interface UpdatePortDto {
  name?: string
  /** Only the current kind is accepted: the kind of a port cannot change. */
  kind?: OutputKind
  pieceTypeId?: number | null
  pin?: number | null
  config?: Record<string, unknown>
  parameters?: ActionParameterDto[]
}

/**
 * An alert of the last heartbeat. Known codes: `motor_timeout` (a motor reached its hard time limit;
 * it may be locked), `sensor_stop_show` and `sensor_panic`. {@link message} comes ready-made in
 * Catalan from the player.
 */
export interface DeviceAlertDto {
  code: string
  /** Port the alert is about, if any. */
  port: string | null
  message: string | null
  /** ISO-8601 instant on the player's clock. */
  at: string | null
}

/** Player states reported by the Raspberry Pi in its heartbeat (`rpi4-system`). */
export type DeviceState = 'BOOT' | 'SAFE' | 'IDLE' | 'PLAYING' | 'TEST' | 'ERROR'

/**
 * A Raspberry Pi player registered in an organization, with the last state it reported through
 * its heartbeat. {@link online} is true while the last heartbeat is less than five minutes old.
 * Private, organization-gated feature like ports — see {@link OrganizationResponseDto.portsEnabled}.
 */
export interface DeviceResponseDto {
  id: number
  /** Identifier the player reports about itself; null until its first heartbeat. */
  deviceId: string | null
  name: string
  board: string
  /** Where the editor reaches the player on the local network (`http://belen.local:8080`). */
  localUrl?: string | null
  /** The player's PIN; null when none is saved or the caller is a SPECTATOR (see {@link hasPin}). */
  pin?: string | null
  hasPin?: boolean
  online: boolean
  lastSeenAt: string | null
  /** One of {@link DeviceState}; kept as a string so a state added later still renders. */
  lastState: string | null
  /** `sha256:…` hash of the show active on the player. */
  lastShowHash: string | null
  lastShowName: string | null
  /** Stocka timeline the active show was exported from (absent on older backends). */
  lastShowTimelineId?: number | null
  /** Names of the ports the player currently has cut (overrides). */
  lastOverrides: string[]
  /** Alerts of the last heartbeat (motor timeouts, sensors that stopped the show). */
  lastAlerts: DeviceAlertDto[]
  lastVersion: string | null
  lastIp: string | null
  lastError: string | null
  /** First characters of the heartbeat token, to tell tokens apart after a rotation. */
  tokenPrefix: string
  createdAt: string
}

/**
 * One log file of a player kept in Stocka (`GET /organizations/{slug}/devices/{id}/logs`). The player
 * uploads it itself when it has Internet and the belén app carries it when it has not.
 */
export interface DeviceLogFileDto {
  /** File name on the player, e.g. `system-2026-10-26.log`. */
  file: string
  /** Day of the file (`YYYY-MM-DD`). */
  day: string
  /** Bytes stored from the start of the file. */
  size: number
  /** Complete lines stored. */
  lines: number
  /** Time of the first and last line, in the player's local time (`YYYY-MM-DDTHH:MM:SS`). */
  firstAt: string | null
  lastAt: string | null
  /** When the last piece arrived. */
  syncedAt: string | null
}

/**
 * Result of registering a device or rotating its token. {@link heartbeatToken} is returned here
 * and never again: the UI shows it once with a copy button.
 */
export interface DeviceCreatedDto {
  device: DeviceResponseDto
  heartbeatToken: string
  heartbeatUrl: string
}

export interface CreateDeviceDto {
  name: string
  /** Optional; normalized by the backend (`belen.local` → `http://belen.local:8080`). */
  localUrl?: string | null
  /** Optional, 6 digits. */
  pin?: string | null
}

/** Every field is optional; an empty `localUrl` or `pin` removes it. */
export interface UpdateDeviceDto {
  name?: string
  localUrl?: string
  pin?: string
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

/** Body of `POST /timelines/{id}/duplicate`; without `name` the backend picks "<name> (còpia N)". */
export interface DuplicateTimelineDto {
  name?: string
}

/**
 * A validation finding on a timeline scene, as returned by the scene endpoints and inside the
 * 422 body of the bundle/show downloads when the scene has blocking errors.
 */
export interface SceneIssueDto {
  level: 'error' | 'warning'
  /** Stable code, e.g. `E_ACTION_UNKNOWN` or `W_CLIP_PAST_END`. */
  code: string
  message: string
  itemId?: string
  clipId?: string
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

export interface ContactResponseDto {
  id: number
  organizationId: number
  name: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
  linkedUserId?: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateContactDto {
  name: string
  lastName?: string
  email?: string
  phone?: string
  notes?: string
}

/** PATCH parcial: null/omitido deja el campo igual; cadena vacía limpia los opcionales. */
export interface UpdateContactDto {
  name?: string
  lastName?: string
  email?: string
  phone?: string
  notes?: string
}

export interface LinkContactDto {
  userId: number
  migratePieces?: boolean
}

export interface LinkContactResponseDto {
  contact: ContactResponseDto
  migratedPieces: number
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

/** How the notifications of an organization reach the user. */
export type NotificationDelivery = 'INSTANT' | 'BATCHED' | 'DAILY'

export interface NotificationPreferenceResponseDto {
  organizationId: number
  organizationName: string
  organizationSlug: string
  pieces: LifecycleAction[]
  pieceScope: PieceScope
  locations: LifecycleAction[]
  pieceTypes: LifecycleAction[]
  delivery: NotificationDelivery
}

export interface UpdateNotificationPreferenceDto {
  pieces: LifecycleAction[]
  pieceScope: PieceScope
  locations: LifecycleAction[]
  pieceTypes: LifecycleAction[]
  delivery: NotificationDelivery
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

/** State of the semantic (XEYE) index of an organization: `GET /organizations/{slug}/search/status`. */
export interface SearchStatusDto {
  organizationId: number
  /** Whether the server has the XEYE integration configured. */
  enabled: boolean
  /** Whether the organization already has its XEYE list. */
  indexed: boolean
  indexedPieces: number
  totalPieces: number
  trainingPending: boolean
  /** ISO date-time of the last training launch, or null. */
  lastTrainingLaunchedAt: string | null
}

/** An OAuth client (MCP connector) the user has authorized. */
export interface ConnectedApp {
  clientId: string
  name: string
  clientUri: string | null
  logoUri: string | null
  trusted: boolean
  registeredVia: 'CIMD' | 'DCR' | 'MANUAL' | 'UNKNOWN'
  scopes: string[]
  grantedAt: string | null
  lastUsedAt: string | null
  expiresAt: string | null
}
