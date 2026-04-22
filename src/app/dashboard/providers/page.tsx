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
  Copy,
  Check,
} from "lucide-react";

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

type ProviderForm = Omit<Provider, "id" | "lastCheckedAt">;

const emptyForm: ProviderForm = {
  name: "",
  slug: "",
  baseUrl: "",
  authType: "cookie",
  authData: "",
  status: "active",
};

// 预设服务商模板
const providerTemplates: Record<string, Partial<ProviderForm>> = {
  kimi: {
    name: "Kimi",
    slug: "kimi",
    baseUrl: "https://kimi.moonshot.cn",
    authType: "cookie",
  },
  deepseek: {
    name: "DeepSeek",
    slug: "deepseek",
    baseUrl: "https://chat.deepseek.com",
    authType: "cookie",
  },
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
    baseUrl: "https://grok.x.ai",
    authType: "cookie",
  },
  doubao: {
    name: "豆包",
    slug: "doubao",
    baseUrl: "https://www.doubao.com",
    authType: "cookie",
  },
  minimax: {
    name: "Minimax",
    slug: "minimax",
    baseUrl: "https://minimax.chat",
    authType: "cookie",
  },
  custom: {
    name: "",
    slug: "",
    baseUrl: "",
    authType: "api_key",
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
  const [copied, setCopied] = useState(false);

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
    setDialogOpen(true);
  }

  function openEdit(provider: Provider) {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      slug: provider.slug,
      baseUrl: provider.baseUrl,
      authType: provider.authType,
      authData: provider.authData,
      status: provider.status,
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
      }));
    }
  }

  // 打开授权窗口
  function openAuthWindow() {
    if (!form.baseUrl) {
      alert("请先选择服务商或填写基础地址");
      return;
    }
    setAuthDialogOpen(true);
  }

  // 复制书签代码
  async function copyBookmarkCode() {
    const code = `javascript:(function(){const c=document.cookie;navigator.clipboard.writeText(JSON.stringify({cookies:c,url:location.href},null,2)).then(()=>alert('Cookie已复制!请粘贴到后台')).catch(()=>prompt('复制失败，请手动复制:',c));})();`;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // 从剪贴板导入
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      // 尝试解析 JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // 如果不是 JSON，直接作为 cookie 字符串
        data = { cookies: text };
      }
      
      // 提取 cookie
      let cookieStr = "";
      if (data.cookies) {
        cookieStr = typeof data.cookies === "string" ? data.cookies : JSON.stringify(data.cookies);
      }
      
      // 构建 authData
      const authData: Record<string, unknown> = { cookies: cookieStr };
      if (data.token) authData.token = data.token;
      
      setForm((prev) => ({
        ...prev,
        authData: JSON.stringify(authData, null, 2),
      }));
      
      setAuthDialogOpen(false);
    } catch (err) {
      alert("无法读取剪贴板，请手动粘贴");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/providers/${editingId}`
        : "/api/admin/providers";
      const method = editingId ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
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
      });
      const data = await res.json();
      setTestResult({ id, ok: res.ok, message: data.message ?? (res.ok ? "OK" : "Failed") });
    } catch {
      setTestResult({ id, ok: false, message: "Network error" });
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑服务商" : "添加服务商"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "更新服务商配置信息。"
                : "选择预设服务商或自定义配置。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
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
                    <SelectItem value="kimi">🌙 Kimi (Moonshot)</SelectItem>
                    <SelectItem value="deepseek">🐋 DeepSeek</SelectItem>
                    <SelectItem value="chatgpt">💬 ChatGPT</SelectItem>
                    <SelectItem value="claude">🎭 Claude</SelectItem>
                    <SelectItem value="gemini">💎 Gemini</SelectItem>
                    <SelectItem value="grok">🤖 Grok</SelectItem>
                    <SelectItem value="doubao">📦 豆包</SelectItem>
                    <SelectItem value="minimax">🔺 Minimax</SelectItem>
                    <SelectItem value="custom">✏️ 自定义</SelectItem>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="authData">认证数据 (JSON)</Label>
                {form.authType === "cookie" && form.baseUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openAuthWindow}
                    className="h-7 text-xs"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    一键授权
                  </Button>
                )}
              </div>
              <Textarea
                id="authData"
                value={form.authData}
                onChange={(e) => setForm({ ...form, authData: e.target.value })}
                placeholder={`${form.authType === "cookie" 
                  ? '{"cookies": "session=xxx; token=xxx"}' 
                  : form.authType === "token" 
                    ? '{"token": "Bearer xxx"}' 
                    : '{"key": "sk-xxx"}'}`}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {form.authType === "cookie" 
                  ? "点击「一键授权」自动获取 Cookie，或手动粘贴" 
                  : form.authType === "token"
                    ? "请输入 Bearer Token"
                    : "请输入 API Key"}
              </p>
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
          <DialogFooter>
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

      {/* Auth Dialog - 一键授权 */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🔐 授权登录 - {form.name || "服务商"}</DialogTitle>
            <DialogDescription>
              请按以下步骤完成授权：
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 步骤 1 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
                打开登录页面
              </div>
              <p className="text-sm text-muted-foreground pl-8">
                点击下方按钮打开 {form.name} 登录页面，确保已登录
              </p>
              <div className="pl-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(form.baseUrl, "_blank", "width=800,height=600")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  打开 {form.name} 登录页
                </Button>
              </div>
            </div>

            {/* 步骤 2 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
                复制 Cookie
              </div>
              <p className="text-sm text-muted-foreground pl-8">
                登录后，点击书签或按 F12 → Application → Cookies → 复制所有
              </p>
              <div className="pl-8 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={copyBookmarkCode}
                >
                  {copied ? (
                    <><Check className="mr-1 h-3 w-3" /> 已复制</>
                  ) : (
                    <><Copy className="mr-1 h-3 w-3" /> 复制书签代码</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                💡 提示：将复制的代码添加到浏览器书签，登录后点击即可复制 Cookie
              </p>
            </div>

            {/* 步骤 3 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
                粘贴到此处
              </div>
              <div className="pl-8">
                <Button
                  type="button"
                  onClick={pasteFromClipboard}
                  className="w-full"
                >
                  📋 从剪贴板导入 Cookie
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
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
