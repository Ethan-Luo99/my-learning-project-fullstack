interface User {
  id: string
  username: string
  avatar: string | null
  createdAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export const useAuth = () => {
  const state = useState<AuthState>('auth', () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false
  }))

  const token = computed(() => state.value.token)
  const user = computed(() => state.value.user)
  const isAuthenticated = computed(() => state.value.isAuthenticated)
  const isLoading = computed(() => state.value.isLoading)

  const initAuth = () => {
    if (process.client) {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser = localStorage.getItem(USER_KEY)

      if (storedToken && storedUser) {
        try {
          state.value.token = storedToken
          state.value.user = JSON.parse(storedUser)
          state.value.isAuthenticated = true
        } catch (e) {
          clearAuth()
        }
      }
    }
  }

  const setAuth = (newToken: string, newUser: User) => {
    state.value.token = newToken
    state.value.user = newUser
    state.value.isAuthenticated = true

    if (process.client) {
      localStorage.setItem(TOKEN_KEY, newToken)
      localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    }
  }

  const clearAuth = () => {
    state.value.token = null
    state.value.user = null
    state.value.isAuthenticated = false

    if (process.client) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  }

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    state.value.isLoading = true

    try {
      const result = await $fetch('/api/auth/login', {
        method: 'POST',
        body: {
          username,
          password
        }
      })

      if (result && (result as { success: boolean }).success) {
        const data = (result as { success: boolean; data: { user: User; token: string } }).data
        setAuth(data.token, data.user)
        return { success: true }
      } else {
        return {
          success: false,
          error: (result as { success: boolean; error: string }).error || 'Login failed'
        }
      }
    } catch (error: unknown) {
      const fetchError = error as { data?: { error?: string } }
      return {
        success: false,
        error: fetchError.data?.error || 'Network error'
      }
    } finally {
      state.value.isLoading = false
    }
  }

  const register = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    state.value.isLoading = true

    try {
      const result = await $fetch('/api/auth/register', {
        method: 'POST',
        body: {
          username,
          password
        }
      })

      if (result && (result as { success: boolean }).success) {
        const data = (result as { success: boolean; data: { user: User; token: string } }).data
        setAuth(data.token, data.user)
        return { success: true }
      } else {
        return {
          success: false,
          error: (result as { success: boolean; error: string }).error || 'Registration failed'
        }
      }
    } catch (error: unknown) {
      const fetchError = error as { data?: { error?: string } }
      return {
        success: false,
        error: fetchError.data?.error || 'Network error'
      }
    } finally {
      state.value.isLoading = false
    }
  }

  const logout = async (): Promise<{ success: boolean }> => {
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST'
      })
    } catch (error) {
      console.error('Logout API error:', error)
    }

    clearAuth()
    return { success: true }
  }

  const fetchCurrentUser = async (): Promise<{ success: boolean }> => {
    if (!state.value.token) {
      return { success: false }
    }

    try {
      const result = await $fetch('/api/auth/me', {
        headers: {
        Authorization: `Bearer ${state.value.token}`
      }
    })

      if (result && (result as { success: boolean }).success) {
        const data = (result as { success: boolean; data: User }).data
        state.value.user = data
        return { success: true }
      } else {
        clearAuth()
        return { success: false }
      }
    } catch (error) {
      clearAuth()
      return { success: false }
    }
  }

  const getAuthHeaders = (): Record<string, string> => {
    if (state.value.token) {
      return {
        Authorization: `Bearer ${state.value.token}`
      }
    }
    return {}
  }

  return {
    token,
    user,
    isAuthenticated,
    isLoading,
    initAuth,
    login,
    register,
    logout,
    fetchCurrentUser,
    getAuthHeaders,
    setAuth,
    clearAuth
  }
}
