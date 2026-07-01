// RemindME — 铃声试听 hook（原生优先，Web fallback）
// 所有 NativeAudio 调用必须 try/catch，严禁未捕获异常

"use client"

import { useRef, useCallback, useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { NativeAudio } from "@capacitor-community/native-audio"

export function useSoundPreview() {
  const preloadedRef = useRef<Set<string>>(new Set())
  const webAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentAssetIdRef = useRef<string | null>(null)

  // ── Native：预加载单个铃声（catch 所有错误，绝不 throw）──
  const preloadNative = useCallback(async (soundId: string): Promise<boolean> => {
    if (preloadedRef.current.has(soundId)) return true
    const assetId = `ringtone_${soundId}`
    try {
      await NativeAudio.preload({
        assetId,
        assetPath: `${soundId}.mp3`,
        audioChannelNum: 1,
        isUrl: false,
      })
      preloadedRef.current.add(soundId)
      return true
    } catch (e) {
      console.error(`[NativeAudio] preload 失败 — soundId: ${soundId}, assetPath: ${soundId}.mp3`, e)
      return false
    }
  }, [])

  // ── Native：停止上一个，播放新的（catch 所有错误）──
  const playNative = useCallback(
    async (soundId: string): Promise<boolean> => {
      const assetId = `ringtone_${soundId}`

      // 停止上一个
      if (currentAssetIdRef.current && currentAssetIdRef.current !== assetId) {
        try { await NativeAudio.stop({ assetId: currentAssetIdRef.current }) } catch {}
        currentAssetIdRef.current = null
      }

      // 预加载
      const loaded = await preloadNative(soundId)
      if (!loaded) return false

      // 播放
      try {
        await NativeAudio.play({ assetId })
        currentAssetIdRef.current = assetId
        return true
      } catch (e) {
        console.error(`[NativeAudio] play 失败 — soundId: ${soundId}, assetId: ${assetId}`, e)
        return false
      }
    },
    [preloadNative],
  )

  // ── Web：HTMLAudioElement 降级 ──
  const playWeb = useCallback((soundId: string): boolean => {
    try {
      if (webAudioRef.current) {
        webAudioRef.current.pause()
        webAudioRef.current.currentTime = 0
        webAudioRef.current = null
      }
      const audio = new Audio(`/sounds/${soundId}.mp3`)
      webAudioRef.current = audio
      audio.play().catch((e) => {
        console.error(`[Web] Audio 播放失败 — soundId: ${soundId}`, e)
        webAudioRef.current = null
      })
      audio.addEventListener("ended", () => {
        if (webAudioRef.current === audio) webAudioRef.current = null
      })
      return true
    } catch (e) {
      console.error(`[Web] Audio 构造失败 — soundId: ${soundId}`, e)
      return false
    }
  }, [])

  // ── 统一入口（绝不 throw，失败做 fallback）──
  const previewSound = useCallback(
    async (soundId: string): Promise<void> => {
      if (!soundId || soundId === "default") return
      try {
        if (Capacitor.isNativePlatform()) {
          const ok = await playNative(soundId)
          if (!ok) {
            // NativeAudio 失败 → fallback 到 Web Audio
            console.warn(`[previewSound] NativeAudio 失败，尝试 Web fallback — soundId: ${soundId}`)
            playWeb(soundId)
          }
        } else {
          playWeb(soundId)
        }
      } catch (e) {
        console.error(`[previewSound] 试听失败 — soundId: ${soundId}`, e)
        // 终极 fallback
        try { playWeb(soundId) } catch {}
      }
    },
    [playNative, playWeb],
  )

  // ── 停止当前试听（catch 所有错误）──
  const stopPreview = useCallback(async (): Promise<void> => {
    try {
      const isNative = Capacitor.isNativePlatform()
      if (isNative && currentAssetIdRef.current) {
        try { await NativeAudio.stop({ assetId: currentAssetIdRef.current }) } catch {}
        currentAssetIdRef.current = null
      } else if (!isNative && webAudioRef.current) {
        webAudioRef.current.pause()
        webAudioRef.current.currentTime = 0
        webAudioRef.current = null
      }
    } catch (e) {
      console.error("[stopPreview] 停止试听失败", e)
    }
  }, [])

  // ── 组件卸载清理 ──
  useEffect(() => {
    return () => {
      try {
        if (Capacitor.isNativePlatform()) {
          if (currentAssetIdRef.current) {
            NativeAudio.stop({ assetId: currentAssetIdRef.current }).catch(() => {})
          }
          for (const soundId of preloadedRef.current) {
            NativeAudio.unload({ assetId: `ringtone_${soundId}` }).catch(() => {})
          }
          preloadedRef.current.clear()
        } else if (webAudioRef.current) {
          webAudioRef.current.pause()
          webAudioRef.current = null
        }
      } catch {}
    }
  }, [])

  return { previewSound, stopPreview }
}
