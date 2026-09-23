import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.danielzapata.pomi',
  appName: 'Pomi',
  webDir: 'dist',
  backgroundColor: '#F3F0EA',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#F3F0EA',
    },
  },
}

export default config
