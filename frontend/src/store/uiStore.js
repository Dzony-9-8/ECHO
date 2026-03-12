/**
 * ECHO V4 — Global UI Store (frontend/src/store/uiStore.js)
 * Simple React context store for shared UI state.
 * No external dependency — keeps the bundle small.
 */
import { createContext, useContext, useState } from "react";

const UIStore = createContext(null);

export function UIStoreProvider({ children }) {
    const [webSearch, setWebSearch] = useState(false);
    const [ragEnabled, setRagEnabled] = useState(false);
    const [weatherEnabled, setWeatherEnabled] = useState(false);
    const [deepResearch, setDeepResearch] = useState(false);
    const [researchDepth, setResearchDepth] = useState(0);
    const [currentMode, setCurrentMode] = useState("chat");
    const [searchProvider, setSearchProvider] = useState("duckduckgo");
    const [showSettings, setShowSettings] = useState(false);
    const [showInsight, setShowInsight] = useState(false);

    const value = {
        webSearch, setWebSearch,
        ragEnabled, setRagEnabled,
        weatherEnabled, setWeatherEnabled,
        deepResearch, setDeepResearch,
        researchDepth, setResearchDepth,
        currentMode, setCurrentMode,
        searchProvider, setSearchProvider,
        showSettings, setShowSettings,
        showInsight, setShowInsight,
    };

    return <UIStore.Provider value={value}>{children}</UIStore.Provider>;
}

export function useUIStore() {
    const ctx = useContext(UIStore);
    if (!ctx) throw new Error("useUIStore must be used inside <UIStoreProvider>");
    return ctx;
}
