"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Sparkles, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"password" | "2fa">("password");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          ...(step === "2fa" ? { totp_code: totpCode } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/dashboard");
      } else if (data.requires_2fa && step === "password") {
        setStep("2fa");
        setError("");
      } else {
        setError(data.error ?? "密码错误，请重试。");
      }
    } catch {
      setError("网络错误，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("password");
    setTotpCode("");
    setError("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            {step === "password" ? (
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl">MultiWebLLM</CardTitle>
          <CardDescription>
            {step === "password" ? "登录管理后台" : "双因素认证"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {step === "password" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    autoFocus
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  请输入 Google Authenticator 中的验证码
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="totp">验证码</Label>
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="请输入 6 位验证码"
                    autoFocus
                    className="text-center tracking-widest text-lg"
                  />
                </div>
              </>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === "password" ? "登 录" : "验 证"}
            </Button>
            {step === "2fa" && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回密码登录
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
