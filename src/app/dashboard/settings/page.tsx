"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, ShieldCheck, ShieldOff, Copy } from "lucide-react";

interface Provider {
  id: string;
  name: string;
}

interface SaveState {
  saving: boolean;
  success: boolean;
}

const defaultSaveState: SaveState = { saving: false, success: false };

export default function SettingsPage() {
  // Account
  const [adminUsername, setAdminUsername] = useState("admin");
  const [newUsername, setNewUsername] = useState("");
  const [accountState, setAccountState] = useState<SaveState>(defaultSaveState);

  // Change Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, setPasswordState] = useState<SaveState>(defaultSaveState);
  const [passwordError, setPasswordError] = useState("");

  // Global Rate Limit
  const [rateLimit, setRateLimit] = useState(60);
  const [rateLimitState, setRateLimitState] = useState<SaveState>(defaultSaveState);

  // Quota Alerts
  const [quotaThreshold, setQuotaThreshold] = useState(80);
  const [quotaState, setQuotaState] = useState<SaveState>(defaultSaveState);

  // Bulk Cookie Update
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [cookieData, setCookieData] = useState("");
  const [cookieState, setCookieState] = useState<SaveState>(defaultSaveState);

  // 2FA
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFASetupData, setTwoFASetupData] = useState<{
    qrCode: string;
    secret: string;
  } | null>(null);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAError, setTwoFAError] = useState("");
  const [twoFASuccess, setTwoFASuccess] = useState("");

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.rate_limit) setRateLimit(data.rate_limit);
        if (data.quota_threshold) setQuotaThreshold(data.quota_threshold);
        if (data.admin_username) {
          setAdminUsername(data.admin_username);
          setNewUsername(data.admin_username);
        }
        setTwoFAEnabled(!!data.twoFactorEnabled);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProviders();
    fetchSettings();
  }, [fetchProviders, fetchSettings]);

  async function saveSection(
    key: string,
    body: Record<string, unknown>,
    setState: (s: SaveState) => void
  ) {
    setState({ saving: true, success: false });
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: key, ...body }),
      });
      setState({ saving: false, success: res.ok });
      if (res.ok) {
        setTimeout(() => setState(defaultSaveState), 2000);
      }
      return res;
    } catch {
      setState({ saving: false, success: false });
      return null;
    }
  }

  async function handleAccountSave() {
    const res = await saveSection(
      "account",
      { username: newUsername },
      setAccountState
    );
    if (res?.ok) {
      setAdminUsername(newUsername);
    }
  }

  async function handlePasswordSave() {
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("两次密码输入不一致。");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("密码长度至少 8 个字符。");
      return;
    }
    const res = await saveSection(
      "password",
      { current_password: currentPassword, new_password: newPassword },
      setPasswordState
    );
    if (res && !res.ok) {
      const data = await res.json().catch(() => ({}));
      setPasswordError(data.message ?? "密码修改失败。");
    } else {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleRateLimitSave() {
    await saveSection("rate_limit", { rate_limit: rateLimit }, setRateLimitState);
  }

  async function handleQuotaSave() {
    await saveSection(
      "quota_alerts",
      { quota_threshold: quotaThreshold },
      setQuotaState
    );
  }

  async function handleCookieSave() {
    await saveSection(
      "bulk_cookies",
      { provider_id: selectedProvider, cookies: cookieData },
      setCookieState
    );
  }

  async function handle2FASetup() {
    setTwoFALoading(true);
    setTwoFAError("");
    setTwoFASuccess("");
    try {
      const res = await fetch("/api/admin/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFASetupData({ qrCode: data.qrCode, secret: data.secret });
      } else {
        setTwoFAError(data.error || "生成二维码失败");
      }
    } catch {
      setTwoFAError("网络错误");
    } finally {
      setTwoFALoading(false);
    }
  }

  async function handle2FAEnable() {
    if (!twoFACode || twoFACode.length !== 6) {
      setTwoFAError("请输入 6 位验证码");
      return;
    }
    setTwoFALoading(true);
    setTwoFAError("");
    try {
      const res = await fetch("/api/admin/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_and_enable", code: twoFACode }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFAEnabled(true);
        setTwoFASetupData(null);
        setTwoFACode("");
        setTwoFASuccess("双因素认证已成功启用");
        setTimeout(() => setTwoFASuccess(""), 3000);
      } else {
        setTwoFAError(data.error || "验证失败");
      }
    } catch {
      setTwoFAError("网络错误");
    } finally {
      setTwoFALoading(false);
    }
  }

  async function handle2FADisable() {
    if (!twoFACode || twoFACode.length !== 6) {
      setTwoFAError("请输入 6 位验证码以确认关闭");
      return;
    }
    setTwoFALoading(true);
    setTwoFAError("");
    try {
      const res = await fetch("/api/admin/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", code: twoFACode }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFAEnabled(false);
        setTwoFACode("");
        setTwoFASuccess("双因素认证已关闭");
        setTimeout(() => setTwoFASuccess(""), 3000);
      } else {
        setTwoFAError(data.error || "验证失败");
      }
    } catch {
      setTwoFAError("网络错误");
    } finally {
      setTwoFALoading(false);
    }
  }

  function handleCopySecret() {
    if (twoFASetupData?.secret) {
      navigator.clipboard.writeText(twoFASetupData.secret);
    }
  }

  function SaveButton({
    state,
    onClick,
    disabled,
    label,
  }: {
    state: SaveState;
    onClick: () => void;
    disabled?: boolean;
    label?: string;
  }) {
    return (
      <Button onClick={onClick} disabled={state.saving || disabled}>
        {state.saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : state.success ? (
          <Check className="mr-2 h-4 w-4 text-green-600" />
        ) : null}
        {state.success ? "已保存" : (label || "保存")}
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">系统设置</h1>

      {/* Account Username */}
      <Card>
        <CardHeader>
          <CardTitle>账号管理</CardTitle>
          <CardDescription>修改管理员用户名。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="s-username">用户名</Label>
            <Input
              id="s-username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="admin"
              className="w-60"
            />
            <p className="text-xs text-muted-foreground">
              当前用户名：{adminUsername}
            </p>
          </div>
          <SaveButton
            state={accountState}
            onClick={handleAccountSave}
            disabled={!newUsername || newUsername === adminUsername}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Change Admin Password */}
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>更新管理员账号密码。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="s-current-pw">当前密码</Label>
            <Input
              id="s-current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-new-pw">新密码</Label>
            <Input
              id="s-new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-confirm-pw">确认新密码</Label>
            <Input
              id="s-confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {passwordError && (
            <p className="text-sm text-destructive">{passwordError}</p>
          )}
          <SaveButton state={passwordState} onClick={handlePasswordSave} />
        </CardContent>
      </Card>

      <Separator />

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {twoFAEnabled ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
                双因素认证 (2FA)
              </CardTitle>
              <CardDescription className="mt-1">
                使用 Google Authenticator 等应用进行二次验证，增强账户安全性。
              </CardDescription>
            </div>
            <Badge variant={twoFAEnabled ? "default" : "secondary"}>
              {twoFAEnabled ? "已启用" : "未启用"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFASuccess && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <Check className="h-4 w-4" />
              {twoFASuccess}
            </p>
          )}
          {twoFAError && (
            <p className="text-sm text-destructive">{twoFAError}</p>
          )}

          {!twoFAEnabled && !twoFASetupData && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                启用后，每次登录除密码外还需输入动态验证码。
              </p>
              <Button onClick={handle2FASetup} disabled={twoFALoading}>
                {twoFALoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                启用 2FA
              </Button>
            </div>
          )}

          {!twoFAEnabled && twoFASetupData && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">
                  1. 使用 Google Authenticator 扫描二维码：
                </p>
                <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={twoFASetupData.qrCode}
                    alt="2FA QR Code"
                    width={200}
                    height={200}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">
                  2. 或手动输入密钥：
                </p>
                <div className="flex items-center gap-2">
                  <code className="px-3 py-2 bg-muted rounded text-sm font-mono tracking-wider">
                    {twoFASetupData.secret}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySecret}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">
                  3. 输入验证码完成绑定：
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))}
                    placeholder="6 位验证码"
                    className="w-40 text-center tracking-widest"
                  />
                  <Button onClick={handle2FAEnable} disabled={twoFALoading}>
                    {twoFALoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    验证并启用
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTwoFASetupData(null);
                      setTwoFACode("");
                      setTwoFAError("");
                    }}
                  >
                    取消
                  </Button>
                </div>
              </div>
            </div>
          )}

          {twoFAEnabled && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                关闭 2FA 需要验证当前动态码。
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6 位验证码"
                  className="w-40 text-center tracking-widest"
                />
                <Button
                  variant="destructive"
                  onClick={handle2FADisable}
                  disabled={twoFALoading}
                >
                  {twoFALoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  关闭 2FA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Global Rate Limit */}
      <Card>
        <CardHeader>
          <CardTitle>全局频率限制</CardTitle>
          <CardDescription>
            设置所有密钥的默认最大请求频率。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="s-rate-limit">每分钟请求数</Label>
            <Input
              id="s-rate-limit"
              type="number"
              className="w-40"
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value) || 0)}
            />
          </div>
          <SaveButton state={rateLimitState} onClick={handleRateLimitSave} />
        </CardContent>
      </Card>

      <Separator />

      {/* Quota Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>配额告警</CardTitle>
          <CardDescription>
            当 API 密钥用量超过月度配额的该百分比时发出告警。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="s-quota-thresh">告警阈值 (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="s-quota-thresh"
                type="number"
                className="w-24"
                min={1}
                max={100}
                value={quotaThreshold}
                onChange={(e) => setQuotaThreshold(parseInt(e.target.value) || 80)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <SaveButton state={quotaState} onClick={handleQuotaSave} />
        </CardContent>
      </Card>

      <Separator />

      {/* Bulk Cookie Update */}
      <Card>
        <CardHeader>
          <CardTitle>批量更新 Cookie</CardTitle>
          <CardDescription>
            批量更新服务商的认证 Cookie。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>服务商</Label>
            <Select value={selectedProvider} onValueChange={(val: string | null) => setSelectedProvider(val || "")}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="选择服务商" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-cookies">Cookie 数据 (JSON)</Label>
            <Textarea
              id="s-cookies"
              value={cookieData}
              onChange={(e) => setCookieData(e.target.value)}
              placeholder='[{"name": "session", "value": "..."}]'
              rows={6}
            />
          </div>
          <SaveButton
            state={cookieState}
            onClick={handleCookieSave}
            disabled={!selectedProvider}
          />
        </CardContent>
      </Card>
    </div>
  );
}
