"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FlaskConical } from "lucide-react"
import { ThemeSetting } from "@/components/theme-setting"
import { RingtoneSetting } from "@/components/ringtone-setting"
import { APP_VERSION, checkForUpdate } from "@/lib/version"
import { enterDiyMode } from "@/lib/diy"
import { UpdateDialog } from "@/components/update-dialog"
import type { UpdateManifest } from "@/lib/version"

function getClientTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  try {
    return document.cookie.includes("theme=dark") ? "dark" : "light"
  } catch {
    return "light"
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const [initialTheme] = useState<"light" | "dark">(getClientTheme)
  const [manifest, setManifest] = useState<UpdateManifest | null>(null)
  const [checking, setChecking] = useState(false)

  function handleEnterDiy() {
    enterDiyMode()
    router.push("/")
  }

  async function handleCheckUpdate() {
    setChecking(true)
    const result = await checkForUpdate()
    setChecking(false)
    if (result.hasUpdate && result.manifest) {
      setManifest(result.manifest)
    } else {
      alert("已是最新版本 v" + APP_VERSION)
    }
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}
    >
      <header className="mb-10 flex items-center">
        <Link
          href="/"
          aria-label="返回"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="ml-2 text-base font-medium tracking-wide">设置</h1>
      </header>

      <div className="flex flex-col gap-10">
        {/* 主题 */}
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">界面主题</p>
          <ThemeSetting initialTheme={initialTheme} />
        </section>

        <hr className="border-border" />

        {/* 通知偏好 */}
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">通知偏好</p>
          <RingtoneSetting />
        </section>

        <hr className="border-border" />

        {/* 实验室 */}
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">实验室</p>
          <button
            type="button"
            onClick={handleEnterDiy}
            className="flex items-center justify-between rounded-2xl border border-border px-5 py-4 text-left text-foreground transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-3">
              <FlaskConical className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-base">DIY 模式</span>
            </span>
            <span className="text-xs text-muted-foreground">自定义布局 →</span>
          </button>
        </section>

        <hr className="border-border" />

        {/* 关于 */}
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">关于</p>
          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={checking}
            className="flex items-center justify-between rounded-2xl border border-border px-5 py-4 text-left text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <span className="text-base">
              {checking ? "检查中…" : "检查更新"}
            </span>
            <span className="text-xs text-muted-foreground">v{APP_VERSION}</span>
          </button>
        </section>
      </div>

      {/* 更新弹窗 */}
      {manifest && (
        <UpdateDialog
          version={manifest.version}
          releaseNotes={manifest.release_notes}
          apkUrl={manifest.apk_url}
          onClose={() => setManifest(null)}
        />
      )}
    </main>
  )
}
