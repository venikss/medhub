"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listSystemSettings, updateSystemSettings } from "@/features/admin/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { SystemSetting } from "@/types";

type SettingsMap = Record<string, string | number | boolean>;

function buildDefaults(settings: SystemSetting[]): SettingsMap {
  const map: SettingsMap = {};
  settings.forEach((setting) => {
    map[setting.key] = setting.value;
  });
  return map;
}

const CATEGORIES = ["general", "security", "notifications", "integrations"] as const;
type SettingCategory = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<SettingCategory, string> = {
  general: "General",
  security: "Security",
  notifications: "Notifications",
  integrations: "Integrations",
};

export default function SettingsPage() {
  const token = useAuthStore((state) => state.token);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [values, setValues] = useState<SettingsMap>({});
  const [savedKeys, setSavedKeys] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listSystemSettings(token ?? undefined)
      .then((loadedSettings) => {
        if (cancelled) {
          return;
        }
        setSettings(loadedSettings);
        setValues(buildDefaults(loadedSettings));
        setSavedKeys(loadedSettings.map((setting) => setting.key));
      })
      .catch(() => {
        if (!cancelled) {
          setSettings([]);
          setValues({});
          setSavedKeys([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const setValue = (key: string, value: string | number | boolean) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setSavedKeys((previous) => previous.filter((savedKey) => savedKey !== key));
  };

  const settingsByCategory = useMemo(() => {
    return Object.fromEntries(
      CATEGORIES.map((category) => [
        category,
        settings.filter((setting) => setting.category === category),
      ]),
    ) as Record<SettingCategory, SystemSetting[]>;
  }, [settings]);

  const saveCategory = async (category: SettingCategory) => {
    const keys = settingsByCategory[category].map((setting) => setting.key);
    const payload = Object.fromEntries(keys.map((key) => [key, values[key]]));
    await updateSystemSettings(payload, token ?? undefined);
    setSavedKeys((previous) => [...new Set([...previous, ...keys])]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Configure system-wide hospital settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          {CATEGORIES.map((category) => (
            <TabsTrigger key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((category) => {
          const categorySettings = settingsByCategory[category];
          const hasUnsaved = categorySettings.some((setting) => !savedKeys.includes(setting.key));

          return (
            <TabsContent key={category} value={category} className="mt-4 space-y-6">
              <div className="max-w-2xl space-y-5">
                {categorySettings.map((setting) => (
                  <div key={setting.key} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={setting.key} className="text-sm font-medium">
                        {setting.label}
                      </Label>
                      {setting.requiresRestart && (
                        <Badge variant="outline" className="gap-1 border-amber-400/50 text-xs text-amber-700">
                          <RefreshCw className="h-2.5 w-2.5" /> Restart
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{setting.description}</p>

                    {setting.type === "boolean" ? (
                      <Switch
                        id={setting.key}
                        checked={Boolean(values[setting.key])}
                        onCheckedChange={(value) => setValue(setting.key, value)}
                      />
                    ) : setting.type === "select" ? (
                      <Select
                        value={String(values[setting.key] ?? "")}
                        onValueChange={(value) => setValue(setting.key, value ?? "")}
                      >
                        <SelectTrigger id={setting.key} className="h-9 w-72 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(setting.options ?? []).map((option) => (
                            <SelectItem key={option} value={option} className="capitalize">
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : setting.type === "textarea" ? (
                      <Textarea
                        id={setting.key}
                        className="max-w-lg text-sm"
                        rows={3}
                        value={String(values[setting.key] ?? "")}
                        onChange={(event) => setValue(setting.key, event.target.value)}
                      />
                    ) : setting.type === "number" ? (
                      <Input
                        id={setting.key}
                        type="number"
                        className="h-9 w-32 text-sm"
                        value={Number(values[setting.key] ?? 0)}
                        onChange={(event) => setValue(setting.key, Number(event.target.value))}
                      />
                    ) : (
                      <Input
                        id={setting.key}
                        type="text"
                        className="h-9 w-full max-w-lg text-sm"
                        value={String(values[setting.key] ?? "")}
                        onChange={(event) => setValue(setting.key, event.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="max-w-2xl border-t border-border/40 pt-2">
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void saveCategory(category)}
                    disabled={!hasUnsaved}
                  >
                    <Save className="h-4 w-4" /> Save Changes
                  </Button>
                  {!hasUnsaved && (
                    <span className="text-xs font-medium text-emerald-600">All changes saved</span>
                  )}
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
