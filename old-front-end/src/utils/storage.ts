export const localStorageEffect =
  <T,>(key: string) =>
  ({ onSet }: { onSet: (callback: (newValue: T) => void) => void }) => {
    onSet((newValue) => {
      try {
        if (newValue == null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(newValue));
        }
      } catch {
        // silent
      }
    });
  };

export const readLocalStorage = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};