import React, { useState } from 'react';

const WeatherPanel = ({ location, current, forecast, onClose }) => {
    const [collapsed, setCollapsed] = useState(false);

    if (!current) return null;

    const getWeatherIcon = (code) => {
        if (code === 0) return "☀️";
        if (code >= 1 && code <= 3) return "🌤";
        if (code === 45 || code === 48) return "🌫";
        if (code >= 51 && code <= 67) return "🌧";
        if (code >= 71 && code <= 77) return "❄️";
        if (code >= 80 && code <= 82) return "🌧";
        if (code >= 85 && code <= 86) return "❄️";
        if (code >= 95) return "⛈";
        return "☁️";
    };

    return (
        <div className={`weather-panel ${collapsed ? 'collapsed' : ''}`}>
            <div className="weather-header" onClick={() => setCollapsed(!collapsed)}>
                <div className="weather-header-left">
                    <span className="weather-icon">{getWeatherIcon(current.weathercode)}</span>
                    <span className="weather-temp">{current.temperature}°C</span>
                    <span className="weather-loc">{location}</span>
                </div>
                <div className="weather-controls">
                    <button className="collapse-btn">{collapsed ? '▼' : '▲'}</button>
                    <button className="close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
                </div>
            </div>

            {!collapsed && (
                <div className="weather-body">
                    <div className="weather-details">
                        <p>{current.description || 'Current Conditions'}</p>
                        <p>💨 Wind: {current.windspeed} km/h</p>
                    </div>

                    {forecast && forecast.length > 0 && (
                        <div className="weather-forecast">
                            <h4>7-Day Forecast</h4>
                            <div className="forecast-scroll">
                                {forecast.map((day, idx) => (
                                    <div key={idx} className="forecast-day">
                                        <div className="day-name">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                        <div className="day-icon">{getWeatherIcon(day.weathercode)}</div>
                                        <div className="day-temps">
                                            <span className="temp-max">{Math.round(day.temp_max)}°</span>
                                            <span className="temp-min">{Math.round(day.temp_min)}°</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .weather-panel {
                    position: fixed;
                    right: 20px;
                    bottom: 20px;
                    width: 300px;
                    background: rgba(30, 30, 30, 0.95);
                    border: 1px solid #444;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    color: #fff;
                    font-family: inherit;
                    z-index: 1000;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                .weather-panel.collapsed {
                    width: auto;
                    min-width: 200px;
                }
                .weather-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    cursor: pointer;
                    background: rgba(45, 45, 45, 0.95);
                }
                .weather-header:hover {
                    background: rgba(55, 55, 55, 0.95);
                }
                .weather-header-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .weather-icon {
                    font-size: 1.5rem;
                }
                .weather-temp {
                    font-size: 1.2rem;
                    font-weight: bold;
                }
                .weather-loc {
                    font-size: 1rem;
                    color: #aaa;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 120px;
                }
                .weather-controls {
                    display: flex;
                    gap: 8px;
                }
                .collapse-btn, .close-btn {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    font-size: 1rem;
                    padding: 2px 6px;
                }
                .collapse-btn:hover, .close-btn:hover {
                    color: #fff;
                }
                .weather-body {
                    padding: 16px;
                    border-top: 1px solid #333;
                }
                .weather-details {
                    margin-bottom: 16px;
                    font-size: 0.9rem;
                    color: #ccc;
                }
                .weather-details p {
                    margin: 4px 0;
                }
                .weather-forecast h4 {
                    margin: 0 0 10px 0;
                    font-size: 0.85rem;
                    color: #888;
                    text-transform: uppercase;
                }
                .forecast-scroll {
                    display: flex;
                    gap: 12px;
                    overflow-x: auto;
                    padding-bottom: 8px;
                }
                .forecast-scroll::-webkit-scrollbar {
                    height: 4px;
                }
                .forecast-scroll::-webkit-scrollbar-track {
                    background: #222;
                }
                .forecast-scroll::-webkit-scrollbar-thumb {
                    background: #555;
                    border-radius: 4px;
                }
                .forecast-day {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    min-width: 45px;
                }
                .day-name {
                    font-size: 0.8rem;
                    color: #aaa;
                }
                .day-icon {
                    font-size: 1.2rem;
                    margin: 4px 0;
                }
                .day-temps {
                    display: flex;
                    gap: 4px;
                    font-size: 0.8rem;
                }
                .temp-max {
                    color: #fff;
                }
                .temp-min {
                    color: #888;
                }
            `}</style>
        </div>
    );
};

export default WeatherPanel;
