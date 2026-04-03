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
  Check,
  X,
} from "lucide-react";

interface Provider {
  id: string;
  name: string;
}

interface Model {
  id: string;
  name: string;
  modelId: string;
  providerId: string;
  providerName?: string;
  upstreamModel: string;
  supportsVision: boolean;
  supportsImageGen: boolean;
  maxTokens: number;
  status: "active" | "inactive";
}

interface ModelForm {
  name: string;
  modelId: string;
  providerId: string;
  upstreamModel: string;
  supportsVision: boolean;
  supportsImageGen: boolean;
  maxTokens: number;
  status: "active" | "inactive";
}

const emptyForm: ModelForm = {
  name: "",
  modelId: "",
  providerId: "",
  upstreamModel: "",
  supportsVision: false,
  supportsImageGen: false,
  maxTokens: 4096,
  status: "active",
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

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/models");
      if (res.ok) {
        const data = await res.json();
        setModels(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchModels();
    fetchProviders();
  }, [fetchModels, fetchProviders]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(model: Model) {
    setEditingId(model.id);
    setForm({
      name: model.name,
      modelId: model.modelId,
      providerId: model.providerId,
      upstreamModel: model.upstreamModel,
      supportsVision: model.supportsVision,
      supportsImageGen: model.supportsImageGen,
      maxTokens: model.maxTokens,
      status: model.status,
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
        ? `/api/admin/models/${editingId}`
        : "/api/admin/models";
      const method = editingId ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setDialogOpen(false);
      await fetchModels();
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === models.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(models.map((m) => m.id)));
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

  const providerName = (id: string) =>
    providers.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">模型配置</h1>
        <div className="flex items-center gap-2">
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
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加模型
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>所有模型</CardTitle>
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
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={models.length > 0 && selected.size === models.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>模型 ID</TableHead>
                  <TableHead>服务商</TableHead>
                  <TableHead>视觉</TableHead>
                  <TableHead>图片生成</TableHead>
                  <TableHead>最大 Token</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      暂无模型配置
                    </TableCell>
                  </TableRow>
                ) : (
                  models.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={() => toggleSelect(m.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="font-mono text-xs">{m.modelId}</TableCell>
                      <TableCell>{m.providerName ?? providerName(m.providerId)}</TableCell>
                      <TableCell>
                        {m.supportsVision ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {m.supportsImageGen ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>{m.maxTokens.toLocaleString()}</TableCell>
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
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
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
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.supportsVision}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, supportsVision: !!checked })
                  }
                />
                <Label>视觉</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.supportsImageGen}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, supportsImageGen: !!checked })
                  }
                />
                <Label>图片生成</Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-max_tokens">最大 Token</Label>
              <Input
                id="m-max_tokens"
                type="number"
                value={form.maxTokens}
                onChange={(e) =>
                  setForm({ ...form, maxTokens: parseInt(e.target.value) || 0 })
                }
              />
            </div>
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
