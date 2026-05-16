"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  Loader2,
  ExternalLink,
  ClipboardPaste,
} from "lucide-react";
import {
  normalizeAuthInput,
  serializeAuthData,
  describeAuthData,
  formatAuthDataForEdit,
  type CustomEndpoints,
} from "@/lib/auth-data";
import {
  isCustomProvider,
  isWebChatProvider,
  validateCustomProviderSlug,
} from "@/lib/models/catalog";

interface Provider {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  authType: "cookie" | "token" | "api_key";
  authData: string;
  status: "active" | "inactive" | "error";
  lastCheckedAt: string | null;
}

type ProviderForm = Omit<Provider, "id" | "lastCheckedAt"> & {
  chatEndpoint: string;
  modelsEndpoint: string;
};

const DEFAULT_CHAT_ENDPOINT = "/v1/chat/completions";
const DEFAULT_MODELS_ENDPOINT = "/v1/models";
const COOKIE_EDITOR_URL =
  "https://chromewebstore.google.com/detail/cookie-editor/ookdjilphngeeeghgngjabigmpepanpl?hl=zh-CN&utm_source=ext_sidebar";
const POPUP_FEATURES =
  "popup=yes,width=520,height=780,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes";

const emptyForm: ProviderForm = {
  name: "",
  slug: "",
  baseUrl: "",
  authType: "cookie",
  authData: "",
  status: "active",
  chatEndpoint: DEFAULT_CHAT_ENDPOINT,
  modelsEndpoint: DEFAULT_MODELS_ENDPOINT,
};

function isCustomFormState(
  slug: string,
  template: string
): boolean {
  return template === "custom" || (!!slug && isCustomProvider(slug));
}

function endpointsFromAuthRaw(authData: string): CustomEndpoints {
  if (!authData.trim()) return {};
  try {
    const parsed = JSON.parse(authData) as { endpoints?: CustomEndpoints };
    return parsed.endpoints ?? {};
  } catch {
    return {};
  }
}

function buildAuthPayload(form: ProviderForm, template: string): string {
  const normalized = normalizeAuthInput(form.authData, form.baseUrl);
  if (isCustomFormState(form.slug, template)) {
    normalized.endpoints = {
      chat: form.chatEndpoint.trim() || DEFAULT_CHAT_ENDPOINT,
      models: form.modelsEndpoint.trim() || DEFAULT_MODELS_ENDPOINT,
    };
  }
  return serializeAuthData(normalized);
}

function openAuthPopupWindow(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "multiwebllm_auth", POPUP_FEATURES);
}

// 预设服务商模板（内置网页订阅聊天）
const providerTemplates: Record<string, Partial<ProviderForm>> = {
  chatgpt: {
    name: "ChatGPT",
    slug: "chatgpt",
    baseUrl: "https://chatgpt.com",
    authType: "cookie",
  },
  claude: {
    name: "Claude",
    slug: "claude",
    baseUrl: "https://claude.ai",
    authType: "cookie",
  },
  gemini: {
    name: "Gemini",
    slug: "gemini",
    baseUrl: "https://gemini.google.com",
    authType: "cookie",
  },
  grok: {
    name: "Grok",
    slug: "grok",
    baseUrl: "https://grok.com",
    authType: "cookie",
  },
  kimi: {
    name: "Kimi",
    slug: "kimi",
    baseUrl: "https://kimi.moonshot.cn",
    authType: "cookie",
  },
  custom: {
    name: "",
    slug: "",
    baseUrl: "https://",
    authType: "cookie",
  },
};

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "error":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    default:
      return "bg-gray-500/15 text-gray-700 dark:text-gray-400";
  }
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    ok: boolean;
    message: string;
  } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAuthJson, setShowAuthJson] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedTemplate("");
    setAuthError(null);
    setShowAuthJson(false);
    setDialogOpen(true);
  }

  async function openEdit(provider: Provider) {
    setEditingId(provider.id);
    setAuthError(null);
    setShowAuthJson(false);
    let authData = "";
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}`);
      if (res.ok) {
        const data = await res.json();
        authData = formatAuthDataForEdit(data.authData);
      }
    } catch {
      // ignore
    }
    const endpoints = endpointsFromAuthRaw(authData);
    setSelectedTemplate(isCustomProvider(provider.slug) ? "custom" : "");
    setForm({
      name: provider.name,
      slug: provider.slug,
      baseUrl: provider.baseUrl,
      authType: provider.authType,
      authData,
      status: provider.status,
      chatEndpoint: endpoints.chat || DEFAULT_CHAT_ENDPOINT,
      modelsEndpoint: endpoints.models || DEFAULT_MODELS_ENDPOINT,
    });
    setDialogOpen(true);
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function handleTemplateChange(template: string | null) {
    if (!template) return;
    setSelectedTemplate(template);
    if (template && providerTemplates[template]) {
      const tpl = providerTemplates[template];
      setForm((prev) => ({
        ...prev,
        name: tpl.name || "",
        slug: tpl.slug || "",
        baseUrl: tpl.baseUrl || "",
        authType: tpl.authType || "cookie",
        authData: "",
        chatEndpoint: DEFAULT_CHAT_ENDPOINT,
        modelsEndpoint: DEFAULT_MODELS_ENDPOINT,
      }));
    }
  }

  // 打开授权窗口
  function openAuthWindow() {
    if (!form.baseUrl) {
      alert("请先选择服务商或填写基础地址");
      return;
    }
    setAuthError(null);
    setAuthDialogOpen(true);
  }

  function openCookieEditorStore() {
    if (typeof window === "undefined") return;
    window.open(COOKIE_EDITOR_URL, "_blank", "noopener,noreferrer");
  }

  function startAuthPopupLogin() {
    if (!form.baseUrl) {
      setAuthError("请先填写基础地址");
      return;
    }
    setAuthError(null);
    openAuthPopupWindow(form.baseUrl);
  }

  function applyAuthImport(raw: string) {
    try {
      const normalized = normalizeAuthInput(raw, form.baseUrl);
      const cookieCount =
        typeof normalized.cookies === "object" && !Array.isArray(normalized.cookies)
          ? Object.keys(normalized.cookies).length
          : String(normalized.cookies).split(";").filter((s) => s.includes("=")).length;

      if (form.authType === "cookie" && cookieCount === 0) {
        setAuthError("未解析到有效 Cookie，请确认已复制完整且域名与基础地址匹配");
        return;
      }

      setForm((prev) => ({
        ...prev,
        authData: serializeAuthData(normalized),
      }));
      setAuthError(null);
      setShowAuthJson(false);
      setAuthDialogOpen(false);
    } catch {
      setAuthError("Cookie 格式无法识别，请检查粘贴内容");
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      applyAuthImport(text);
    } catch {
      setAuthError("无法读取剪贴板，请手动粘贴");
    }
  }

  async function handleSave() {
    setSaving(true);
    setAuthError(null);
    const slug = form.slug.trim().toLowerCase();
    if (!isWebChatProvider(slug)) {
      const slugError = validateCustomProviderSlug(slug);
      if (slugError) {
        setAuthError(slugError);
        setSaving(false);
        return;
      }
    }
    try {
      const url = editingId
        ? `/api/admin/providers/${editingId}`
        : "/api/admin/providers";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug,
          baseUrl: form.baseUrl,
          authType: form.authType,
          authData: buildAuthPayload(form, selectedTemplate),
          status: form.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(data.error || `保存失败 (${res.status})`);
        return;
      }
      setDialogOpen(false);
      await fetchProviders();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    await fetch(`/api/admin/providers/${deletingId}`, { method: "DELETE" });
    setDeleteDialogOpen(false);
    setDeletingId(null);
    await fetchProviders();
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/providers/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data.ok !== false;
      setTestResult({
        id,
        ok,
        message:
          data.message ||
          data.error ||
          (ok ? "连接正常" : `测试失败 (${res.status})`) +
          (data.authAgeDays != null ? `（${data.authAgeDays} 天前更新）` : ""),
      });
      await fetchProviders();
    } catch {
      setTestResult({ id, ok: false, message: "网络错误，请稍后重试" });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">服务商管理</h1>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          添加服务商
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>所有服务商</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>标识</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>认证方式</TableHead>
                  <TableHead>最后检查</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无服务商配置
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.slug}</TableCell>
                      <TableCell>
                        <Badge className={statusColor(p.status)}>{p.status === "active" ? "运行中" : p.status === "inactive" ? "未启用" : "异常"}</Badge>
                      </TableCell>
                      <TableCell>{p.authType}</TableCell>
                      <TableCell>
                        {p.lastCheckedAt
                          ? new Date(p.lastCheckedAt).toLocaleString()
                          : "从未"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTest(p.id)}
                            disabled={testingId === p.id}
                          >
                            {testingId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FlaskConical className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDelete(p.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        {testResult?.id === p.id && (
                          <p
                            className={`mt-1 text-xs ${
                              testResult.ok ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {testResult.message}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>{editingId ? "编辑服务商" : "添加服务商"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "更新服务商配置信息。"
                : "选择预设服务商或自定义配置。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-2">
            {/* 预设模板选择 */}
            {!editingId && (
              <div className="grid gap-2">
                <Label>选择服务商</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择预设服务商..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chatgpt">💬 ChatGPT</SelectItem>
                    <SelectItem value="claude">🎭 Claude</SelectItem>
                    <SelectItem value="gemini">💎 Gemini (Google)</SelectItem>
                    <SelectItem value="grok">🤖 Grok</SelectItem>
                    <SelectItem value="kimi">🌙 Kimi</SelectItem>
                    <SelectItem value="custom">✏️ 自定义服务商</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Kimi"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">标识</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="kimi"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="baseUrl">基础地址</Label>
              <Input
                id="baseUrl"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://kimi.moonshot.cn"
              />
            </div>
            {isCustomFormState(form.slug, selectedTemplate) && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="chatEndpoint">聊天 API 路径</Label>
                  <Input
                    id="chatEndpoint"
                    value={form.chatEndpoint}
                    onChange={(e) =>
                      setForm({ ...form, chatEndpoint: e.target.value })
                    }
                    placeholder={DEFAULT_CHAT_ENDPOINT}
                  />
                  <p className="text-xs text-muted-foreground">
                    OpenAI 兼容：与基础地址拼接，默认 {DEFAULT_CHAT_ENDPOINT}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="modelsEndpoint">模型列表 API 路径</Label>
                  <Input
                    id="modelsEndpoint"
                    value={form.modelsEndpoint}
                    onChange={(e) =>
                      setForm({ ...form, modelsEndpoint: e.target.value })
                    }
                    placeholder={DEFAULT_MODELS_ENDPOINT}
                  />
                  <p className="text-xs text-muted-foreground">
                    用于「同步模型」与连接测试，默认 {DEFAULT_MODELS_ENDPOINT}
                  </p>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>认证方式</Label>
              <Select
                value={form.authType}
                onValueChange={(val) =>
                  setForm({ ...form, authType: val as ProviderForm["authType"] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择认证方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cookie">Cookie (网页版)</SelectItem>
                  <SelectItem value="token">Token</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 认证数据区域 - 带一键授权 */}
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="authData">认证数据</Label>
                <div className="flex flex-wrap gap-2">
                  {form.authType === "cookie" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={pasteFromClipboard}
                        className="h-7 text-xs"
                      >
                        <ClipboardPaste className="mr-1 h-3 w-3" />
                        剪贴板导入
                      </Button>
                      {form.baseUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={openAuthWindow}
                          className="h-7 text-xs"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          登录与导入说明
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={openCookieEditorStore}
                        className="h-7 text-xs"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        安装 Cookie Editor
                      </Button>
                      {form.baseUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={startAuthPopupLogin}
                          className="h-7 text-xs"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          打开登录页
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {form.authData ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {describeAuthData(form.authData, form.baseUrl)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">尚未配置认证数据</p>
              )}

              {form.authType === "cookie" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-fit px-2 text-xs"
                  onClick={() => setShowAuthJson((v) => !v)}
                >
                  {showAuthJson ? "隐藏 JSON" : "显示 / 编辑 JSON"}
                </Button>
              )}

              {(showAuthJson || form.authType !== "cookie") && (
                <Textarea
                  id="authData"
                  value={form.authData}
                  onChange={(e) => {
                    setAuthError(null);
                    setForm({ ...form, authData: e.target.value });
                  }}
                  onBlur={() => {
                    if (!form.authData.trim()) return;
                    try {
                      const normalized = normalizeAuthInput(
                        form.authData,
                        form.baseUrl
                      );
                      setForm((prev) => ({
                        ...prev,
                        authData: serializeAuthData(normalized),
                      }));
                    } catch {
                      // keep raw
                    }
                  }}
                  placeholder={
                    form.authType === "cookie"
                      ? '{"cookies":{"SID":"..."}}'
                      : form.authType === "token"
                        ? '{"token":"Bearer xxx"}'
                        : '{"key":"sk-xxx"}'
                  }
                  rows={3}
                  className="max-h-32 resize-none overflow-y-auto font-mono text-xs"
                />
              )}

              {authError && (
                <p className="text-xs text-destructive">{authError}</p>
              )}
              {form.authType === "cookie" ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <p>
                    推荐安装{" "}
                    <a
                      href={COOKIE_EDITOR_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      Cookie Editor
                    </a>
                    ，在目标站点登录后导出 JSON，再回到这里点「剪贴板导入」。
                  </p>
                  <p className="mt-1">
                    支持 Cookie Editor JSON 数组、{`{"cookies": {...}}`} 对象或普通
                    `name=value` Cookie 字符串。
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {form.authType === "token"
                    ? "请输入 Bearer Token"
                    : "请输入 API Key"}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={form.status}
                onValueChange={(val) =>
                  setForm({ ...form, status: val as ProviderForm["status"] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">运行中</SelectItem>
                  <SelectItem value="inactive">未启用</SelectItem>
                  <SelectItem value="error">异常</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Dialog - Cookie 导入引导 */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="flex max-h-[min(85vh,560px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>🔐 Cookie 导入 - {form.name || "服务商"}</DialogTitle>
            <DialogDescription>
              在目标站点登录后，用 Cookie Editor 导出 JSON，再回到后台导入。
            </DialogDescription>
          </DialogHeader>
          
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                受浏览器安全策略限制，管理后台网页无法直接读取 Gemini/Google 等站点的
                Cookie。推荐流程是登录目标站点后，用 Cookie Editor 导出 JSON 并剪贴板导入。
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  className="w-full"
                  onClick={startAuthPopupLogin}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  1. 打开登录页
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  variant="secondary"
                  onClick={openCookieEditorStore}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  2. 安装 Cookie Editor
                </Button>
                <p>
                  3. 在该站点导出 Cookie Editor JSON，然后复制到剪贴板
                </p>
                <Button type="button" variant="outline" onClick={pasteFromClipboard}>
                  <ClipboardPaste className="mr-2 h-4 w-4" />
                  4. 从剪贴板导入 JSON
                </Button>
              </div>
              {authError && (
                <p className="text-xs text-destructive">{authError}</p>
              )}
            </div>

            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">支持的导入格式</p>
              <ul className="mt-2 space-y-1">
                <li>Cookie Editor 导出的 JSON 数组</li>
                <li>{`{"cookies": {...}}`} 形式的对象</li>
                <li>普通 `name=value; name2=value2` Cookie 字符串</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setAuthDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除服务商</DialogTitle>
            <DialogDescription>
              确定要删除该服务商吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
