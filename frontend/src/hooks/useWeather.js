/**
 * ECHO V4 — useWeather hook (frontend/src/hooks/useWeather.js)
 * Manages weather panel visibility and data.
 */
import { useState } from "react";

export function useWeather() {
    const [weatherData, setWeatherData] = useState(null);

    const onWeatherReceived = (data) => {
        if (data?.weather_data) {
            setWeatherData(data.weather_data);
        }
    };

    const clearWeather = () => setWeatherData(null);

    return { weatherData, onWeatherReceived, clearWeather };
}
