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
}

export interface LoginUserDto {
  email: string
  password: string
}

export interface LoginResponseDto {
  token: string
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

export interface UpdateUserProfileDto {
  name?: string
  lastName?: string
  email?: string
  username?: string
  language?: Language
}

export interface OrganizationResponseDto {
  id: number
  name: string
  slug: string
  currentUserRole: OrganizationRole
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
  pieceTypes: PieceTypeRefDto[]
  ownerUserId?: number
  locationId?: number
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

export interface AttributeValueInputDto {
  attributeId: number
  value: string | null
}

export interface PieceAttributeValueResponseDto {
  attributeId: number
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
  description?: string
  pieceTypes: PieceTypeRefDto[]
  ownerUserId?: number
  locationId?: number
  status: PieceStatus
  createdAt: string
  updatedAt: string
  attributeValues: PieceAttributeValueResponseDto[]
  attachments: PieceAttachmentResponseDto[]
}

export interface CreatePieceDto {
  name: string
  description?: string
  pieceTypeIds: number[]
  ownerUserId?: number
  locationId?: number
  attributeValues?: AttributeValueInputDto[]
}

export interface UpdatePieceDto {
  name?: string
  description?: string
  pieceTypeIds?: number[]
  ownerUserId?: number
  clearOwner?: boolean
  locationId?: number
  clearLocation?: boolean
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
  displayName?: string
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
