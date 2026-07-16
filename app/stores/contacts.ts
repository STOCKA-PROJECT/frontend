import { defineStore } from 'pinia'
import type {
  ContactResponseDto,
  CreateContactDto,
  LinkContactDto,
  LinkContactResponseDto,
  UpdateContactDto
} from '~/types/api'

/**
 * Directorio de contactos externos por organización: personas que no son
 * miembros (ni usuarios registrados) pero pueden ser propietarias de artículos.
 * Espejo de `team.ts`: caché por slug y refetch tras cada mutación.
 */
export const useContactsStore = defineStore('contacts', () => {
  const contactsByOrg = ref<Record<string, ContactResponseDto[]>>({})
  const loading = ref(false)

  async function fetchContacts(orgSlug: string) {
    const api = useApi()
    loading.value = true
    try {
      const data = await api<ContactResponseDto[]>(`/organizations/${orgSlug}/contacts`)
      contactsByOrg.value = { ...contactsByOrg.value, [orgSlug]: data }
      return data
    } finally {
      loading.value = false
    }
  }

  async function createContact(orgSlug: string, payload: CreateContactDto) {
    const api = useApi()
    const created = await api<ContactResponseDto>(`/organizations/${orgSlug}/contacts`, {
      method: 'POST',
      body: payload
    })
    await fetchContacts(orgSlug)
    return created
  }

  async function updateContact(orgSlug: string, contactId: number, payload: UpdateContactDto) {
    const api = useApi()
    const updated = await api<ContactResponseDto>(`/organizations/${orgSlug}/contacts/${contactId}`, {
      method: 'PATCH',
      body: payload
    })
    await fetchContacts(orgSlug)
    return updated
  }

  async function removeContact(orgSlug: string, contactId: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/contacts/${contactId}`, { method: 'DELETE' })
    await fetchContacts(orgSlug)
  }

  async function linkContact(orgSlug: string, contactId: number, payload: LinkContactDto) {
    const api = useApi()
    const result = await api<LinkContactResponseDto>(
      `/organizations/${orgSlug}/contacts/${contactId}/link`,
      { method: 'POST', body: payload }
    )
    await fetchContacts(orgSlug)
    return result
  }

  async function unlinkContact(orgSlug: string, contactId: number) {
    const api = useApi()
    const updated = await api<ContactResponseDto>(
      `/organizations/${orgSlug}/contacts/${contactId}/link`,
      { method: 'DELETE' }
    )
    await fetchContacts(orgSlug)
    return updated
  }

  function getContacts(orgSlug: string): ContactResponseDto[] | undefined {
    return contactsByOrg.value[orgSlug]
  }

  function reset() {
    contactsByOrg.value = {}
    loading.value = false
  }

  return {
    contactsByOrg,
    loading,
    fetchContacts,
    createContact,
    updateContact,
    removeContact,
    linkContact,
    unlinkContact,
    getContacts,
    reset
  }
})
