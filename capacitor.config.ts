import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alfonso207.sistemaalertas',
  appName: 'ALERTA CERCA',
  webDir: 'dist',
  android: {
    // Necesario para que el aviso de ubicación en segundo plano siga vivo.
    useLegacyBridge: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0F172A',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      iconColor: '#1D4ED8',
    },
  },
};

export default config;
