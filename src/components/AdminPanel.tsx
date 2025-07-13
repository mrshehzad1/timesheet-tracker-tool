import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfig } from '@/contexts/ConfigContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Users, Settings, Webhook, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserManagement } from './UserManagement';

interface WebhookConfig {
  id?: string;
  url: string;
  api_key: string | null;
  is_enabled: boolean;
  retry_attempts: number;
}

export function AdminPanel() {
  const { config, updateConfig } = useConfig();
  const { toast } = useToast();
  
  const [newMatter, setNewMatter] = useState('');
  const [newCostCentre, setNewCostCentre] = useState('');
  const [newBusinessArea, setNewBusinessArea] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    url: '',
    api_key: '',
    is_enabled: false,
    retry_attempts: 3
  });
  const [webhookLoading, setWebhookLoading] = useState(true);

  useEffect(() => {
    fetchWebhookConfig();
    fetchAppConfig();
  }, []);

  const fetchWebhookConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWebhookConfig({
          id: data.id,
          url: data.url,
          api_key: data.api_key,
          is_enabled: data.is_enabled,
          retry_attempts: data.retry_attempts
        });
      }
    } catch (error) {
      console.error('Error fetching webhook config:', error);
    } finally {
      setWebhookLoading(false);
    }
  };

  const fetchAppConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('*');

      if (error) throw error;

      if (data) {
        const configData: any = {};
        data.forEach(item => {
          configData[item.config_key] = item.config_value;
        });

        updateConfig({
          matters: configData.matters || config.matters,
          costCentres: configData.cost_centres || config.costCentres,
          businessAreas: configData.business_areas || config.businessAreas,
          subcategories: configData.subcategories || config.subcategories,
          webhook: config.webhook
        });
      }
    } catch (error) {
      console.error('Error fetching app config:', error);
    }
  };

  const saveAppConfig = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ config_key: key, config_value: value });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving app config:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration to database",
        variant: "destructive"
      });
    }
  };

  const addItem = async (list: string[], newItem: string, setNewItem: (value: string) => void, key: keyof typeof config) => {
    if (newItem.trim()) {
      const updatedList = [...list, newItem.trim()];
      updateConfig({ [key]: updatedList });
      
      // Save to database
      const dbKey = key === 'costCentres' ? 'cost_centres' : 
                   key === 'businessAreas' ? 'business_areas' : 
                   key;
      await saveAppConfig(dbKey as string, updatedList);
      
      setNewItem('');
      toast({
        title: "Item Added",
        description: `Successfully added "${newItem}" to the list.`,
      });
    }
  };

  const removeItem = async (list: string[], index: number, key: keyof typeof config) => {
    const updatedList = list.filter((_, i) => i !== index);
    updateConfig({ [key]: updatedList });
    
    // Save to database
    const dbKey = key === 'costCentres' ? 'cost_centres' : 
                 key === 'businessAreas' ? 'business_areas' : 
                 key;
    await saveAppConfig(dbKey as string, updatedList);
    
    toast({
      title: "Item Removed",
      description: "Item has been removed from the list.",
    });
  };

  const saveWebhookConfig = async () => {
    try {
      const webhookData = {
        url: webhookConfig.url,
        api_key: webhookConfig.api_key,
        is_enabled: webhookConfig.is_enabled,
        retry_attempts: webhookConfig.retry_attempts
      };

      let result;
      if (webhookConfig.id) {
        // Update existing config
        result = await supabase
          .from('webhook_config')
          .update(webhookData)
          .eq('id', webhookConfig.id);
      } else {
        // Insert new config
        result = await supabase
          .from('webhook_config')
          .insert([webhookData])
          .select()
          .single();
        
        if (result.data) {
          setWebhookConfig(prev => ({ ...prev, id: result.data.id }));
        }
      }

      if (result.error) throw result.error;

      // Also update local config context
      updateConfig({
        webhook: {
          url: webhookConfig.url,
          apiKey: webhookConfig.api_key || '',
          isEnabled: webhookConfig.is_enabled,
          retryAttempts: webhookConfig.retry_attempts
        }
      });

      toast({
        title: "Webhook Configuration Saved",
        description: "Your webhook settings have been saved to the database.",
      });
    } catch (error) {
      console.error('Error saving webhook config:', error);
      toast({
        title: "Error",
        description: "Failed to save webhook configuration",
        variant: "destructive"
      });
    }
  };

  const testWebhook = async () => {
    try {
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        message: "This is a test webhook from TimeTracker AI"
      };

      const response = await fetch(webhookConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookConfig.api_key}`
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        toast({
          title: "Webhook Test Successful",
          description: "The webhook endpoint responded successfully.",
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Webhook Test Failed",
        description: "The webhook endpoint could not be reached or returned an error.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, configuration lists, and system settings.</p>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config">
            <Database className="w-4 h-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="webhook">
            <Webhook className="w-4 h-4 mr-2" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Matters */}
            <Card>
              <CardHeader>
                <CardTitle>Matters/Clients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Add new matter/client"
                    value={newMatter}
                    onChange={(e) => setNewMatter(e.target.value)}
                  />
                  <Button onClick={() => addItem(config.matters, newMatter, setNewMatter, 'matters')}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {config.matters.map((matter, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{matter}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(config.matters, index, 'matters')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cost Centres */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Centres</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Add new cost centre"
                    value={newCostCentre}
                    onChange={(e) => setNewCostCentre(e.target.value)}
                  />
                  <Button onClick={() => addItem(config.costCentres, newCostCentre, setNewCostCentre, 'costCentres')}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {config.costCentres.map((centre, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{centre}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(config.costCentres, index, 'costCentres')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Business Areas */}
            <Card>
              <CardHeader>
                <CardTitle>Business Areas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Add new business area"
                    value={newBusinessArea}
                    onChange={(e) => setNewBusinessArea(e.target.value)}
                  />
                  <Button onClick={() => addItem(config.businessAreas, newBusinessArea, setNewBusinessArea, 'businessAreas')}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {config.businessAreas.map((area, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{area}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(config.businessAreas, index, 'businessAreas')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Subcategories */}
            <Card>
              <CardHeader>
                <CardTitle>Subcategories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Add new subcategory"
                    value={newSubcategory}
                    onChange={(e) => setNewSubcategory(e.target.value)}
                  />
                  <Button onClick={() => addItem(config.subcategories, newSubcategory, setNewSubcategory, 'subcategories')}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {config.subcategories.map((subcategory, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{subcategory}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(config.subcategories, index, 'subcategories')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <p className="text-muted-foreground">Configure webhook settings for external integrations</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {webhookLoading ? (
                <p>Loading webhook configuration...</p>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={webhookConfig.is_enabled}
                      onCheckedChange={(checked) => setWebhookConfig(prev => ({ ...prev, is_enabled: checked }))}
                    />
                    <Label>Enable Webhook</Label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="webhook-url">Webhook URL</Label>
                      <Input
                        id="webhook-url"
                        placeholder="https://your-automation-endpoint.com/webhook"
                        value={webhookConfig.url}
                        onChange={(e) => setWebhookConfig(prev => ({ ...prev, url: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="webhook-api-key">API Key</Label>
                      <Input
                        id="webhook-api-key"
                        type="password"
                        placeholder="Your webhook API key"
                        value={webhookConfig.api_key || ''}
                        onChange={(e) => setWebhookConfig(prev => ({ ...prev, api_key: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <Button onClick={saveWebhookConfig}>
                      Save Configuration
                    </Button>
                    <Button variant="outline" onClick={testWebhook} disabled={!webhookConfig.url}>
                      Test Webhook
                    </Button>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Webhook Payload Format</h4>
                    <pre className="text-xs bg-white p-3 rounded border overflow-auto">
{`{
  "user_id": "uuid",
  "user_name": "string",
  "user_email": "string",
  "timestamp": "ISO8601",
  "time_entry": {
    "task_description": "string",
    "duration_minutes": "integer",
    "start_time": "ISO8601",
    "work_type": "billable|non_billable|personal",
    "matter_name": "string",
    "cost_centre_name": "string",
    "business_area_name": "string",
    "subcategory_name": "string",
    "enjoyment_level": "string",
    "energy_impact": "string",
    "task_goal": "string"
  }
}`}
                    </pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
