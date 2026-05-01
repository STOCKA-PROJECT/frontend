import { defineStore } from 'pinia'
import type {
  CreateInvitationDto,
  InvitationResponseDto,
  MemberResponseDto,
  OrganizationRole
} from '~/types/api'

export const useTeamStore = defineStore('team', () => {
  const membersByOrg = ref<Record<number, MemberResponseDto[]>>({})
  const invitationsByOrg = ref<Record<number, InvitationResponseDto[]>>({})
  const loadingMembers = ref(false)
  const loadingInvitations = ref(false)

  async function fetchMembers(orgId: number) {
    const api = useApi()
    loadingMembers.value = true
    try {
      const data = await api<MemberResponseDto[]>(`/organizations/${orgId}/members`)
      membersByOrg.value = { ...membersByOrg.value, [orgId]: data }
      return data
    } finally {
      loadingMembers.value = false
    }
  }

  async function fetchInvitations(orgId: number) {
    const api = useApi()
    loadingInvitations.value = true
    try {
      const data = await api<InvitationResponseDto[]>(`/organizations/${orgId}/invitations`)
      invitationsByOrg.value = { ...invitationsByOrg.value, [orgId]: data }
      return data
    } finally {
      loadingInvitations.value = false
    }
  }

  async function invite(orgId: number, payload: CreateInvitationDto) {
    const api = useApi()
    const created = await api<InvitationResponseDto>(`/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: payload
    })
    await fetchInvitations(orgId)
    return created
  }

  async function updateRole(orgId: number, memberId: number, role: OrganizationRole) {
    const api = useApi()
    const updated = await api<MemberResponseDto>(`/organizations/${orgId}/members/${memberId}`, {
      method: 'PATCH',
      body: { role }
    })
    await fetchMembers(orgId)
    return updated
  }

  async function removeMember(orgId: number, memberId: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' })
    await fetchMembers(orgId)
  }

  async function cancelInvitation(orgId: number, invitationId: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/invitations/${invitationId}`, { method: 'DELETE' })
    await fetchInvitations(orgId)
  }

  async function leaveOrg(orgId: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/members/me`, { method: 'DELETE' })
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

  function getMembers(orgId: number): MemberResponseDto[] | undefined {
    return membersByOrg.value[orgId]
  }

  function getInvitations(orgId: number): InvitationResponseDto[] | undefined {
    return invitationsByOrg.value[orgId]
  }

  function reset() {
    membersByOrg.value = {}
    invitationsByOrg.value = {}
    loadingMembers.value = false
    loadingInvitations.value = false
  }

  return {
    membersByOrg,
    invitationsByOrg,
    loadingMembers,
    loadingInvitations,
    fetchMembers,
    fetchInvitations,
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
