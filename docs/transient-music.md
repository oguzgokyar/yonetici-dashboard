# Arşivsiz müzik keşfi

## Kullanım
Stok İçerik > Video özelleştirme > Ses > Müzik keşfet. Tek modalda Instagram ve YouTube sekmeleri. Kalıcı ses arşivi, yeni paket veya ücretli servis yok.

- Resmi platform sonuçları gömme izni olarak kabul edilmez; doğrulanmamış parçalar seçilemez.
- Her sekmede Scott Buckley'nin canlı WordPress kataloğundan sorguya uygun ücretsiz CC BY 4.0 alternatifler eklenir. Bunlar açıkça **trend değil** diye etiketlenir. Bazı Türkçe ruh hali kelimeleri arama terimine çevrilir; eşleşme yoksa uydurma öneri verilmez.
- Kaynak sayfasının yayın durumu, kimliği, özel CC BY 4.0 lisansı, resmi kredi ve MP3 adresi her aramada ve render öncesinde tekrar doğrulanır. İstemci canEmbed, attribution veya indirme URL'si güvenilir değildir.
- Seçilen parçanın başlangıcı kaydırılabilir; önizleme metadata ile süresi öğrenilir. Render kaynağın gerçek süresini kontrol eder.
- Müzik geçici indirilir (25 MiB/30s sınırı, HTTPS hostname/DNS güvenliği); final videoya outro dahil eklenir; başarı veya hata sonunda ses silinir. Video kaydında yalnız kimlik, başlangıç ve kredi bilgisi tutulur.
- CC BY kredi metni proje kapsamlı tamamlanmış video kaydından alınır; yayın açıklamasına ve hedef platform açıklamalarına eklenir. Düzenleme/yeniden gönderme bu krediyi düşüremez. İçerik sahibinin Content ID itiraz/credit kuralları ayrıca geçerlidir; claim olmayacağı garanti edilmez.

## İsteğe bağlı resmi keşif erişimleri
Sunucu ortamında (değerleri istemciye göndermeyin):
- INSTAGRAM_MUSIC_ACCESS_TOKEN, INSTAGRAM_MUSIC_USER_ID: uygun Facebook Login, bağlı sayfa ve Business/Creator hesabı izinleri gerekir.
- YOUTUBE_MUSIC_API_KEY: YouTube Data API erişimi. Video araması Shorts trend ses sıralaması veya indirilebilir ses kataloğu değildir.
Bunlar olmadan lisanslı alternatiflerin arama/seçim/render akışı çalışır. Resmi Instagram hitlerinin hepsini ücretsiz MP4'e gömmek desteklenmez.

## Doğrulama
- `node --test tests/*.test.mjs src/lib/server/*.test.mts`
- `npm run build`
- `node scripts/verify-transient-music.mjs`: gerçek dış kaynak araması ve ses indirmesiyle izole sentetik video üzerinde gerçek renderer çalışır; üretim DB'sine/yayına dokunmaz; çıktı ve geçici test alanı silinir.
- `node scripts/verify-music-modal.mjs`: 3199 yerel production server üzerinde mevcut Remotion Chromium ile salt-okunur desktop/mobil modal smoke testi. Yayın veya render düğmesine basmaz.

Drive kapakları artık proje/video kapsamlı WebP endpoint üzerinden taze metadata ile alınır. Görsel erişimi başarısızsa açık ikon gösterilir; disk poster arşivi yoktur. Önizleme ve render kesmeleri ortak frame-aware zaman çizelgesi kullanır; bilinmeyen kaynak/outro süresi uydurulmaz.
