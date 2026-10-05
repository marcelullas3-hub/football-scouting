export function backendErrorMessage(error) {
  if (error?.status === 401 || error?.code === 'PGRST301') {
    return 'Tu sesión ha caducado. Inicia sesión de nuevo.'
  }
  if (error?.status === 403 || error?.code === '42501') {
    return 'No tienes permiso para consultar estos datos.'
  }
  return error?.message || 'No se pudieron cargar los datos.'
}