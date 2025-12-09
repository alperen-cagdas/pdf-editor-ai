@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║         PDF Editor AI - Güncelleme Yayınlama             ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Versiyon bilgisini al
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"version\"" package.json') do (
    set VERSION=%%a
)
set VERSION=%VERSION:"=%
set VERSION=%VERSION: =%

echo [INFO] Mevcut versiyon: v%VERSION%
echo.

:: Kullanıcıdan yeni versiyon al
set /p NEW_VERSION="Yeni versiyon numarası (örn: 1.1.0): "
if "%NEW_VERSION%"=="" (
    echo [HATA] Versiyon numarası boş olamaz!
    pause
    exit /b 1
)

:: Commit mesajı al
set /p COMMIT_MSG="Commit mesajı (değişikliklerin özeti): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=v%NEW_VERSION% güncellemesi

echo.
echo ════════════════════════════════════════════════════════════
echo [1/5] Package.json güncelleniyor...
echo ════════════════════════════════════════════════════════════

:: PowerShell ile package.json güncelle
powershell -Command "(Get-Content package.json) -replace '\"version\": \"%VERSION%\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"

echo [OK] Versiyon %VERSION% -> %NEW_VERSION% olarak güncellendi
echo.

echo ════════════════════════════════════════════════════════════
echo [2/5] Git commit yapılıyor...
echo ════════════════════════════════════════════════════════════

git add .
git commit -m "v%NEW_VERSION% - %COMMIT_MSG%"

echo [OK] Commit tamamlandı
echo.

echo ════════════════════════════════════════════════════════════
echo [3/5] GitHub'a push ediliyor...
echo ════════════════════════════════════════════════════════════

git push

echo [OK] Push tamamlandı
echo.

echo ════════════════════════════════════════════════════════════
echo [4/5] Windows Setup oluşturuluyor... (Bu biraz zaman alabilir)
echo ════════════════════════════════════════════════════════════

set NODE_TLS_REJECT_UNAUTHORIZED=0
call npx electron-builder --win

echo [OK] Setup oluşturuldu
echo.

echo ════════════════════════════════════════════════════════════
echo [5/5] İşlem tamamlandı!
echo ════════════════════════════════════════════════════════════
echo.
echo Dist klasöründeki dosyalar:
dir /b dist\*.exe dist\*.yml 2>nul
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║  SONRAKİ ADIMLAR (Manuel yapmanız gerekiyor):            ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║  1. GitHub'a gidin:                                      ║
echo ║     https://github.com/alperen-cagdas/pdf-editor-ai      ║
echo ║                                                          ║
echo ║  2. Releases > Create new release                        ║
echo ║                                                          ║
echo ║  3. Tag: v%NEW_VERSION%                                        ║
echo ║                                                          ║
echo ║  4. dist klasöründen şu dosyaları yükleyin:              ║
echo ║     - PDF Editor AI Setup %NEW_VERSION%.exe                    ║
echo ║     - latest.yml                                         ║
echo ║                                                          ║
echo ║  5. Publish Release                                      ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Dist klasörünü aç
explorer.exe dist

pause
