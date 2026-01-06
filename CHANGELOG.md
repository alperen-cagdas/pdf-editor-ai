# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.

## [3.0.0] - 2026-01-06 - **Şekil Ekle & Gelişmiş Kontroller** 🎨

### Yeni Özellikler

#### 🔷 Şekil Ekleme Aracı
- **4 Şekil Türü:** Dikdörtgen, Daire, Çizgi, Ok
- **2 Stil Seçeneği:** Sadece çizgi (stroke) veya içi dolu (fill)
- **Renk Seçici:** Herhangi bir renk seçilebilir
- **Çizgi Kalınlığı:** 1-10px arası ayarlanabilir slider
- Popup menü sidebar genişliğinde

#### ⌨️ Klavye Kısayolları
- **Del** - Seçili öğeyi sil (şekil, görsel, metin)
- **Ctrl+C** - Seçili öğeyi kopyala
- **Ctrl+V** - Yapıştır (+20px offset ile)
- **Ctrl+Z** - Geri Al (Undo) - 50 adım geçmiş
- **Ctrl+Y** - Yinele (Redo)
- **Escape** - Tüm seçimleri kaldır

#### ⬅️➡️ Undo/Redo Sistemi
- 50 adıma kadar geri alma desteği
- Annotations, images ve shapes için tam destek
- Sil, ekle, taşı işlemleri geri alınabilir

#### 🔄 Shift Tuşu Desteği
- **Şekil çizerken Shift:** Mükemmel kare/daire
- **Resize ederken Shift:** Orantılı boyutlandırma (aspect ratio korunur)

#### 🖱️ Gelişmiş Mouse Kontrolleri
- **Tek tık:** Seç ve sürükle
- **Çift tık şekle:** Resize modu (köşe tutamakları görünür)
- **Çift tık boş alana:** Tüm seçimleri kaldır
- Şekiller Seç/Taşı aracıyla taşınabilir

### İyileştirmeler
- ✅ Arka plan rengi düzenleme paneli iyileştirildi
- ✅ Obje Kaldır için ayrı düzenleme modu
- ✅ Çizgi/Ok yönü mouse hareketine göre belirlenir
- ✅ Dinamik panel başlıkları (Metin Düzenle / Obje Kaldır)

---

## [2.1.0] - 2025-12-10 - **Multi-Tab & Piksellendir** 🚀

### Yeni Özellikler
- 🗂️ **Çoklu Çalışma Alanı (Tabs)** - Birden fazla PDF'i aynı anda açabilme
  - Sekme barı ile kolay geçiş
  - Her sekme bağımsız PDF, zoom, annotation desteği
  - "+" butonu ile yeni sekme oluşturma
  - Sekme kapatma özelliği

- 🖼️ **Görsel Manipülasyonu** - Eklenen görselleri düzenleme ve kırpma
  - ✨ **Gelişmiş Kırpma (Crop)**: Maskeleme yöntemi ile görüntü bozulmadan kırpma
  - Kırpma aracı: İkon ile aktif etme, çift tıklama ile onaylama
  - 📄 PDF Çıktısı: Kırpılan görseller PDF'te birebir aynı görünür (WYSWYG)
  - Köşe tutamaçlarından orantılı yeniden boyutlandırma (Aspect Ratio Lock)
  - Çift tıkla seçim ve sürükle-bırak

- 📐 **Metin Dikey Ortalama** - Yazılar kutunun tam ortasında
  - Font boyutu değişince otomatik ortalama
  - Tüm metin türlerinde çalışır

- 🔍 **Zoom Sabitleme** - Düzenlemeler yerinde kalıyor
  - Zoom değişince annotation'lar sabit
  - Orantılı koordinat ölçekleme

- 📊 **Sağ Sidebar Kontrolleri** - Yeni dikey kontrol barı
  - 72px genişliğinde ince sidebar
  - Büyük zoom butonları (44x44)
  - Sayfa numarası kutu içinde gösterim
  - Yukarı/aşağı ok navigasyonu

- 🔳 **Piksellendir Efekti** - Tarama belgesi görünümü
  - 4 seviye: Kapalı → Hafif (75%) → Orta (50%) → Yoğun (25%)
  - Her tıklamada seviye değişir
  - PDF indirmede efekt korunur
  - Tarama belgelerine uyum sağlar

### İyileştirmeler
- 🔑 **Varsayılan API Anahtarı** - Kullanıcı girmesine gerek yok
- ⚡ API key artık sharedState'de saklanıyor (tüm sekmeler için ortak)
- 🎨 Tab barı modern tasarım
- 🖱️ Geliştirilmiş hover ve cursor davranışları

---

## [2.0.0] - 2025-12-09 - **Design V2** 🎨

### Radikal Tasarım Revizyonu
- 🎨 **Sidebar'dan PDF Yükle butonu kaldırıldı** - sadece canvas sürükle-bırak kullanılıyor
- 🎨 **Modal → Inline Panel dönüşümü** - metin düzenleme artık sidebar'da
- 🎨 **Gerçek zamanlı önizleme** - değişiklikler anında canvas'ta görünüyor
- 🎨 **Eyedropper (Renk Seçici) aracı** - canvas'tan renk alma özelliği
- 🎨 **Sidebar genişletildi** (360px) - 5 stil butonu yan yana

### Yeni Özellikler
- ✅ **Görsel Ekleme** - PDF'e JPEG, PNG, GIF, WebP görseller eklenebilir
- ✅ **Obje Kaldırma** - seçilen alan arka plan rengiyle kapatılır
- ✅ **Metin Hizalama** - sola, ortaya, sağa hizalama
- ✅ **Arka plan rengi algılama** - metin değiştirmede otomatik renk tespiti
- ✅ **Yeniden boyutlandırma** - annotation'lar köşelerden yeniden boyutlandırılabilir
- ✅ **Gelişmiş AI stil kopyalama** - font ailesi, renk, kalınlık, italik algılama

### İyileştirmeler
- ⚡ Select/Move aracı için geliştirilmiş imleç davranışı
- ⚡ PDF çıktısına görsel ve obje kaldırma desteği
- ⚡ Daha iyi hata yönetimi (429 rate limit vb.)

---

## [1.1.0] - 2025-12-10

### Eklenenler
- 🖼️ Görsel ekleme ve yerleştirme özelliği
- ✨ Görsel önizleme
- 📋 Görsel annotation listesi ve yönetimi
- 🗑️ Eklenen görselleri silme desteği

## [1.0.0] - 2025-12-08

### İlk Sürüm
- ✅ PDF yükleme ve görüntüleme
- ✅ Metin değiştirme (Replace) aracı
- ✅ Metin ekleme (Add) aracı
- ✅ Seç/Taşı aracı
- ✅ Zoom kontrolü
- ✅ Sayfa navigasyonu
- ✅ Gemini AI ile font boyutu eşleştirme
- ✅ PDF indirme (düzenlemeler dahil)
- ✅ API key yönetimi ve test
- ✅ Windows installer (Setup.exe)
- ✅ Otomatik güncelleme desteği

---

## Versiyon Numaralandırma

Bu proje [Semantic Versioning](https://semver.org/) kullanır:
- **MAJOR.MINOR.PATCH** (örn: 1.2.3)
- MAJOR: Geriye uyumsuz değişiklikler
- MINOR: Yeni özellikler (geriye uyumlu)
- PATCH: Hata düzeltmeleri
