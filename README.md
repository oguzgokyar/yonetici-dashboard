# Yönetici

Markaların sosyal medya içerik üretimi, video hazırlığı ve yayın planlarını proje bazında yöneten Next.js uygulaması.

## Yerel geliştirme

```bash
npm ci
npm run dev
```

Kalıcı uygulama verileri `.data/` dizininde tutulur ve GitHub'a gönderilmez. Üretimde `APP_ENCRYPTION_KEY` değişkenini güçlü ve kalıcı bir anahtarla tanımlayın.
Üretim sunucusunda güncelleme işlemlerini korumak için ayrı bir güçlü `SYSTEM_UPDATE_TOKEN` değeri tanımlayın.

## Sunucu güncellemeleri

Sunucu `main` dalını çalıştırır. **Sistem Ayarları → GitHub güncellemeleri** alanı yalnızca yönetici tetiklediğinde `origin/main` dalını kontrol eder. Güncelleme sırasında:

1. Yerel değişiklik olmadığı doğrulanır.
2. Yalnızca `git merge --ff-only origin/main` uygulanır.
3. Bağımlılıklar `npm ci` ile kurulur.
4. Üretim derlemesi alınır.

İşlem sonunda uygulama sürecini veya konteyneri yeniden başlatın. Özel GitHub deposu kullanılıyorsa sunucuya salt-okunur deploy key tanımlayın.
