# Hermes AI — Coolify Kurulum Talimatı

Bu dosya, Yönetici uygulamasını bir VPS üzerindeki mevcut Coolify kurulumuna dağıtacak otomasyon ajanı için bağlayıcı çalışma talimatıdır.

## Hedef durum

- Kaynak: `https://github.com/oguzgokyar/yonetici-dashboard`
- Dal: `main`
- Dağıtım yöntemi: Git kaynağından Docker Compose
- Compose dosyası: `/docker-compose.coolify.yml`
- Uygulama servisi: `app`
- İç port: `APP_PORT` (varsayılan `3000`)
- Kalıcı veri: `yonetici-data` volume → `/app/.data`
- Sağlık kontrolü: `GET /api/health`
- Otomatik Git deployment: kapalı
- Güncelleme yöntemi: uygulama içindeki **Ayarlar → Sistem** üzerinden Coolify deploy webhook

## Güvenlik sınırları

1. Secret değerlerini repoya, deployment loguna veya sohbet çıktısına yazma.
2. `.data` dizinini image katmanına veya GitHub'a ekleme.
3. Mevcut Coolify kaynaklarını, volume'ları ya da başka uygulamaları silme.
4. İlk başarılı health check görülmeden çalışan sürümü kaldırma.
5. `COOLIFY_TOKEN` için yalnızca `deploy` yetkisi kullan.
6. `GITHUB_ACCESS_TOKEN` için yalnızca bu özel depoda `Contents: Read-only` ve `Metadata: Read-only` yetkisi kullan.
7. Kullanıcı tarafından sağlanmayan GitHub veya Coolify token'larını tahmin etme; eksikse işlemi durdurup yalnızca eksik secret adlarını bildir.

## Ön koşullar

- VPS üzerinde çalışan ve dışarıdan erişilebilen Coolify
- Coolify API Access etkin
- Uygulama için hazırlanmış domain ve DNS kaydı
- Özel GitHub deposuna erişebilen Coolify GitHub App veya deploy key
- Aşağıdaki secret değerleri:
  - `APP_ENCRYPTION_KEY`
  - `SYSTEM_UPDATE_TOKEN`
  - `GITHUB_ACCESS_TOKEN`
  - `COOLIFY_TOKEN`

`APP_ENCRYPTION_KEY` ve `SYSTEM_UPDATE_TOKEN` yoksa birbirinden farklı en az 32 baytlık rastgele değerler üret. Üretilen değerleri yalnızca Coolify secret alanına kaydet; açık şekilde raporlama.

## Kurulum sırası

1. Coolify'da uygun Project ve Production Environment seç.
2. GitHub kaynağı olarak `oguzgokyar/yonetici-dashboard` özel deposunu bağla.
3. Branch değerini `main` yap.
4. Build Pack olarak `Docker Compose` seç.
5. Compose Location değerini `/docker-compose.coolify.yml` yap.
6. Coolify'ın Compose içindeki `app` servisini ve `yonetici-data` volume'unu algıladığını doğrula.
7. VPS/Coolify ortamında uygun boş iç portu belirle. `APP_PORT` tanımlı değilse `3000` kullan. Uygulama domainini `app` servisine bu port üzerinden bağla ve HTTPS etkinleştir.
8. Configuration → Webhooks alanından auth-required Deploy Webhook URL'sini al.
9. Coolify Keys & Tokens alanında yalnızca `deploy` yetkili API token oluştur.
10. Ortam değişkenlerini aşağıdaki tabloya göre ekle.
11. Auto Deploy özelliğini kapat. Kullanıcı onayı olmadan GitHub push'u production deployment başlatmamalı.
12. İlk deployment'ı Coolify panelinden manuel başlat.
13. Build, container başlangıcı ve health check başarılı olana kadar deployment logunu izle.

## Ortam değişkenleri

| Değişken | Zorunlu | Değer |
|---|---:|---|
| `NODE_ENV` | Evet | `production` |
| `APP_PORT` | Hayır | Boşsa `3000`; gerekirse uygun başka bir container iç portu |
| `APP_ENCRYPTION_KEY` | Evet | Uzun ve kalıcı secret |
| `SYSTEM_UPDATE_TOKEN` | Evet | Ayrı bir uzun yönetici secret'ı |
| `GITHUB_REPOSITORY` | Evet | `oguzgokyar/yonetici-dashboard` |
| `GITHUB_BRANCH` | Evet | `main` |
| `GITHUB_ACCESS_TOKEN` | Evet | Fine-grained, yalnızca repo okuma token'ı |
| `COOLIFY_DEPLOY_WEBHOOK` | Evet | Bu uygulamanın auth-required deploy webhook URL'si |
| `COOLIFY_TOKEN` | Evet | Yalnızca `deploy` yetkili Coolify token'ı |

Değişkenleri build arg olarak image katmanına yazma. Coolify runtime environment/secret olarak tanımla.

## İlk deployment kabul testleri

Aşağıdaki kontrollerin tamamı geçmeden kurulumu tamamlanmış sayma:

1. Coolify container durumu `healthy` olmalı.
2. `https://<domain>/api/health` isteği HTTP `200` ve `{ "ok": true }` döndürmeli.
3. `https://<domain>/projects` sayfası açılmalı.
4. Yeni bir test projesi oluşturulabilmeli.
5. Container restart veya normal redeploy sonrasında test projesi korunmalı. Bu test `/app/.data` volume'unun kalıcı olduğunu doğrular.
6. Ayarlar → API Yönetimi sayfasında kaydedilen sağlayıcı yapılandırması sayfa yenilendiğinde korunmalı.
7. Ayarlar → Sistem ekranında çalışan commit ve GitHub `main` commit'i görüntülenmeli.
8. Health check veya build başarısızsa eski çalışan sürüm erişilebilir kalmalı.

Kabul testinden sonra yalnızca test amacıyla oluşturulan projeyi uygulama arayüzünden sil.

## Güncelleme testi

1. GitHub `main` dalında çalışan sürümden daha yeni, doğrulanmış bir commit olduğunda Ayarlar → Sistem'e git.
2. `SYSTEM_UPDATE_TOKEN` değerini yönetici alanına gir.
3. **Güncellemeleri kontrol et** işleminin yeni commit'i gösterdiğini doğrula.
4. **Kararlı sürüme güncelle** işlemini başlat.
5. Coolify'da yeni deployment'ın kuyruğa girdiğini doğrula.
6. Yeni container `healthy` olmadan eski container'ı durdurma.
7. Deployment sonrası `/api/health`, `/projects` ve veri kalıcılığı kontrollerini tekrarla.

## Yedekleme ve geri dönüş

- `yonetici-data` volume'u için Coolify üzerinden düzenli yedekleme planı oluştur.
- En az bir yedeği VPS dışındaki bir hedefte sakla.
- Uygulama deployment geçmişini koru.
- Hatalı sürümde Coolify deployment geçmişinden son sağlıklı commit'e geri dön; volume'u silme veya yeniden oluşturma.
- Veritabanı sorunu varsa önce volume yedeği al, ardından geri yükleme uygula.

## Başarı raporu

Kurulum sonunda secret değerleri göstermeden şu bilgileri raporla:

- Uygulama domaini
- Coolify resource adı/UUID'si
- Dağıtılan Git commit kısa SHA'sı
- Health check sonucu
- Kalıcı volume adı ve mount hedefi
- Auto Deploy durumunun kapalı olduğu
- Manuel güncelleme testinin sonucu
- Yedekleme planının durumu
