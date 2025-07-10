
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface WebhookConfig {
  url: string;
  apiKey: string;
  isEnabled: boolean;
  retryAttempts: number;
}

export interface ConfigData {
  matters: string[];
  costCentres: string[];
  businessAreas: string[];
  subcategories: string[];
  webhook: WebhookConfig;
}

interface ConfigContextType {
  config: ConfigData;
  updateConfig: (newConfig: Partial<ConfigData>) => void;
}

const defaultConfig: ConfigData = {
  matters: [
    'Client A - Project Alpha',
    'Client B - Project Beta',
    'Client C - Project Gamma',
    'Internal - Marketing',
    'Internal - Operations'
  ],
  costCentres: [
    'Development',
    'Marketing',
    'Sales',
    'Operations',
    'Administration'
  ],
  businessAreas: [
    'Software Development',
    'Client Relations',
    'Business Development',
    'Training & Education',
    'Administrative Tasks'
  ],
  subcategories: [
    'Meetings',
    'Documentation',
    'Research',
    'Planning',
    'Training',
    'Email Management'
  ],
  webhook: {
    url: '',
    apiKey: '',
    isEnabled: false,
    retryAttempts: 3
  }
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigData>(() => {
    const stored = localStorage.getItem('timeTracker_config');
    return stored ? JSON.parse(stored) : defaultConfig;
  });

  const updateConfig = (newConfig: Partial<ConfigData>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('timeTracker_config', JSON.stringify(updated));
  };

  return (
    <ConfigContext.Provider value={{ config, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
