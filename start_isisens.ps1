Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  IsıSens — Profesyonel Sistem Yönetim Paneli Başlatılıyor" -ForegroundColor DarkYellow
Write-Host "==========================================================" -ForegroundColor Cyan

$BackendDir = Join-Path $PSScriptRoot "backend"
$FrontendDir = Join-Path $PSScriptRoot "frontend"

Write-Host "[1/2] FastAPI Backend başlatılıyor (http://127.0.0.1:8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendDir'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Write-Host "[2/2] React + Vite Frontend başlatılıyor (http://127.0.0.1:5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontendDir'; npm run dev"

Write-Host ""
Write-Host "IsıSens Yönetim Paneli: http://127.0.0.1:5173" -ForegroundColor Yellow
Write-Host "FastAPI Swagger Docs  : http://127.0.0.1:8000/docs" -ForegroundColor Cyan

