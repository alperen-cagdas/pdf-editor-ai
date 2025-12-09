---
description: Güncel sürümü release et - PDF Editor AI yeni versiyon yayınlama
---

# PDF Editor AI - Yeni Versiyon Yayınlama Workflow'u

Bu workflow, uygulamada yapılan değişiklikleri paketleyip yeni bir versiyon olarak yayınlar.

## Ön Koşullar
- Tüm kod değişiklikleri tamamlanmış olmalı
- Uygulama local'de test edilmiş olmalı

## Adımlar

### 1. Değişiklikleri Özetle
Kullanıcıdan şu bilgileri al:
- Yeni versiyon numarası (örn: 1.1.0, 1.2.0, 2.0.0)
- Yapılan değişikliklerin kısa özeti

### 2. Package.json Versiyonunu Güncelle
`package.json` dosyasındaki `"version"` alanını yeni versiyon numarasına güncelle.

### 3. CHANGELOG.md Güncelle
CHANGELOG.md dosyasına yeni versiyon için bir bölüm ekle:
```markdown
## [X.X.X] - YYYY-MM-DD
### Eklenenler
- Yeni özellik 1
- Yeni özellik 2

### Düzeltilenler
- Bug fix 1
```

### 4. Git Commit ve Push
// turbo
```
git add .
git commit -m "v{VERSIYON} - {ÖZET}"
git push
```

### 5. Windows Setup Oluştur
// turbo
```
cmd /c "set NODE_TLS_REJECT_UNAUTHORIZED=0 && npx electron-builder --win"
```

### 6. Dist Klasörünü Aç
// turbo
```
explorer.exe dist
```

### 7. GitHub Release Oluşturma Talimatları
Kullanıcıya şu adımları söyle:
1. https://github.com/alperen-cagdas/pdf-editor-ai/releases/new adresine git
2. Tag olarak `v{VERSIYON}` yaz
3. Release title: `PDF Editor AI v{VERSIYON}`
4. Description'a CHANGELOG'daki değişiklikleri yaz
5. `dist` klasöründen şu dosyaları yükle:
   - `PDF Editor AI Setup {VERSIYON}.exe`
   - `latest.yml`
6. "Publish release" tıkla

### 8. Onay
Kullanıcıya release'in başarıyla yayınlandığını teyit ettir.
