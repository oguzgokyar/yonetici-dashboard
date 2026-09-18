# Postiz ile Paylaşım Planı Mimarisi

## Amaç ve sınır

Yönetici'de üretilen görsel ve videolar; içerik türüne, hedef kanala ve planlanan zamana göre Postiz Public API üzerinden otomatik paylaşım için planlanır. İlk sürümde hedefler:

- Instagram gönderisi, Reels ve hikâye
- WhatsApp durum

Yönetici, Instagram oturumunu doğrudan yönetmez; kullanıcı kendi Postiz hesabını OAuth ile yetkilendirir ve Postiz Instagram bağlantısını yönetir. Yönetici'nin sorumluluğu doğru içeriği hazırlamak, planlamak, Postiz'e **bir kez ve güvenli biçimde** teslim etmek ve sonucu kullanıcıya göstermektir.

> WhatsApp Business Cloud API, WhatsApp “Durum” paylaşımını genel olarak destekleyen bir yayın API'si değildir. Hermes'in durumu paylaşabilmesi; bağlı WhatsApp hesabında kullanıcı tarafından yetkilendirilmiş bir otomasyon/oturum veya desteklediği başka bir yöntem gerektirir. Bu nedenle kanal yeteneği Hermes tarafından bildirilmelidir; Yönetici bu özelliği varsaymamalıdır.

## Hedef mimari

```text
Görsel üretim / Video üretim
             |
             v
   Varlık kataloğu + değişmez dosya
             |
             v
 Paylaşım Planı (taslak / onay / takvim)
             |
             v
   Transactional Outbox  --->  Postiz teslim işçisi
             |                       |
             |                       +--> Instagram
             v
 Durum, hata ve yayın bağlantısı <--- Postiz API sorgusu
```

Bu yapı, kullanıcı arayüzü isteği açıkken Postiz'in yavaşlamasını veya geçici olarak erişilemez olmasını engeller. Gönderim, veritabanına kaydedilmiş bir iş üzerinden yeniden denenebilir.

## Temel alan modeli

Her proje için aşağıdaki kayıtlar tutulur. Tüm zamanlar UTC olarak saklanır, ekranda proje kullanıcısının saat diliminde (varsayılan `Europe/Istanbul`) gösterilir.

| Varlık | Amaç | Önemli alanlar |
|---|---|---|
| `media_assets` | Görsel/video için tekil katalog | `id`, `project_id`, `kind`, `mime_type`, `bytes`, `sha256`, `storage_key`, `source_job_id`, `created_at` |
| `social_destinations` | Hermes'te tanımlı yayın hedefi referansı | `id`, `project_id`, `channel`, `hermes_destination_id`, `label`, `capabilities_json`, `enabled` |
| `content_entries` | İçeriğin kanal bağımsız asıl kaydı | `id`, `project_id`, `title`, `content_type`, `status`, `primary_asset_id`, `created_at` |
| `publication_entries` | Bir içeriğin bir kanala özgü sürümü | `id`, `content_entry_id`, `destination_id`, `caption`, `hashtags_json`, `first_comment`, `asset_ids_json`, `scheduled_for`, `timezone`, `status`, `revision` |
| `delivery_jobs` | Hermes'e iletilen tekil iş | `id`, `publication_entry_id`, `idempotency_key`, `payload_json`, `state`, `attempt_count`, `next_attempt_at`, `hermes_job_id`, `last_error` |
| `delivery_events` | Denetim ve teşhis kaydı | `id`, `delivery_job_id`, `event_type`, `payload_json`, `occurred_at` |

`content_entries` ile `publication_entries` ayrımı kritiktir: aynı video, Instagram Reels için kısa açıklama ve WhatsApp durum için açıklamasız/başka bir metinle paylaşılabilir. Böylece özgün kanal metinleri ve biçimleri aynı içeriği değiştirmeden yönetilir.

## İş akışı

1. Üretim tamamlandığında görsel/video kalıcı depoya yazılır ve `media_assets` kaydı oluşur. Mevcut `generation_jobs.response_json` içindeki dosya referansları bu kataloğa taşınır; geriye dönük uyum için eski kayıtlar okunabilir kalır.
2. Kullanıcı Paylaşım Planı'nda varlığı seçer, bir ana içerik oluşturur, Instagram ve/veya WhatsApp hedefleri ekler.
3. Her hedef için açıklama, etiketler, görünürlük/format ve planlanan zaman ayrı düzenlenir. Kanalın `capabilities_json` verisi desteklenmeyen seçimleri arayüzde engeller.
4. Kullanıcı “Planla” dediğinde kayıtlar `scheduled` olur. İsteğin aynı veritabanı işlemi içinde `delivery_jobs` için `pending` outbox kaydı üretilir.
5. Bir teslim işçisi, zamanı gelmiş işleri Hermes'e yollar. Başarılı HTTP cevabı yalnızca `accepted` durumuna geçirir; “yayınlandı” anlamına gelmez.
6. Hermes; kabul, yayınlandı, başarısız veya kısmi başarı olaylarını imzalı webkancayla geri gönderir. İş durumu ve yayın URL'si güncellenir.
7. Geçici hatalar artan beklemeyle tekrar denenir. Kalıcı hata veya deneme sınırı aşımı `failed` olur ve kullanıcıya müdahale kartı gösterilir.

## Durum makinesi

```text
draft -> scheduled -> queued -> submitted -> publishing -> published
                 |        |         |             |
                 v        +---------+-------------v
              cancelled              retrying -> failed
```

- `draft`: kullanıcı düzenler, Hermes'e hiçbir şey gönderilmez.
- `scheduled`: plan kaydedildi; yayın zamanı henüz gelmedi.
- `queued`: outbox işçisi teslim için aldı.
- `submitted`: Hermes iş kimliği döndü; sonuç bekleniyor.
- `publishing`: Hermes yayın sürecini başlattığını bildirdi.
- `published`: Hermes, kanal ve mümkünse platform permalink'i ile başarı bildirdi.
- `failed`: yeniden deneme mümkün değil ya da sınır aşıldı. Kullanıcı “yeniden dene” veya “taslağa al” seçer.

İptal, Hermes işi henüz yayınlanmadıysa Hermes'e de iletilir. Yayınlanmış bir içeriği kaldırma, ayrı ve açık bir “silme” eylemi olarak tasarlanır; iptal yayın silme anlamına gelmez.

## Hermes API sözleşmesi

Yönetici ile Hermes arasında sürümlü, JSON tabanlı bir sözleşme kullanılır. Hermes URL'si ve kimlik bilgisi yalnızca sunucu ortam değişkenlerinde bulunur.

### Hedef yetenekleri

`GET /v1/publishing/destinations`

```json
{
  "destinations": [{
    "id": "hermes-instagram-acme",
    "channel": "instagram",
    "label": "Acme Instagram",
    "capabilities": ["feed_image", "feed_carousel", "reel", "story"],
    "limits": { "captionMaxLength": 2200, "videoMaxSeconds": 90 }
  }]
}
```

Bu çağrı manuel “kanalları yenile” ile ve günlük arka plan senkronuyla çalışır. WhatsApp durum hedefi yalnızca Hermes bunu döndürürse seçilebilir.

### Yayın işi oluşturma

`POST /v1/publishing/jobs`

İstek başlıkları: `Authorization: Bearer …`, `Idempotency-Key: <UUID>`, `X-Request-ID: <UUID>`.

```json
{
  "schemaVersion": "1",
  "source": { "app": "yonetici", "publicationEntryId": "…" },
  "destinationId": "hermes-instagram-acme",
  "channel": "instagram",
  "format": "reel",
  "scheduleAt": "2026-09-21T07:30:00.000Z",
  "text": { "caption": "…", "hashtags": ["…"], "firstComment": "…" },
  "media": [{
    "assetId": "…",
    "mimeType": "video/mp4",
    "url": "https://uygulama-alani/api/public/media/<kısa-ömürlü-imzalı-token>",
    "sha256": "…"
  }],
  "callbackUrl": "https://uygulama-alani/api/publishing/hermes/events"
}
```

Başarılı kabul: `202 Accepted` ve `{ "jobId": "…", "status": "accepted" }`. Hermes aynı `Idempotency-Key` için aynı işi döndürmelidir. Medya URL'si kalıcı, tahmin edilebilir `/api/assets/:id` adresi olmamalıdır: Hermes'e özel, yalnızca ilgili varlığa erişen ve süresi kısa imzalı URL verilmelidir.

### Hermes sonuç olayı

`POST /api/publishing/hermes/events`

```json
{
  "eventId": "…",
  "jobId": "hermes-job-id",
  "eventType": "published",
  "occurredAt": "2026-09-21T07:31:04.000Z",
  "publication": { "platformPostId": "…", "permalink": "https://…" },
  "error": null
}
```

`X-Hermes-Timestamp` ve `X-Hermes-Signature` başlıkları, ham istek gövdesi üzerinden HMAC-SHA256 ile doğrulanır. Olaylar `eventId` ile tekilleştirilir. İmza hatalıysa `401`; bilinmeyen iş için `404`; geçerli ama daha önce işlenmiş olay için `200` döndürülür.

## Güvenlik ve güvenilirlik

- Ortam değişkenleri: `HERMES_BASE_URL`, `HERMES_API_TOKEN`, `HERMES_WEBHOOK_SECRET`, `PUBLISHING_MEDIA_SIGNING_KEY`.
- Tokenlar arayüze, loglara veya `payload_json` içine yazılmaz. İstek günlüklerinde açıklama/metin ve imzalı URL'ler maskelenir.
- Webkanca zaman damgası beş dakikadan eskiyse reddedilir; HTTPS zorunludur ve IP izin listesi varsa ek savunma olarak uygulanır.
- Her HTTP isteğinde bağlantı ve toplam süre sınırı vardır. `429`, `5xx`, ağ kopması ve zaman aşımı tekrar denenir; `4xx` doğrulama/izin hataları tekrar denenmez.
- Önerilen deneme planı: 1, 5, 15, 60, 180 dakika; en çok 5 deneme. İşi tekrar çalıştırmak yeni iş değil, mevcut `idempotency_key` ile aynı teslim denemesidir.
- Varsayılan olarak kullanıcı onayı olmadan hemen yayın yoktur; “Şimdi paylaş” yine plan/onay akışını tetikler, yalnız `scheduled_for=now` olur.
- Aynı hedefe aynı dakikada yanlışlıkla çift paylaşımı önlemek için `destination_id + scheduled_for + asset_sha256` üzerinde uygulama katmanı çakışma kontrolü yapılır.

## Paylaşım Planı ekranı

1. **Takvim ve liste:** gün/hafta görünümü; durum, kanal, proje ve hata filtresi.
2. **İçerik seçici:** proje üretimlerinden görsel/video seçme, önizleme ve dosya uygunluğu.
3. **Kanal kartları:** Instagram ve Hermes'in sağladığı WhatsApp durum hedefleri. Her kart kendi açıklama/etiket/format/zaman alanlarını taşır.
4. **Doğrulama:** dosya tipi, boyut, en-boy oranı, süre ve metin sınırları hedef yeteneğine göre anında kontrol edilir.
5. **Teslim geçmişi:** Hermes iş kimliği, denemeler, son hata, yayın zamanı ve permalink. “Yeniden dene”, “iptal et”, “taslağa kopyala” eylemleri bulunur.

İlk sürümde içerik düzenleme yalnızca seçilmiş varlık + kanal metni ile sınırlı tutulmalıdır. Karusel sıralama, ortak takvim, onay zinciri ve performans analitiği sonraki sürümlere bırakılır.

## Uygulama katmanları

| Katman | Sorumluluk |
|---|---|
| `src/lib/server/publishing/*` | Şema doğrulama, durum geçişleri, outbox, Hermes istemcisi, imzalı medya URL'si ve retry politikası |
| `src/app/api/publishing/*` | Taslak/plan CRUD, teslim tetikleme, Hermes webkancası, hedef senkronizasyonu |
| `src/features/publishing/*` | Takvim, içerik bestecisi, hedef kartı ve teslim geçmişi |
| `src/lib/server/database.ts` | Yayın tabloları, indeksler ve geri dönüşlü migration'lar |
| Ayrı worker süreci | Zamanı gelmiş outbox işlerini ve tekrar denemeleri yürütür |

Coolify dağıtımında worker, aynı Docker image ile çalışan ikinci bir Compose servisi olmalıdır. Web sürecinin bellek içi `setInterval` zamanlayıcısına güvenilmez; restart, yatay ölçekleme ve uzun süren Hermes çağrılarında iş kaybına/çift çalışmaya neden olur. SQLite ilk sürüm için kullanılabilir; worker işi satır durumunu atomik olarak `queued` yaparak kilitler. Birden fazla worker veya yüksek hacim gerektiğinde PostgreSQL + `FOR UPDATE SKIP LOCKED` ya da bir kuyruk altyapısına geçilir.

## Uygulama sırası ve kabul ölçütleri

### Faz 1 — Temel veri ve Hermes bağlantısı

- Yayın tabloları, migration ve varlık kataloğu.
- Hermes hedef senkronu, bağlantı testi ve capability görünümü.
- İmzalı medya indirme adresi, payload şema doğrulaması ve webkanca imza doğrulaması.

Kabul: Hermes'in bildirdiği Instagram hedefi seçilebilir; WhatsApp durum yalnızca destekleniyorsa görünür; geçersiz imzalı webkanca hiçbir durumu değiştirmez.

### Faz 2 — Planlama ve teslimat

- Paylaşım Planı ekranı, kanal başına özgün metin/format/zaman.
- Outbox worker, idempotent job teslimi, iptal ve retry görünümü.

Kabul: Aynı plan iki kez tıklansa dahi Hermes'te yalnız bir iş oluşur; uygulama restartından sonra zamanı gelen iş teslim edilir; başarısız iş kullanıcıya nedeni ile görünür.

### Faz 3 — Doğrulama ve operasyon

- Dosya/format kontrolleri, permalink ve olay geçmişi.
- Health metrikleri: kuyruktaki iş sayısı, en eski bekleme süresi, başarısız iş sayısı, Hermes son erişim zamanı.
- Uyarı: tekrar denemesi biten işler için yönetici bildirimi.

Kabul: Hermes `published` olayı yayın bağlantısıyla ekrana düşer; ağ kesintisi sonrası retry başarılı olur; sırrı içeren hiçbir alan API yanıtında/logda yer almaz.

## Hermes ile netleştirilecek sözleşme soruları

Uygulamaya başlamadan Hermes tarafından şu dört nokta kesinleştirilmelidir:

1. Hangi Instagram türleri ve hangi WhatsApp durum yöntemi destekleniyor?
2. Hermes medyayı URL'den mi indiriyor, çok parçalı dosya yüklemesi mi istiyor; URL'nin gerekli en uzun yaşam süresi nedir?
3. İş planlamasını Hermes mi yapacak, yoksa Yönetici zamanı gelince mi işi gönderecek? Öneri: Yönetici zamanı gelince teslim etsin; Hermes yalnız yayın yürütücüsü olsun.
4. Başarı/hata olayları için webkanca, imza biçimi, yeniden gönderim politikasını ve iptal endpoint'ini Hermes hangi sözleşmeyle sağlıyor?

## Postiz ile önerilen uygulama

Postiz, Hermes için doğrudan kullanılabilen bir yayın katmanıdır. Bu senaryoda önerilen akış şöyledir:

```text
Yönetici -> imzalı medya URL'si + tiplenmiş yayın işi -> Hermes
Hermes -> Postiz CLI/API (yükleme, planlama, yayın) -> Instagram
Hermes -> WhatsApp Durum adaptörü                    -> WhatsApp
```

Hermes üzerinde Postiz skill kurulup `POSTIZ_API_KEY` yalnız Hermes ortamında saklanır. Hermes, içeriği doğal dil ile yorumlayıp serbestçe yayınlamamalıdır; Yönetici'nin gönderdiği tiplenmiş `channel`, `format`, `caption`, `media`, `scheduledFor` ve `destinationId` alanlarını aynen yürütmelidir. Hermes yalnız Postiz'in `integrations:list`, `integrations:settings`, medya yükleme ve iş oluşturma komutlarını kullanan adaptör görevi görür.

Postiz, Instagram feed, Reels ve hikâye yayınlama/planlama için uygun ilk sürüm altyapısıdır. Instagram hesabı Postiz'e bir kez bağlanır; Yönetici hesap anahtarlarını görmez. Daha sonraki bir çok müşterili üründe Postiz'in OAuth 2.0 bağlantısı kullanılarak her müşteri kendi Postiz hesabını yetkilendirebilir. Tek marka/tek Hermes kurulumu için API anahtarıyla başlamak daha yalındır.

Postiz'in Hermes/kanal listesinde WhatsApp bir **agent ile konuşma kanalı** olarak geçmektedir; WhatsApp Durum için açık bir yayın sağlayıcısı gösterilmemektedir. Bu yüzden WhatsApp durum işi Postiz'e zorlanmaz; Hermes'in doğrulanmış WhatsApp durum adaptörüne gider. Adaptör yoksa arayüzde “WhatsApp Durum — yapılandırılmadı” görünür, sahte başarılı yayın durumu üretilmez.

## Karar: Hermes olmadan doğrudan Postiz

Hermes katmanı kullanılmayacaktır. Bu bölüm, yukarıdaki Hermes'e yönelik sözleşme ve adaptör ayrıntılarının yerine geçer.

```text
Yönetici UI -> Yönetici API / Outbox Worker -> Postiz Public API -> Instagram
                                          ^                         |
                                          +---- durum sorgulama ------+
```

1. Kullanıcı, Yönetici'deki “Postiz ile bağlan” akışından Postiz OAuth 2.0 yetkilendirmesini tamamlar.
2. Yönetici yalnız erişim token'ını şifreli olarak saklar; Instagram hesabı ve yayın yetkileri Postiz'de bağlı kalır.
3. Worker, varlığı önce Postiz'e yükler; dönen medya referansı ile Postiz yayın planı oluşturur.
4. `postiz_post_id`, `scheduledAt` ve durum Yönetici'nin `delivery_jobs` kaydında tutulur. Worker, bekleyen/yayınlanan/başarısız durumları Postiz API'sinden sorgulayarak eşitler.
5. Kullanıcı iptal ederse Postiz'deki henüz yayınlanmamış planlı post silinir; Yönetici kaydı `cancelled` olur.

Bu yaklaşımda Hermes HTTP endpoint'i, webhook gizlisi veya özel WhatsApp adaptörü gerekmez. Kanal hedefleri Postiz entegrasyon listesinden gelir ve Instagram destekleri Postiz'in sağlayıcı ayar şeması ile doğrulanır.

WhatsApp Durum ilk sürüm kapsamından çıkarılır: Postiz belgelenmiş yayın kanalları arasında WhatsApp Durum görünmediği için bu özelliği güvenilir biçimde vaat etmek doğru değildir. İleride resmi bir Postiz sağlayıcısı veya ayrıca yetkilendirilmiş bir WhatsApp Durum sağlayıcısı doğrulanırsa, mevcut `social_destinations`/`publication_entries` modeliyle ayrı bir kanal adaptörü olarak eklenir.
