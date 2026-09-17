---
type: development-plan
area: görsel-üretim
status: implemented-awaiting-live-generation-test
created: 2026-09-17
updated: 2026-09-17
---

# Görsel Üretim — Hızlı Mod ve Marka Konsepti Planı

## Amaç

Marka konseptini kullanıcıdan uzun bir form istemeden otomatik oluşturmak ve bütün görsel üretimlerinin bu konsepte uygun gerçekleşmesini sağlamak.

## 1. Marka bilgilerini getir

Proje Ayarları → Marka Bilgileri bölümündeki mevcut **Marka bilgilerini getir** işlemi genişletilecek.

AI web sitesini incelerken aynı anda:

- Marka bilgilerini
- Ana ve yardımcı renkleri
- Markanın genel karakterini
- Görsel tasarım dilini
- Fotoğraf stilini
- İletişim tonunu

belirleyecek.

Bulunan bilgiler boş marka alanlarına, oluşturulan marka konsepti ise doğrudan projeye kaydedilecek.

Örnek konsept:

> Modern, güvenilir ve premium. Antrasit ve beyaz ağırlıklı, mor vurgu renkli; temiz tipografi, mimari fotoğraflar ve ferah kompozisyonlar kullanılmalı.

## 2. Konsept oluşturma ve güncelleme

Proje Ayarları menüsüne **Marka Konsepti** bölümü eklenecek.

Bu bölümde:

- Mevcut konsept görüntülenecek.
- Konsept metni elle değiştirilebilecek.
- Konsept AI ile yeniden oluşturulabilecek.
- Değişiklikler kaydedilebilecek.
- Renkler ve tasarım karakteri küçük bir temsili grafik üzerinde gösterilecek.

Marka konsepti yoksa mevcut marka bilgilerinden tek tıkla oluşturulabilecek.

## 3. Görsel üretiminde zorunlu marka konsepti

Her görsel üretimi aşağıdaki bağlamla hazırlanacak:

```text
Kullanıcı anlatımı
+ içerik tipi
+ seçilen marka bilgileri
+ kayıtlı marka konsepti
= nihai kreatif talimatı
```

Marka konsepti kullanıcı tarafından ayrıca seçilmeyecek veya kapatılamayacak. Sunucu, projenin güncel konseptini otomatik olarak şu aşamalarda kullanacak:

- İçerik fikri önerisi
- Prompt geliştirme
- Sahne ve kompozisyon kararı
- Renk ve tipografi yaklaşımı
- Logo ve iletişim bilgilerinin yerleşimi
- Nihai görsel üretimi

## 4. Hızlı Mod

Görsel üretiminde kullanıcı yalnızca şunları belirleyecek:

- İsteğe bağlı içerik tipi
- Ürün veya anlatılacak konu
- Görselde bulunacak metinler
- Kullanılacak marka kaynakları
- Görsel oranı
- Görsel sayısı

AI, kayıtlı marka konseptine göre sahneyi, kompozisyonu ve tasarım yaklaşımını kendisi oluşturacak.

## 5. Uygulama sırası

- [x] Marka bilgisi getirme servisine marka konsepti araştırmasını ekle
- [x] Konsepti proje veritabanında sakla
- [x] Proje Ayarları'na Marka Konsepti ekranını ekle
- [x] Düzenleme, kaydetme ve AI ile yeniden oluşturma işlemlerini ekle
- [x] Basit temsili konsept grafiğini ekle
- [x] Görsel Üret ekranına Hızlı Modu uygula
- [x] Marka konseptini bütün görsel üretim zincirinde zorunlu kullan
- [ ] Gerçek modelle yeni görsel üretip marka tutarlılığını gözle kontrol et

## Kabul kriterleri

- Marka bilgileri web sitesinden getirilirken marka konsepti de otomatik araştırılır ve kaydedilir.
- Marka konsepti Proje Ayarları'nda görülebilir, değiştirilebilir ve AI ile yeniden oluşturulabilir.
- Konseptin görünümü basit bir temsili grafikle anlatılır.
- Hızlı Mod az sayıda alanla görsel üretimi başlatır.
- Kayıtlı marka konsepti bütün görsel üretimlerinde otomatik ve zorunlu olarak kullanılır.
- AI yanlış marka veya iletişim bilgisi uyduramaz.
- Mevcut proje ve üretim kayıtları korunur.

## Karar durumu

Plan uygulanmıştır. Lint, production build, API ve arayüz kontrolleri tamamlanmıştır. Son adım gerçek modelle yeni bir görsel üretip marka tutarlılığını gözle kontrol etmektir.
