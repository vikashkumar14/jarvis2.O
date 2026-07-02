import { IpcMain } from 'electron'

function mapWeatherCode(code: number | undefined) {
  if (code == null) return 'Unknown'
  // Simplified mapping based on Open-Meteo weather codes
  if (code === 0) return 'Clear'
  if (code === 1 || code === 2 || code === 3) return 'Partly Cloudy'
  if (code >= 45 && code <= 48) return 'Fog'
  if (code >= 51 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 86) return 'Rain'
  if (code >= 95) return 'Thunderstorm'
  return 'Cloudy'
}

export default function registerWeatherHandlers(ipcMain: IpcMain) {
  ipcMain.removeHandler('get-weather')

  ipcMain.handle('get-weather', async () => {
    try {
      // Try to obtain coarse location via IP lookup
      const ipRes = await fetch('http://ip-api.com/json/')
      const ipData = await ipRes.json()

      const lat = ipData?.lat
      const lon = ipData?.lon

      if (!lat || !lon) return null

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
          lat
        )}&longitude=${encodeURIComponent(lon)}&current_weather=true&timezone=auto`
      )
      const weatherData = await weatherRes.json()

      const current = weatherData.current_weather || {}
      const temp = current.temperature ?? null
      const wind = current.windspeed ?? null
      const code = current.weathercode

      return {
        temp,
        condition: mapWeatherCode(code),
        humidity: null,
        wind,
        feelsLike: temp
      }
    } catch (error) {
      return null
    }
  })
}
