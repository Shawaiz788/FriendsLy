// themeManager.ts

type ThemeMode = 'dark' | 'light' | 'high-contrast';

type Themes = {
  [key: string]: ThemeMode;
};

const themes: Themes = {
  'sage-coral': 'dark',
  'sandy': 'light',
  'muted-night': 'high-contrast',
};

class ThemeManager {
  private currentTheme: string;

  constructor(defaultTheme: string) {
    this.currentTheme = defaultTheme;
    this.loadTheme();
  }

  private loadTheme() {
    const savedTheme = localStorage.getItem('app-theme') || this.currentTheme;
    this.applyTheme(savedTheme);
  }

  private applyTheme(theme: string) {
    const themeMode = themes[theme];
    if (themeMode) {
      document.body.className = themeMode;
      this.currentTheme = theme;
      localStorage.setItem('app-theme', theme);
    } else {
      console.warn(`Theme ${theme} is not defined.`);
    }
  }

  public switchTheme(theme: string) {
    this.applyTheme(theme);
  }
}

export default ThemeManager;