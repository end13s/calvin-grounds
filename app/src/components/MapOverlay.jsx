import { useState, useEffect } from 'react'

const WMO_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

const WMO_DESCS = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Thunderstorm + hail',
}

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function useWeather() {
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast' +
          '?latitude=42.9634&longitude=-85.6681' +
          '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code' +
          '&temperature_unit=fahrenheit&wind_speed_unit=mph'
        )
        const json = await res.json()
        const c = json.current
        setWeather({
          tempF: Math.round(c.temperature_2m),
          humidity: c.relative_humidity_2m,
          windMph: Math.round(c.wind_speed_10m),
          code: c.weather_code,
        })
      } catch {
        // silently ignore — network or API issue
      }
    }
    load()
    const id = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return weather
}

export function MapOverlay({ openTaskCount, overdueCount }) {
  const now = useClock()
  const weather = useWeather()

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="map-overlay">
      <div className="overlay-clock">
        <span className="overlay-time">{timeStr}</span>
        <span className="overlay-date">{dateStr} · Grand Rapids, MI</span>
      </div>

      {weather ? (
        <div className="overlay-weather">
          <span className="overlay-weather-icon" title={WMO_DESCS[weather.code] ?? ''}>
            {WMO_ICONS[weather.code] ?? '🌤️'}
          </span>
          <div className="overlay-weather-info">
            <span className="overlay-temp">{weather.tempF}°F</span>
            <span className="overlay-desc">{WMO_DESCS[weather.code] ?? '—'}</span>
            <span className="overlay-wind">Wind {weather.windMph} mph · {weather.humidity}% humidity</span>
          </div>
        </div>
      ) : (
        <div className="overlay-weather">
          <span className="overlay-desc overlay-loading">Loading weather…</span>
        </div>
      )}

      <div className="overlay-tasks">
        <span className="overlay-tasks-count">{openTaskCount}</span>
        <span className="overlay-tasks-label">open task{openTaskCount !== 1 ? 's' : ''}</span>
        {overdueCount > 0 && (
          <span className="overlay-overdue">⚠ {overdueCount} overdue</span>
        )}
      </div>
    </div>
  )
}
