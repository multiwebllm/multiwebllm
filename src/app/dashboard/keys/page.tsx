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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  CheckCheck,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  key_preview: string;
  allowed_models: string[];
  rate_limit: number;
  monthly_quota: number;
  used_quota: number;
  status: "active" | "inactive" | "revoked";
  last_used: string | null;
  expires_at: string | null;
}

interface Model {
  id: string;
  name: string;
  model_id: string;
}

interface KeyForm {
  name: string;
  allowed_models: string[];
  rate_limit: number;
  monthly_quota: number;
  expires_at: string;
}

const emptyForm: KeyForm = {
  name: "",
  allowed_models: [],
  rate_limit: 60,
  monthly_quota: 0,
  expires_at: "",
};

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<KeyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/models");
      if (res.ok) {
        const data = await res.json();
        setModels(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchKeys();
    fetchModels();
  }, [fetchKeys, fetchModels]);

  function openGenerate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(key: ApiKey) {
    setEditingId(key.id);
    setForm({
      name: key.name,
      allowed_models: key.allowed_models,
      rate_limit: key.rate_limit,
      monthly_quota: key.monthly_quota,
      expires_at: key.expires_at ?? "",
    });
    setDialogOpen(true);
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/keys/${editingId}`
        : "/api/admin/keys";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setDialogOpen(false);
      if (!editingId && data.key) {
        setNewKey(data.key);
        setSuccessDialogOpen(true);
      }
      await fetchKeys();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    await fetch(`/api/admin/keys/${deletingId}`, { method: "DELETE" });
    setDeleteDialogOpen(false);
    setDeletingId(null);
    await fetchKeys();
  }

  async function copyToClipboard(text: string, id?: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id ?? "new");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleModel(modelId: string) {
    setForm((prev) => {
      const has = prev.allowed_models.includes(modelId);
      return {
        ...prev,
        allowed_models: has
          ? prev.allowed_models.filter((m) => m !== modelId)
          : [...prev.allowed_models, modelId],
      };
    });
  }

  function maskKey(key: ApiKey): string {
    if (key.key_preview) return key.key_preview;
    const k = key.key ?? "";
    if (k.length > 8) return k.slice(0, 5) + "..." + k.slice(-4);
    return "sk-...";
  }

  function quotaPercent(used: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">API 密钥管理</h1>
        <Button onClick={openGenerate}>
          <Plus className="mr-2 h-4 w-4" />
          生成密钥
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>所有 API 密钥</CardTitle>
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
                  <TableHead>密钥</TableHead>
                  <TableHead>允许模型</TableHead>
                  <TableHead>频率限制</TableHead>
                  <TableHead>配额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后使用</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      暂无 API 密钥
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs">{maskKey(k)}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(k.key_preview || k.key, k.id)}
                          >
                            {copiedId === k.id ? (
                              <CheckCheck className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {k.allowed_models.length === 0 ? (
                            <span className="text-xs text-muted-foreground">全部</span>
                          ) : (
                            k.allowed_models.slice(0, 3).map((m) => (
                              <Badge key={m} variant="secondary" className="text-xs">
                                {m}
                              </Badge>
                            ))
                          )}
                          {k.allowed_models.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{k.allowed_models.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{k.rate_limit}次/分钟</TableCell>
                      <TableCell>
                        {k.monthly_quota > 0 ? (
                          <div className="w-24">
                            <div className="mb-1 flex justify-between text-xs">
                              <span>{k.used_quota.toLocaleString()}</span>
                              <span>{k.monthly_quota.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted">
                              <div
                                className="h-1.5 rounded-full bg-primary transition-all"
                                style={{
                                  width: `${quotaPercent(k.used_quota, k.monthly_quota)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">无限制</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            k.status === "active"
                              ? "bg-green-500/15 text-green-700 dark:text-green-400"
                              : k.status === "revoked"
                              ? "bg-red-500/15 text-red-700 dark:text-red-400"
                              : "bg-gray-500/15 text-gray-700 dark:text-gray-400"
                          }
                        >
                          {k.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {k.last_used
                          ? new Date(k.last_used).toLocaleString()
                          : "从未"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(k)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDelete(k.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑密钥" : "生成 API 密钥"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "更新 API 密钥设置。"
                : "创建新的 API 密钥用于代理访问。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="k-name">名称</Label>
              <Input
                id="k-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My API Key"
              />
            </div>
            <div className="grid gap-2">
              <Label>允许模型</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                {models.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无可用模型</p>
                ) : (
                  models.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={form.allowed_models.includes(m.model_id)}
                        onChange={() => toggleModel(m.model_id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{m.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {m.model_id}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                留空则允许所有模型。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="k-rate">频率限制 (次/分钟)</Label>
                <Input
                  id="k-rate"
                  type="number"
                  value={form.rate_limit}
                  onChange={(e) =>
                    setForm({ ...form, rate_limit: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="k-quota">月度配额 (0 = 无限制)</Label>
                <Input
                  id="k-quota"
                  type="number"
                  value={form.monthly_quota}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monthly_quota: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="k-expires">过期时间</Label>
              <Input
                id="k-expires"
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                留空则永不过期。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "更新" : "生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog (shows full key once) */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API 密钥已创建</DialogTitle>
            <DialogDescription>
              请立即复制您的 API 密钥，之后将无法再次查看。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md bg-muted p-3">
            <code className="flex-1 break-all text-sm">{newKey}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(newKey)}
            >
              {copiedId === "new" ? (
                <CheckCheck className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccessDialogOpen(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除密钥</DialogTitle>
            <DialogDescription>
              确定要删除该密钥吗？使用此密钥的应用将无法访问。
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
