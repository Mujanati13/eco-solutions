import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import { authService } from '../services/authService'
import sessionManager from '../services/sessionManager'
import socketService from '../services/socketService'

const AuthContext = createContext()

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  loading: true,
  activeUsers: [],
  sessionDuration: 0,
}

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
      }
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        activeUsers: [],
        sessionDuration: 0,
      }
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      }
    case 'UPDATE_ACTIVE_USERS':
      return {
        ...state,
        activeUsers: action.payload,
      }
    case 'UPDATE_SESSION_DURATION':
      return {
        ...state,
        sessionDuration: action.payload,
      }
    default:
      return state
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const { t } = useTranslation()

  // Setup Socket.IO event listeners
  useEffect(() => {
    // Active users update
    socketService.on('activeUsersUpdate', (data) => {
      dispatch({
        type: 'UPDATE_ACTIVE_USERS',
        payload: data.users || [],
      })
    })

    // Session time update
    socketService.on('sessionTimeUpdate', (data) => {
      console.log('Session time updated:', data)
    })

    // Authentication events
    socketService.on('authenticated', (data) => {
      console.log('Socket authenticated:', data)
    })

    socketService.on('authError', (error) => {
      console.error('Socket auth error:', error)
      message.error(t('common.realTimeConnectionFailed'))
    })

    // Update session duration every second - DISABLED to prevent auto-refresh
    // const sessionTimer = setInterval(() => {
    //   if (socketService.isSocketConnected()) {
    //     const duration = socketService.getSessionDuration()
    //     dispatch({
    //       type: 'UPDATE_SESSION_DURATION',
    //       payload: duration,
    //     })
    //   }
    // }, 1000)

    // return () => {
    //   clearInterval(sessionTimer)
    // }
  }, [])

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const user = await authService.getCurrentUser()
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user, token },
          })
          
          // Start session management for existing session
          sessionManager.start()
          
          // Connect to Socket.IO with a small delay to ensure everything is ready
          setTimeout(() => {
            console.log('Connecting to Socket.IO...')
            socketService.connect(token)
          }, 500)
        } catch (error) {
          localStorage.removeItem('token')
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    initializeAuth()
  }, [])

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials)
      const { user, token } = response.data
      
      localStorage.setItem('token', token)
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user, token },
      })
      
      // Start session management
      sessionManager.start()
      
      // Connect to Socket.IO with a small delay
      setTimeout(() => {
        console.log('Connecting to Socket.IO after login...')
        socketService.connect(token)
      }, 500)
      
      message.success(t('common.loginSuccessful'))
      return { success: true }
    } catch (error) {
      const errorMessage = error.response?.data?.message || t('auth.loginFailed')
      message.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  const register = async (userData) => {
    try {
      const response = await authService.register(userData)
      message.success(t('common.registrationSuccessful'))
      return { success: true, data: response.data }
    } catch (error) {
      const errorMessage = error.response?.data?.message || t('auth.registrationFailed')
      message.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  const logout = async () => {
    try {
      // Stop session management first
      sessionManager.stop()
      
      // Disconnect Socket.IO
      socketService.disconnect()
      
      // Call logout API
      await authService.logout()
    } catch (error) {
      console.error('Logout API error:', error)
      // Continue with local logout even if API fails
    } finally {
      // Clean up local state
      localStorage.removeItem('token')
      dispatch({ type: 'LOGOUT' })
      message.success(t('common.logoutSuccessful'))
    }
  }

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData })
  }

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthProvider
