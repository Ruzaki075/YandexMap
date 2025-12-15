import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

// Создаем кастомный хук для использования контекста
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
};