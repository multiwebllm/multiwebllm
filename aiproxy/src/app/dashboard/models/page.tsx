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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { isSyncableProvider } from "@/lib/models/catalog";
import {
  capabilitiesForKind,
  MODEL_KIND_LABELS,
  MODEL_KINDS,
  type ModelKind,
} from "@/lib/models/model-kind";
import {
  defaultLimitsForKind,
  formatTokenLimit,
} from "@/lib/models/limits";

interface Provider {
  id: number;
  name: string;
  slug: string;
}

interface Model {
  id: number;
  name: string;
  modelId: string;
  providerId: number;
  providerName?: string;
  upstreamModel: string | null;
  supportsVision: boolean;
  supportsImageGen: boolean;
  modelKind: string;
  maxTokens: number | null;
  contextWindow: number | null;
  status: "active" | "inactive";
}

interface ModelForm {
  name: string;
  modelId: string;
  providerId: string;
  upstreamModel: string;
  supportsVision: boolean;
  supportsImageGen: boolean;
  modelKind: ModelKind;
  maxTokens: string;
  contextWindow: string;
  status: "active" | "inactive";
}

const emptyForm: ModelForm = {
  name: "",
  modelId: "",
  providerId: "",
  upstreamModel: "",
  supportsVision: true,
  supportsImageGen: false,
  modelKind: "chat",
  maxTokens: "16384",
  contextWindow: "128000",
  status: "active",
};

const KIND_BADGE_CLASS: Record<ModelKind, string> = {
  chat: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  image: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  video: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  audio: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  code: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModelForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "active"
  );

  const fetchModels = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/models?_=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        setModels(Array.isArray(data) ? data : []);
        setListVersion((v) => v + 1);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({
          success: false,
          message: err.error || `加载失败 (${res.status})`,
        });
      }
    } catch {
      setFeedback({ success: false, message: "加载模型列表失败" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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

  const runCleanup = useCallback(async (silent = false) => {
    setCleaning(true);
    if (!silent) setFeedback(null);
    try {
      const res = await fetch("/api/admin/models/cleanup", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) {
          setFeedback({
            success: false,
            message: data.error || `清理失败 (${res.status})`,
          });
        }
        return 0;
      }
      if (data.deleted > 0) {
        await fetchModels();
        if (!silent) {
          setFeedback({
            success: true,
            message: `已删除 ${data.deleted} 个无关模型（${(data.providerSlugs as string[])?.join("、") || "非网页聊天服务商"}）`,
          });
        }
      } else if (!silent) {
        setFeedback({ success: true, message: "没有需要清理的无关模型" });
      }
      return data.deleted as number;
    } catch {
      if (!silent) {
        setFeedback({ success: false, message: "清理失败，请稍后重试" });
      }
      return 0;
    } finally {
      setCleaning(false);
    }
  }, [fetchModels]);

  useEffect(() => {
    fetchModels();
    fetchProviders();
    void runCleanup(true);
  }, [fetchModels, fetchProviders, runCleanup]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(model: Model) {
    setEditingId(String(model.id));
    setForm({
      name: model.name,
      modelId: model.modelId,
      providerId: String(model.providerId),
      upstreamModel: model.upstreamModel ?? "",
      supportsVision: model.supportsVision,
      supportsImageGen: model.supportsImageGen,
      modelKind: (MODEL_KINDS as readonly string[]).includes(model.modelKind)
        ? (model.modelKind as ModelKind)
        : model.supportsImageGen
          ? "image"
          : "chat",
      maxTokens:
        model.maxTokens != null && model.maxTokens > 0
          ? String(model.maxTokens)
          : "",
      contextWindow:
        model.contextWindow != null && model.contextWindow > 0
          ? String(model.contextWindow)
          : "",
      status: model.status,
    });
    setDialogOpen(true);
  }

  function openDelete(id: number) {
    setDeletingId(String(id));
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const url = editingId
        ? `/api/admin/models/${editingId}`
        : "/api/admin/models";
      const method = editingId ? "PUT" : "POST";
      const kind = form.modelKind;
      const usesTokens = kind === "chat" || kind === "code";
      const payload = {
        ...form,
        providerId: Number(form.providerId),
        maxTokens: usesTokens
          ? parseInt(form.maxTokens, 10) || null
          : null,
        contextWindow: usesTokens
          ? parseInt(form.contextWindow, 10) || null
          : null,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          success: false,
          message: data.error || `保存失败 (${res.status})`,
        });
        return;
      }
      setDialogOpen(false);
      setFeedback({
        success: true,
        message: editingId ? "模型已更新" : "模型已创建",
      });
      await fetchModels();
    } catch {
      setFeedback({ success: false, message: "保存失败，请检查网络" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    await fetch(`/api/admin/models/${deletingId}`, { method: "DELETE" });
    setDeleteDialogOpen(false);
    setDeletingId(null);
    await fetchModels();
  }

  const filteredModels = models.filter((m) => {
    if (statusFilter === "all") return true;
    return m.status === statusFilter;
  });

  function toggleSelect(id: number) {
    const key = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredModels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredModels.map((m) => String(m.id))));
    }
  }

  async function bulkSetStatus(status: "active" | "inactive") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/models/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      )
    );
    setSelected(new Set());
    await fetchModels();
  }

  const providerName = (id: number) =>
    providers.find((p) => p.id === id)?.name ?? String(id);

  const syncableProviders = providers.filter((p) => isSyncableProvider(p.slug));

  async function handleSync() {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/models/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          success: false,
          message: data.error || `同步失败 (${res.status})`,
        });
        return;
      }
      if (data.success === false) {
        const failed = (data.results as { providerName: string; error?: string }[])
          ?.filter((r) => r.error)
          .map((r) => `${r.providerName}: ${r.error}`)
          .join("；");
        setFeedback({
          success: false,
          message: failed || "部分服务商同步失败",
        });
      }
      const cleanupHint =
        data.cleanup?.deleted > 0
          ? `，已删除 ${data.cleanup.deleted} 个无关模型`
          : "";
      const catalogHint =
        data.summary?.catalogFallbacks > 0
          ? `（${data.summary.catalogFallbacks} 个服务商未连上官网 API，已用内置目录+补充；请检查 Cookie 后重试）`
          : "";
      const removedHint =
        data.summary?.totalRemoved > 0
          ? `，删除旧版 ${data.summary.totalRemoved} 个`
          : "";
        const changed =
          (data.summary?.totalAdded ?? 0) +
          (data.summary?.totalUpdated ?? 0) +
          (data.summary?.totalRemoved ?? 0);
        setFeedback({
          success: true,
          message:
            changed > 0
              ? `同步完成：新增 ${data.summary.totalAdded}，更新 ${data.summary.totalUpdated}${removedHint}${cleanupHint}；已合并 2026 目录与官网列表${catalogHint}`
              : `同步完成（2026 目录已写入）${cleanupHint}${removedHint}${catalogHint}`,
        });
      await fetchModels(true);
    } catch {
      setFeedback({ success: false, message: "网络错误，请稍后重试" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">模型配置</h1>
        <div className="flex items-center gap-2">
          {feedback && (
            <span
              className={`max-w-md text-sm ${feedback.success ? "text-green-600" : "text-red-600"}`}
            >
              {feedback.message}
            </span>
          )}
          {selected.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkSetStatus("active")}
              >
                启用 ({selected.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkSetStatus("inactive")}
              >
                禁用 ({selected.size})
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => runCleanup(false)}
            disabled={cleaning || syncing}
          >
            {cleaning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Trash2 className="mr-2 h-4 w-4" />
            清理无关模型
          </Button>
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing || cleaning}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            同步模型
          </Button>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加模型
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>所有模型 ({filteredModels.length})</CardTitle>
          <Select
            value={statusFilter}
            onValueChange={(val: string | null) =>
              setStatusFilter((val || "all") as typeof statusFilter)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">仅启用</SelectItem>
              <SelectItem value="inactive">仅停用</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table key={listVersion}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredModels.length > 0 &&
                        selected.size === filteredModels.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>模型 ID</TableHead>
                  <TableHead>上游模型</TableHead>
                  <TableHead>服务商</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>上下文</TableHead>
                  <TableHead>默认输出</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      暂无模型配置
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredModels.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(String(m.id))}
                          onChange={() => toggleSelect(m.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="font-mono text-xs">{m.modelId}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.upstreamModel || "—"}
                      </TableCell>
                      <TableCell>{m.providerName ?? providerName(m.providerId)}</TableCell>
                      <TableCell>
                        <KindBadge kind={resolveModelKind(m)} />
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatTokenLimit(m.contextWindow)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatTokenLimit(m.maxTokens)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            m.status === "active"
                              ? "bg-green-500/15 text-green-700 dark:text-green-400"
                              : "bg-gray-500/15 text-gray-700 dark:text-gray-400"
                          }
                        >
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDelete(m.id)}>
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑模型" : "添加模型"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "更新模型配置信息。"
                : "添加新模型到代理。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="m-name">名称</Label>
              <Input
                id="m-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="GPT-4o"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-model_id">模型 ID</Label>
              <Input
                id="m-model_id"
                value={form.modelId}
                onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                placeholder="gpt-4o"
              />
            </div>
            <div className="grid gap-2">
              <Label>服务商</Label>
              <Select
                value={form.providerId}
                onValueChange={(val: string | null) => setForm({ ...form, providerId: val || "" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择服务商" />
                </SelectTrigger>
                <SelectContent>
                  {syncableProviders.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-upstream">上游模型</Label>
              <Input
                id="m-upstream"
                value={form.upstreamModel}
                onChange={(e) =>
                  setForm({ ...form, upstreamModel: e.target.value })
                }
                placeholder="gpt-4o-2024-08-06"
              />
            </div>
            <div className="grid gap-2">
              <Label>模型类型</Label>
              <Select
                value={form.modelKind}
                onValueChange={(val: string | null) => {
                  const kind = (val || "chat") as ModelKind;
                  const caps = capabilitiesForKind(kind);
                  const limits = defaultLimitsForKind(kind);
                  setForm({
                    ...form,
                    modelKind: kind,
                    supportsVision: caps.supportsVision,
                    supportsImageGen: caps.supportsImageGen,
                    maxTokens:
                      limits.maxTokens != null ? String(limits.maxTokens) : "",
                    contextWindow:
                      limits.contextWindow != null
                        ? String(limits.contextWindow)
                        : "",
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {MODEL_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.modelKind === "chat" && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.supportsVision}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, supportsVision: !!checked })
                  }
                />
                <Label>支持视觉（图片输入）</Label>
              </div>
            )}
            {(form.modelKind === "chat" || form.modelKind === "code") && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="m-context">上下文窗口（Token）</Label>
                  <Input
                    id="m-context"
                    type="number"
                    min={0}
                    value={form.contextWindow}
                    onChange={(e) =>
                      setForm({ ...form, contextWindow: e.target.value })
                    }
                    placeholder="128000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="m-max_tokens">默认最大输出（Token）</Label>
                  <Input
                    id="m-max_tokens"
                    type="number"
                    min={0}
                    value={form.maxTokens}
                    onChange={(e) =>
                      setForm({ ...form, maxTokens: e.target.value })
                    }
                    placeholder="16384"
                  />
                  <p className="text-xs text-muted-foreground">
                    客户端未传 max_tokens 时使用；网页 Cookie 上游可能忽略该值。
                  </p>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={form.status}
                onValueChange={(val: string | null) =>
                  setForm({ ...form, status: (val || "active") as ModelForm["status"] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除模型</DialogTitle>
            <DialogDescription>
              确定要删除该模型吗？此操作不可撤销。
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

function resolveModelKind(m: Model): ModelKind {
  if ((MODEL_KINDS as readonly string[]).includes(m.modelKind)) {
    return m.modelKind as ModelKind;
  }
  if (m.supportsImageGen) return "image";
  return "chat";
}

function KindBadge({ kind }: { kind: ModelKind }) {
  return (
    <Badge className={KIND_BADGE_CLASS[kind]}>{MODEL_KIND_LABELS[kind]}</Badge>
  );
}
