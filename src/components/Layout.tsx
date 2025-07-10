
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ChatInterface } from './ChatInterface';
import { AdminPanel } from './AdminPanel';
import { LogOut, Settings, MessageSquare, Shield } from 'lucide-react';

export function Layout() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = React.useState<'chat' | 'admin'>('chat');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold">TimeTracker AI</h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <Button
                variant={currentView === 'chat' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('chat')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </Button>
              {user?.role === 'admin' && (
                <Button
                  variant={currentView === 'admin' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('admin')}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-600">Welcome,</span>
              <span className="font-medium">{user?.name}</span>
              {user?.role === 'admin' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  Admin
                </span>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {currentView === 'chat' ? <ChatInterface /> : <AdminPanel />}
      </main>
    </div>
  );
}
