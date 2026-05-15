import type {
  NotificationPreferenceResponseDto,
  UpdateNotificationPreferenceDto
} from '~/types/api'

/**
 * Thin wrapper around the notification-preferences API. Exposes only the two calls the
 * settings screen needs; state lives in the calling component (one fetch per page visit)
 * so a Pinia store would be overkill.
 */
export function useNotificationPreferences() {
  const api = useApi()

  async function fetchAll(): Promise<NotificationPreferenceResponseDto[]> {
    return await api<NotificationPreferenceResponseDto[]>('/users/me/notification-preferences')
  }

  async function update(
    organizationId: number,
    payload: UpdateNotificationPreferenceDto
  ): Promise<NotificationPreferenceResponseDto> {
    return await api<NotificationPreferenceResponseDto>(
      `/users/me/notification-preferences/${organizationId}`,
      { method: 'PUT', body: payload }
    )
  }

  return { fetchAll, update }
}
