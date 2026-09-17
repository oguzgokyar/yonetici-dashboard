---
type: development-plan
area: görsel-üretim
status: planned
created: 2026-09-17
updated: 2026-09-17
---

# Görsel Üretim — İçerik Tipi ve Dinamik Kreatif Planı

## Amaç

Görsel Üret aracını yalnızca arka plan fotoğrafı üreten bir yapıdan çıkarıp; seçilen içerik tipine göre başlık, fayda, kanıt, CTA ve marka kaynaklarını kontrollü bir reklam kreatifine dönüştüren sisteme çevirmek.

## Kapsam

- Prompt öncesinde isteğe bağlı içerik tipi seçimi
- İçerik tipine uygun fikir önerileri
- Seçilen fikir ve içerik tipine göre prompt geliştirme
- Arka plan, metin ve marka yerleşimini birlikte tarif eden kreatif planı
- AI yönlendirmeli fakat doğrulanmış marka verileri kullanan dinamik tasarım konsepti
- Üretilen görseller için tam ekran galeri
- Proje bazında fikir, kreatif ve tasarım kararlarının saklanması

## 1. İçerik tipi seçimi

Prompt alanından önce isteğe bağlı bir `İçerik tipi` alanı gösterilecek.

Seçenekler:

1. Problem–çözüm
2. Öncesi–sonrası
3. Tamamlanan proje / vaka çalışması
4. Sık sorulan soru / itiraz giderme
5. Soru / anket / tercih
6. Ürün veya hizmet tanıtımı
7. Fayda odaklı içerik
8. Otomatik seç

İçerik tipi zorunlu olmayacak. Seçim yapılmazsa AI, kullanıcı promptu ve marka bağlamına göre en uygun tipi belirleyecek. Kullanıcının veya AI'ın seçtiği tip fikir, prompt ve üretim kaydında saklanacak.

## 2. İçerik tipi kuralları

Her içerik tipi merkezi ve doğrulanabilir bir kreatif şablonuna sahip olacak. AI, bu yapıyı marka ve ürün bilgisiyle dolduracak.

Örnek — Problem–çözüm:

- Başlık: müşterinin problemi
- Destek metni: ürünün çözümü
- Görsel: problemi veya çözüm sonrası sonucu anlatan sahne
- CTA: düşük riskli eylem
- Marka alanı: seçilen logo ve iletişim kaynakları

Örnek — Öncesi–sonrası:

- Başlık: dönüşüm sonucu
- Görsel: iki bölümlü önce/sonra kompozisyonu
- Destek metni: uygulanan çözüm
- CTA: benzer proje için keşif
- Marka alanı: sade köşe imzası veya alt alan

Kaynak: [[Öncelikli 5 İçerik Türü]] ve [[Görsel İçerik Kategorileri]].

## 3. İçerik fikri servisinin yeni çıktısı

`Öneri içerik fikri al` servisi yalnızca arka plan sahnesi önermeyecek. Her öneri aşağıdaki yapı ile üretilecek:

- İçerik tipi
- Fikir adı
- Hedeflenen müşteri problemi veya arzusu
- Başlık metni
- Destekleyici metin
- CTA metni
- Gerekliyse güven unsuru
- Arka plan görselinin ayrıntılı tarifi
- Metin için negatif alan önerisi
- Marka bilgilerinin konumu
- Marka bilgisinin tasarım yaklaşımı

Örnek çıktı:

> İçerik tipi: Fayda odaklı  
> Başlık: Teras Keyfiniz Yağmurda da Devam Etsin  
> Destek metni: Kontrollü tavan sistemiyle açık alanınızı dört mevsim kullanın.  
> CTA: Ücretsiz keşif alın.  
> Arka plan: Yağmur altında, pergolanın altında kuru ve sıcak bir teras.  
> Metin alanı: Sol üstte sade negatif alan.  
> Marka yaklaşımı: Sağ altta yarı saydam kart üzerinde logo, telefon ve web sitesi.

Servis daha önce önerilen ve kullanılan fikirleri dışlayacak. Minimum 5, hedef olarak 7 benzersiz fikir sunacak.

## 4. Prompt geliştirme akışı

Prompt geliştirme şu kaynakları birleştirecek:

```text
Kullanıcı promptu
+ seçilen içerik tipi
+ seçilen içerik fikri
+ seçilen marka kaynakları
```

Çıktı iki parçaya ayrılacak:

1. Görsel modeli için arka plan üretim promptu
2. Sistem renderer'ı için yapılandırılmış kreatif planı

AI sahneyi, kompozisyonu, ışığı ve gerekli negatif alanı tasvir edecek. Logo, telefon, web sitesi ve Türkçe reklam metinleri AI görsel modeline yazdırılmayacak; sunucu tarafından doğru verilerle yerleştirilecek.

## 5. Dinamik marka tasarım konsepti

Mevcut sabit alt bant yerine AI kontrollü bir tasarım kararı üretilecek. AI yalnızca izin verilen tasarım seçeneklerinden birini veya uyumlu birleşimini seçecek:

- Alt bilgi bandı
- Yarı saydam cam kart
- Köşe imzası
- Dikey yan etiket
- Minimal alt çizgi ve iletişim satırı
- Kontrastlı CTA kartı
- Bölünmüş önce/sonra etiketi
- Hikâye anket kartı

AI şu kararları verecek:

- Marka bilgisinin konumu
- Görsel hiyerarşi
- Kart veya bant stili
- Başlık, destek metni ve CTA düzeni
- Marka ana renginin vurgu oranı
- Arka planda bırakılacak güvenli/boş alan

Güvenlik ve doğruluk sınırları:

- AI iletişim veya marka bilgisi uyduramaz.
- Yalnızca kullanıcının seçtiği marka kaynakları kullanılır.
- AI yerleşim ve stil kararı verir; gerçek metin ve logo sunucu tarafından işlenir.
- Okunabilirlik, kontrast ve Story güvenli alanları renderer tarafından doğrulanır.

## 6. Tam ekran kreatif görüntüleyici

Üretilen görsele tıklandığında tam ekran galeri açılacak.

Özellikler:

- Büyük tek görsel görünümü
- Sağ/sol oklarla geçiş
- Klavye yön tuşları
- `Escape` ile kapatma
- Mobilde kaydırarak geçiş
- Görsel indirme
- Kullanılan model, içerik tipi ve üretim tarihi
- İleride video ve paylaşım planına aktarım için uygun aksiyon alanı

`Geçmiş` sekmesi proje üretim geçmişini gösterecek ve eski kreatifler de aynı tam ekran galeride açılabilecek.

## 7. Veri mimarisi

Mevcut SQLite yapısı genişletilecek. Saklanacak alanlar:

- `content_type`
- `creative_json`
- `headline`
- `supporting_text`
- `cta`
- `brand_layout`
- `used_at`

Her proje için aşağıdaki bilgiler kalıcı olacak:

- Önerilmiş fikirler
- Kullanılmış fikirler
- Seçilen veya AI tarafından belirlenen içerik tipi
- Kullanılan metin yapısı
- Marka tasarım konsepti
- Üretilen görseller ve ilişkili kreatif planı

Mevcut kayıtlar geriye uyumlu migration ile korunacak.

## 8. Uygulama sırası

- [ ] Yedi içerik tipi için merkezi şablonları oluştur
- [ ] Görsel Üret ekranına isteğe bağlı içerik tipi seçimi ekle
- [ ] İçerik fikri API'sini yapılandırılmış kreatif planı üretecek şekilde güncelle
- [ ] Prompt geliştirme API'sini içerik tipi, fikir ve marka kaynaklarıyla güncelle
- [ ] Dinamik ve güvenli marka katmanı tasarım motorunu ekle
- [ ] Tam ekran galeri ve üretim geçmişini ekle
- [ ] Veritabanı migration'larını uygula
- [ ] Gerçek CliProxyAPI ile fikir, prompt ve görsel üretimini test et
- [ ] Lint, TypeScript ve production build kontrollerini çalıştır
- [ ] Değişiklikleri GitHub `main` dalına gönder

## Kabul kriterleri

- İçerik tipi seçimi zorunlu olmadan kullanılabilir.
- Seçilen tip tüm fikir ve prompt zincirinde korunur.
- En az 5 benzersiz fikir döner.
- Öneri; arka plan, metin, CTA ve marka yerleşimini birlikte tanımlar.
- Seçilen marka kaynakları eksiksiz ve doğru görünür.
- Farklı üretimler tek tip alt bantla sınırlandırılmaz.
- AI yanlış telefon, web sitesi, logo veya kampanya bilgisi üretemez.
- Tam ekran galeride klavye ve mobil geçiş çalışır.
- Üretim geçmişi proje bazında kalıcıdır.
- Mevcut fikir ve görsel kayıtları korunur.

## Karar durumu

Plan hazırlandı ve hafızaya kaydedildi. Uygulama başlamadan kullanıcı onayı bekleniyor.
