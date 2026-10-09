import { Capacitor } from '@capacitor/core';

/** true dentro de la app nativa (Android/iOS); false en el navegador (`npm run dev`). */
export const esNativo = Capacitor.isNativePlatform();

export const plataforma = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
