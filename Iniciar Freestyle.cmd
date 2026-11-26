@echo off
setlocal
title Freestyle Arena - Desarrollo local
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 22 instalado para iniciar Freestyle.
  pause
  exit /b 1
)
node "%~dp0scripts\start-local.cjs"
if errorlevel 1 (
  echo.
  echo No se pudo completar el inicio. Revisa el mensaje anterior.
  pause
  exit /b 1
)
