# Yönetici

Markaların sosyal medya içerik üretimi, video hazırlığı ve yayın planlarını proje bazında yöneten Next.js uygulaması.

## Yerel geliştirme

```bash
npm ci
npm run dev
```

Yerelde güncelleme ekranı Git deposundaki `origin/main` dalını kullanır. Kalıcı uygulama verileri `.data/` dizininde tutulur ve GitHub'a gönderilmez.

## Coolify kurulumu

1. Coolify'da özel GitHub deposunu GitHub App veya deploy key ile bağlayın.
2. Kaynak olarak `main` dalını seçin.
3. Build Pack olarak **Docker Compose** seçin ve Compose dosyası alanına `/docker-compose.coolify.yml` yazın.
4. Uygulama domainini `app` servisine ve iç port `3000`'e bağlayın.
5. Aşağıdaki ortam değişkenlerini Coolify üzerinden tanımlayın.
6. Otomatik dağıtımı kapatın; güncellemeler uygulamadaki **Ayarlar → Sistem** sekmesinden başlatılır.

### Zorunlu ortam değişkenleri

- `APP_ENCRYPTION_KEY`: API anahtarlarını şifreleyen uzun ve kalıcı sır.
- `SYSTEM_UPDATE_TOKEN`: Ayarlar ekranındaki manuel güncelleme yetkisi.
- `GITHUB_ACCESS_TOKEN`: Özel GitHub deposunda yalnızca Contents/Metadata okuma yetkili fine-grained token.
- `COOLIFY_DEPLOY_WEBHOOK`: Coolify uygulamasındaki Configuration → Webhooks → Deploy Webhook adresi.
- `COOLIFY_TOKEN`: Yalnızca `deploy` yetkili Coolify API token'ı.

`GITHUB_REPOSITORY` varsayılan olarak `oguzgokyar/yonetici-dashboard`, `GITHUB_BRANCH` ise `main` değerini kullanır.

### Kalıcı veri

Compose dosyasındaki `yonetici-data` volume'u `/app/.data` yoluna bağlanır. SQLite veritabanı, şifreleme anahtarı ve üretilen medya bu volume içinde kalır. Volume yedeklerini Coolify üzerinden ayrıca zamanlayın.

### Sağlık kontrolü

Docker image `/api/health` adresini kontrol eder. Endpoint uygulama ve SQLite erişimi sağlıklıysa `200`, aksi durumda `503` döndürür. Coolify yeni konteyner sağlıklı başlamadan çalışan sürümü değiştirmez.

## Güncelleme akışı

Coolify ortamında uygulama çalışan konteynerin dosyalarını değiştirmez:

1. **Güncellemeleri kontrol et**, GitHub `main` commit'i ile çalışan `SOURCE_COMMIT` değerini karşılaştırır.
2. **Kararlı sürüme güncelle**, Coolify deploy webhook'una deploy-only token ile istek gönderir.
3. Coolify yeni image'ı oluşturur ve health check'i doğrular.
4. Kalıcı `.data` volume'u yeni konteynere bağlanır.

Sunucuda **Configuration → Advanced → Include Source Commit in Build** seçeneğini etkinleştirin; `SOURCE_COMMIT` çalışma ortamında kullanılmalıdır.
