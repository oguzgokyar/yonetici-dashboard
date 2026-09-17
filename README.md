# Yönetici

Markaların sosyal medya içerik üretimi, video hazırlığı ve yayın planlarını proje bazında yöneten Next.js uygulaması.

Hermes AI ile VPS kurulumu için doğrudan [`HERMES.md`](./HERMES.md) talimatını kullanın.

Kalıcı pazarlama kararları ve içerik sistemi [`Obsidian Hafıza`](./Obsidian%20Hafıza/00%20-%20Ana%20Sayfa.md) kasasında tutulur.

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
4. Uygulama domainini `app` servisine ve `APP_PORT` ile seçtiğiniz iç porta bağlayın. Varsayılan `3000`'dir.
5. Aşağıdaki ortam değişkenlerini Coolify üzerinden tanımlayın.
6. Otomatik dağıtımı kapatın; güncellemeler uygulamadaki **Ayarlar → Sistem** sekmesinden başlatılır.

### Zorunlu ortam değişkenleri

- `APP_ENCRYPTION_KEY`: API anahtarlarını şifreleyen uzun ve kalıcı sır.
- `SYSTEM_UPDATE_TOKEN`: Ayarlar ekranındaki manuel güncelleme yetkisi.
- `GITHUB_ACCESS_TOKEN`: Özel GitHub deposunda yalnızca Contents/Metadata okuma yetkili fine-grained token.
- `COOLIFY_DEPLOY_WEBHOOK`: Coolify uygulamasındaki Configuration → Webhooks → Deploy Webhook adresi.
- `COOLIFY_TOKEN`: Yalnızca `deploy` yetkili Coolify API token'ı.

`APP_PORT` isteğe bağlıdır ve varsayılanı `3000`'dir. VPS yapılandırmanızda farklı bir iç port gerekiyorsa örneğin `APP_PORT=3100` kullanın ve Coolify domain hedef portunu da `3100` seçin. Compose host portu yayınlamadığı için yalnızca container içi servis portu değişir.

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

Coolify'ın sağladığı `SOURCE_COMMIT` çalışma ortamı değişkeni çalışan sürümün commit kimliğini gösterir; ayrıca bir build secret olarak tanımlanması gerekmez.
