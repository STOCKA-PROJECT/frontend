import { defineStore } from 'pinia'
import type {
  CreateInvitationDto,
  InvitationResponseDto,
  MemberResponseDto,
  OrganizationRole
} from '~/types/api'

export const useTeamStore = defineStore('team', () => {
  const membersByOrg = ref<Record<string, MemberResponseDto[]>>({})
  const invitationsByOrg = ref<Record<string, InvitationResponseDto[]>>({})
  const myInvitations = ref<InvitationResponseDto[]>([])
  const loadingMembers = ref(false)
  const loadingInvitations = ref(false)
  const loadingMyInvitations = ref(false)
  const myInvitationsLoaded = ref(false)

  const myPendingInvitationsCount = computed(
    () => myInvitations.value.filter(i => i.status === 'PENDING').length
  )

  async function fetchMembers(orgSlug: string) {
    const api = useApi()
    loadingMembers.value = true
    try {
      const data = await api<MemberResponseDto[]>(`/organizations/${orgSlug}/members`)
      membersByOrg.value = { ...membersByOrg.value, [orgSlug]: data }
      return data
    } finally {
      loadingMembers.value = false
    }
  }

  async function fetchInvitations(orgSlug: string) {
    const api = useApi()
    loadingInvitations.value = true
    try {
      const data = await api<InvitationResponseDto[]>(`/organizations/${orgSlug}/invitations`)
      invitationsByOrg.value = { ...invitationsByOrg.value, [orgSlug]: data }
      return data
    } finally {
      loadingInvitations.value = false
    }
  }

  async function invite(orgSlug: string, payload: CreateInvitationDto) {
    const api = useApi()
    const created = await api<InvitationResponseDto>(`/organizations/${orgSlug}/invitations`, {
      method: 'POST',
      body: payload
    })
    await fetchInvitations(orgSlug)
    return created
  }

  async function updateRole(orgSlug: string, memberId: number, role: OrganizationRole) {
    const api = useApi()
    const updated = await api<MemberResponseDto>(`/organizations/${orgSlug}/members/${memberId}`, {
      method: 'PATCH',
      body: { role }
    })
    await fetchMembers(orgSlug)
    return updated
  }

  async function removeMember(orgSlug: string, memberId: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/members/${memberId}`, { method: 'DELETE' })
    await fetchMembers(orgSlug)
  }

  async function cancelInvitation(orgSlug: string, invitationId: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/invitations/${invitationId}`, { method: 'DELETE' })
    await fetchInvitations(orgSlug)
  }

  async function leaveOrg(orgSlug: string) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/members/me`, { method: 'DELETE' })
  }

  async function acceptInvitation(token: string) {
    const api = useApi()
    return await api<InvitationResponseDto>(`/invitations/${encodeURIComponent(token)}/accept`, {
      method: 'POST'
    })
  }

  async function rejectInvitation(token: string) {
    const api = useApi()
    return await api<InvitationResponseDto>(`/invitations/${encodeURIComponent(token)}/reject`, {
      method: 'POST'
    })
  }

  async function fetchMyInvitations(options?: { includeHistory?: boolean }) {
    const api = useApi()
    loadingMyInvitations.value = true
    try {
      const data = await api<InvitationResponseDto[]>('/invitations/me', {
        query: { includeHistory: options?.includeHistory ? 'true' : 'false' }
      })
      myInvitations.value = data
      myInvitationsLoaded.value = true
      return data
    } finally {
      loadingMyInvitations.value = false
    }
  }

  function getMembers(orgSlug: string): MemberResponseDto[] | undefined {
    return membersByOrg.value[orgSlug]
  }

  function getInvitations(orgSlug: string): InvitationResponseDto[] | undefined {
    return invitationsByOrg.value[orgSlug]
  }

  function reset() {
    membersByOrg.value = {}
    invitationsByOrg.value = {}
    myInvitations.value = []
    myInvitationsLoaded.value = false
    loadingMembers.value = false
    loadingInvitations.value = false
    loadingMyInvitations.value = false
  }

  return {
    membersByOrg,
    invitationsByOrg,
    myInvitations,
    myInvitationsLoaded,
    myPendingInvitationsCount,
    loadingMembers,
    loadingInvitations,
    loadingMyInvitations,
    fetchMembers,
    fetchInvitations,
    fetchMyInvitations,
    invite,
    updateRole,
    removeMember,
    cancelInvitation,
    leaveOrg,
    acceptInvitation,
    rejectInvitation,
    getMembers,
    getInvitations,
    reset
  }
})
