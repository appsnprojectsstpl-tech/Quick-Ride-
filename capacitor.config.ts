import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ff6bec1563cd442aadaa1640de648674',
  appName: 'RapidoClone',
  webDir: 'dist',
  server: {
    url: 'https://ff6bec15-63cd-442a-adaa-1640de648674.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFCC00',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#FFCC00',
    },
  },
};

export default config;