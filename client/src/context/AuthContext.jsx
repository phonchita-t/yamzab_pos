import { createContext, useContext, useState, useCallback } from 'react';
import { db } from '../lib/store.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => db.getSessionUser());

  const login = useCallback((username, password) => {
    const u = db.login(username, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    db.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
