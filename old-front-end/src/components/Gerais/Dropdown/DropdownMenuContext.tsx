// DropdownMenuContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface DropdownMenuContextType {
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(undefined);

export function DropdownMenuProvider({ children }: { children: ReactNode }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  return (
    <DropdownMenuContext.Provider value={{ openMenuId, setOpenMenuId }}>
      {children}
    </DropdownMenuContext.Provider>
  );
}

export function useDropdownMenu() {
  const ctx = useContext(DropdownMenuContext);
  if (!ctx) throw new Error('useDropdownMenu deve ser usado dentro de DropdownMenuProvider');
  return ctx;
}