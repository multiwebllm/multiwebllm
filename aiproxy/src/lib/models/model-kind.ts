import type { ProviderModel } from "@/lib/providers/base";

export const MODEL_KINDS = [
  "chat",
  "image",
  "video",
  "audio",
  "code",
] as const;

export type ModelKind = (typeof MODEL_KINDS)[number];

export const MODEL_KIND_LABELS: Record<ModelKind, string> = {
  chat: "聊天",
  image: "图片",
  video: "视频",
  audio: "音频",
  code: "代码",
};

/** 非聊天类每种最多保留条数（官网列表裁剪后） */
export const MAX_MODELS_BY_KIND: Record<ModelKind, number> = {
  chat: 1, // 主版本档数量，与 version-rank 中 MAX_VERSION_TIERS 配合
  image: 3,
  video: 2,
  audio: 2,
  code: 2,
};

export function isModelKind(value: string): value is ModelKind {
  return (MODEL_KINDS as readonly string[]).includes(value);
}

export function effectiveModelKind(
  model: Pick<ProviderModel, "supportsImageGen"> & {
    modelKind?: string | null;
  }
): ModelKind {
  if (model.modelKind && isModelKind(model.modelKind)) {
    return model.modelKind;
  }
  if (model.supportsImageGen) return "image";
  return "chat";
}

export function capabilitiesForKind(kind: ModelKind): {
  supportsVision: boolean;
  supportsImageGen: boolean;
} {
  switch (kind) {
    case "image":
      return { supportsVision: false, supportsImageGen: true };
    case "chat":
      return { supportsVision: true, supportsImageGen: false };
    default:
      return { supportsVision: false, supportsImageGen: false };
  }
}

/**
 * 从官网模型 ID / 标签推断类型（目录条目优先）。
 */
export function inferModelKind(
  officialId: string,
  tagStr: string,
  catalogKind?: ModelKind
): ModelKind {
  if (catalogKind) return catalogKind;

  const id = officialId.toLowerCase();
  const tags = tagStr.toLowerCase();

  if (
    /gpt-image|image-gen|image_gen|dall-e|dalle|imagen|grok-imagine-image|stable-diffusion|flux-/.test(
      id
    ) ||
    tags.includes("image_gen") ||
    tags.includes("image-generation") ||
    (tags.includes("image") && tags.includes("generat"))
  ) {
    return "image";
  }

  if (
    /sora|veo|video|grok-imagine-video|seedream|runway|kling-video/.test(id) ||
    tags.includes("video")
  ) {
    return "video";
  }

  if (
    /whisper|tts|audio|voice|speech|sound|read-aloud/.test(id) ||
    tags.includes("audio") ||
    tags.includes("tts")
  ) {
    return "audio";
  }

  if (
    /codex|code-interpreter|artifact|claude-code|o\d+-code/.test(id) ||
    tags.includes("code")
  ) {
    return "code";
  }

  return "chat";
}

export function withKindCapabilities(
  model: ProviderModel
): ProviderModel {
  const kind = effectiveModelKind(model);
  const caps = capabilitiesForKind(kind);
  return {
    ...model,
    modelKind: kind,
    supportsVision: model.supportsVision ?? caps.supportsVision,
    supportsImageGen: model.supportsImageGen ?? caps.supportsImageGen,
  };
}
