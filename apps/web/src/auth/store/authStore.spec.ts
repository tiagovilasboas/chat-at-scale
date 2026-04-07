import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from './authStore';

// Mock chatStore since authStore imports it to call reset()
vi.mock('@/chat/store/chatStore', () => ({
  useChatStore: {
    getState: () => ({
      reset: vi.fn(),
    }),
  },
}));

describe('Auth Store (Zustand)', () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    const store = useAuthStore.getState();
    store.logout();
  });

  it('should start with no session', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.session).toBeNull();
  });

  it('should set session on login', () => {
    const { result } = renderHook(() => useAuthStore());
    
    const mockSession = { token: 'jwt123', userId: 'user-1', username: 'testuser' };
    
    act(() => {
      result.current.login(mockSession);
    });
    
    expect(result.current.session).toEqual(mockSession);
    
    // Check if it was persisted to localStorage
    const savedState = JSON.parse(localStorage.getItem('chat-auth') || '{}');
    expect(savedState.state.session).toEqual(mockSession);
  });

  it('should clear session on logout', async () => {
    const { result } = renderHook(() => useAuthStore());
    
    const mockSession = { token: 'jwt123', userId: 'user-1', username: 'testuser' };
    
    act(() => {
      result.current.login(mockSession);
    });
    
    expect(result.current.session).not.toBeNull();
    
    // Need to handle the async import in logout
    await act(async () => {
      result.current.logout();
    });
    
    expect(result.current.session).toBeNull();
  });
});
