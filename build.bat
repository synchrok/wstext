@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ==========================================
echo  WSText - Release Build
echo ==========================================
echo.

REM Check prerequisites
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

where cargo >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Rust/Cargo not found. Install from https://rustup.rs
    pause
    exit /b 1
)

REM Install dependencies if node_modules missing
if not exist "node_modules" (
    echo [1/3] Installing npm dependencies...
    call npm install
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
) else (
    echo [1/3] Dependencies already installed, skipping...
)

echo.
echo [2/3] Building Tauri release...
call npm run tauri build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Tauri build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Collecting artifacts...
set "RELEASE_DIR=release-output"
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

REM Portable exe (raw binary)
if exist "src-tauri\target\release\WSText.exe" (
    copy "src-tauri\target\release\WSText.exe" "%RELEASE_DIR%\WSText-portable.exe" >nul
    echo   [OK] Portable: %RELEASE_DIR%\WSText-portable.exe
)

REM NSIS installer
for %%f in (src-tauri\target\release\bundle\nsis\*.exe) do (
    copy "%%f" "%RELEASE_DIR%\" >nul
    echo   [OK] NSIS Installer: %RELEASE_DIR%\%%~nxf
)

REM MSI installer
for %%f in (src-tauri\target\release\bundle\msi\*.msi) do (
    copy "%%f" "%RELEASE_DIR%\" >nul
    echo   [OK] MSI Installer: %RELEASE_DIR%\%%~nxf
)

echo.
echo ==========================================
echo  Build Complete!
echo ==========================================
echo.
echo Output directory: %CD%\%RELEASE_DIR%
echo.
dir /b "%RELEASE_DIR%"
echo.
pause
