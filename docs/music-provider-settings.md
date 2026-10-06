# Müzik kaynakları yönetimi

Sistem Ayarları → API Yönetimi → Müzik Kaynakları. Anahtar ve OAuth bağlantıları Postiz yayın hesaplarından bağımsızdır.

## Yönetici erişimi

Yeni yönetim rotaları yönetici doğrulaması olmadan erişime kapalıdır. `MUSIC_SETTINGS_ADMIN_TOKEN` varsa kullanılır; yoksa mevcut `SYSTEM_UPDATE_TOKEN` kullanılır. Ekranda yönetici anahtarını girerek 30 dakikalık HttpOnly, SameSite=Lax yönetim oturumu açılır. Sırlar localStorage'a yazılmaz. Kilitle işlemi tarayıcı cookie'sini siler; kopyalanmış oturumlar süre sonuna kadar geçerlidir. Yönetici anahtarının rotasyonu tüm imzaları geçersiz kılar.

Reverse proxy üzerinde `MUSIC_SETTINGS_TRUSTED_ORIGIN=https://markamotoru.atolyehanem.com` ayarlanmalıdır. Bu değer OAuth callback ve aynı-kaynak doğrulamasında kullanılır; rastgele forwarded host başlıklarına güvenilmez. Docker Compose kullanılıyorsa bu ortam değişkeninin uygulama konteynerine aktarılması gerekir. Üretimde yalnız HTTPS kullanın. Yönetici girişinde en fazla beş deneme/15 dakika sınırı vardır. Proxy güveni varsayılan kapalıdır; proxy güvenli şekilde başlıkları temizliyorsa `MUSIC_SETTINGS_TRUST_PROXY=1` etkinleştirilebilir.

## YouTube

Google Cloud projesinde YouTube Data API v3 etkinleştirin. API anahtarıyla public müzik videosu keşfi yapılabilir. Bölge varsayılan TR'dir. İsteğe bağlı OAuth için Web Application Client ID/Secret girin; ekrandaki callback adresini Google'da tanımlayın ve Google ile bağlanın. Read-only YouTube ve hesap tanımlama izinleri kullanılır; PKCE ve tek kullanımlık state doğrulanır. Süresi dolan Google erişim tokenı refresh token ile yenilenir.

## Instagram

Facebook Login uyumlu Meta uygulama ID/Secret girin. Professional Instagram hesabı Facebook Sayfasına bağlı olmalıdır. Meta ile bağlanıp sunucuda doğrulanan hesabı seçin. Gerekli uygulama/hak izinleri ve Audio API katalog erişimi Meta tarafından sağlanmalıdır; tokenın geçerli olması katalog erişimini garanti etmez. İleri seviye alanından User Access Token ve Instagram User ID girilebilir. Meta token süresi dolduğunda yeniden bağlantı gerekir; sahte otomatik yenileme yapılmaz.

## Yaşam döngüsü ve güvenlik

Kaydet / bağlantıyı test et / yeniden bağlan / bağlantıyı kes / kaldır / devre dışı bırak kontrolleri vardır. Sır alanı boşsa mevcut değer korunur. YouTube anahtarını silme açık ayrı işlemdir. Bağlantıyı kesme yerel OAuth verilerini temizler ve mümkünse sağlayıcı iznini iptal etmeyi dener. Kaldır tüm müzik sağlayıcısı ayarlarını temizler ve ortam değişkeni fallback'inin yeniden etkinleşmesini engeller. Provider izinlerini hesap ayarlarından ayrıca inceleyin.

Anahtar, access/refresh token ve client secret mevcut AES-GCM altyapısıyla şifrelenir. Public GET yalnız maskeli durum döndürür. Hesap seçimi sunucu tarafından doğrulanan seçeneklerle sınırlıdır. Otomatik bağlantı testi/kota tüketimi yoktur; test açık kullanıcı eylemidir.

Müzik listesi tek satırlıdır; tekrar eden lisans paragrafları kaldırılmıştır. Gömme izni sunucuda yeniden kontrol edilir, zorunlu CC BY atfı yayın açıklamasında korunur. YouTube keşfi Shorts trend sesi kataloğu değildir; OAuth/API anahtarı ses indirme veya platformlar arası MP4 gömme hakkı vermez.

## Doğrulama

`node --test tests/*.test.mjs src/lib/server/*.test.mts`

`npm run build`

`UI_SMOKE_BASE=http://127.0.0.1:<test-port> node scripts/verify-music-modal.mjs`

`UI_SMOKE_BASE=http://127.0.0.1:<test-port> node scripts/verify-music-settings.mjs`

Yalnız test sunucusunda sentetik yönetici anahtarıyla kartları kontrol etmek için `UI_SMOKE_ADMIN_TOKEN` kullanılabilir. Gerçek sağlayıcı hesabıyla izin akışı kullanıcı onayı ve uygulama kimlik bilgileri olmadan doğrulanmış sayılmaz. Browser testleri sağlayıcı sırlarını kaydetmez veya sosyal paylaşım oluşturmaz.
