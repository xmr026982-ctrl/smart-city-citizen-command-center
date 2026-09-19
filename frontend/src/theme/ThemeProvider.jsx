import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "smart-city-theme";

export const THEMES = {
  LIGHT: "premium-white",
  DARK: "premium-dark",
};

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return THEMES.LIGHT;
  }

  const savedTheme = window.localStorage.getItem(STORAGE_KEY);

  if (Object.values(THEMES).includes(savedTheme)) {
    return savedTheme;
  }

  return THEMES.LIGHT;
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  const setTheme = useCallback((nextTheme) => {
    if (!Object.values(THEMES).includes(nextTheme)) {
      return;
    }

    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) =>
      currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT
    );
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isDark: theme === THEMES.DARK,
      isLight: theme === THEMES.LIGHT,
      themes: THEMES,
    }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}