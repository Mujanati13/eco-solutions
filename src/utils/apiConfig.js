/**
 * API URL utilities for making direct fetch calls
 */

// Get the base API URL from environment variables
export const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
}

// Get the full API URL for a given endpoint
export const getApiUrl = (endpoint) => {
  const baseUrl = getApiBaseUrl()
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${baseUrl}${cleanEndpoint}`
}

// Get the socket URL
export const getSocketUrl = () => {
  return import.meta.env.VITE_SOCKET_URL || 
         import.meta.env.VITE_API_BASE_URL || 
         'http://localhost:3000'
}

export default {
  getApiBaseUrl,
  getApiUrl,
  getSocketUrl,
}
