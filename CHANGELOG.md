# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.

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
