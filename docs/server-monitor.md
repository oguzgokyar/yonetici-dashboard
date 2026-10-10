# Sunucu izleme (salt okunur)

`/settings` → **Sunucu**. Başka DashboardShell, üretim kuyruğu veya worker oluşturmaz. İşler mevcut `generation_jobs` SQLite tablosundan okunur. API yalnızca GET; oturum POST’u sadece erişim doğrular, iş başlatmaz/durdurmaz.

## Erişim

- `SERVER_MONITOR_ADMIN_TOKEN` (yoksa mevcut `SYSTEM_UPDATE_TOKEN`): panelde girilen yönetici anahtarı. Yapılandırılmadığında erişim kapalıdır (geliştirmede de).
- `POST /api/system/server-status/session`, aynı-origin JSON `{token}`. HttpOnly/SameSite=Strict, 30 dakika, yalnız `/api/system/server-status` yolunda imzalı cookie. Üretimde Secure.
- `GET /api/system/server-status?view=active|queued|history&offset=0`: cookie zorunlu, `Cache-Control: no-store`, üretim kayıtları 25/sayfa. Hassas serbest metin prompt/request/error/progress-detail döndürülmez.
- Origin kontrolü mevcut güvenilir origin ayarını (`MUSIC_SETTINGS_TRUSTED_ORIGIN`) kullanır; proxy gelen keyfi forwarding headerları güvenilir değildir.

## Uzak collector anlaşması

Sunucu tarafında `SERVER_MONITOR_HOST_URL` tam `/metrics` URL’si ve `SERVER_MONITOR_HOST_TOKEN`. GET Bearer auth; 3 sn timeout; redirect yasak; maksimum 64 KiB. Gizli değer istemciye aktarılmaz. Bu özellik collector açmaz, paylaşılan scripts değiştirmez ve herhangi bir servisi restart etmez. HTTP yalnız güvenilir private networkte; diğer durumlarda HTTPS kullanın.

Beklenen `/metrics` JSON:

```json
{
  "scope": "local-proc",
  "sampledAt": "2026-10-08T21:00:00Z",
  "cpuPercent": null,
  "memory": {"totalBytes": 100, "usedBytes": 10},
  "swap": {"totalBytes": 0, "usedBytes": 0, "inBytesPerSecond": null, "outBytesPerSecond": null},
  "processes": [],
  "jobs": []
}
```

Bu JSON bir protokol örneğidir, gerçek sunucu ölçümü değildir. `scope` yalnız `host` veya `local-proc`; **uzak olmak host kapsamını kanıtlamaz**. Collector yalnız gerçekten tam host görünürlüğü varsa `host` gönderir. Namespace sınırlı collector `local-proc` gönderir ve panel bunu host diye yükseltmez. Process alanları `{pid,category,rssBytes}`; category `browser|node|python|ffmpeg|other`, maksimum 12. İsteğe bağlı `jobs` maksimum 100 kayıt: `{id,service:seo|canva|other,status:queued|starting|running|complete|failed|released,createdAt,startedAt,finishedAt,heartbeat,progressPercent}`. Zamanlar ISO/null, ilerleme number/null. Gerçek başlangıç yoksa null; rezervasyon bırakılması başarılı iş sonucu gibi sunulmaz. `jobs` yoksa "iş kayıtları kullanılamıyor" gösterilir.

## Sınırlar

- Yerel fallback gerçek `/proc/stat`, `/proc/meminfo`, `/proc/vmstat` ve namespace’de görünür process status okur. Kernel metrikleri ortak host olabilir; konteyner cgroup limitleri / tüketimi değildir. Tam host process görünürlüğü iddia edilmez.
- CPU iki örnek arasında delta; ilk istek ~150ms örnekleme bekler; 4 saniye cache ve eşzamanlı istek dedup. Swap page size auxv’den biliniyorsa byte/s, bilinmiyorsa null.
- RSS ortak belleği çift sayabilir. PSS, süreç ağacı, commandline ve environment taraması yok.
- Üretim işlerinin gerçek started_at, PID, manuel/zamanlı ayrımı şemada yok; null / açıklama gösterilir. updatedAt ilerleme sinyalidir, liveness kanıtı değildir; 60sn eski/yok uyarısı işi otomatik başarısız yapmaz.
- Uzak örnek 15sn eskiyse stale; erişim başarısızsa ayrı unavailable/unconfigured. Host verisi yoksa local-proc etiketiyle fallback; sıfır host ölçümü uydurulmaz.
- Açık/görünür Sunucu panelinde 5sn polling, gizliyken iptal, tab değiştirmede cleanup. SEO gece planları, kayıtsız servisler ve semantic başarı geçmişi collector instrumentation gerektirir.
- Kaynak kapısı, CPU kotası, tab/worker limiti, PID kill veya browser workflow API migrasyonu yok.
