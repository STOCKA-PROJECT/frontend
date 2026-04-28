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

export interface PieceListItemDto {
  id: number
  name: string
  pieceTypeId: number
  pieceTypeName: string
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

export interface MemberResponseDto {
  id: number
  userId: number
  name: string
  lastName: string
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
