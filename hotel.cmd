@echo off
rem Ejecuta hotel.sh desde cmd.exe o PowerShell, buscando Git Bash o WSL.
rem Uso:  hotel instalar   /   hotel arrancar   /   hotel ayuda
setlocal
set "AQUI=%~dp0"
set "BASH="

where bash >nul 2>nul
if not errorlevel 1 set "BASH=bash"

if not defined BASH call :buscar "%ProgramFiles%\Git\bin\bash.exe"
if not defined BASH call :buscar "%ProgramW6432%\Git\bin\bash.exe"
if not defined BASH call :buscar "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined BASH call :buscar "C:\Program Files (x86)\Git\bin\bash.exe"
if not defined BASH goto :sinbash

"%BASH%" "%AQUI%hotel.sh" %*
exit /b %errorlevel%

:buscar
if exist %1 set "BASH=%~1"
exit /b 0

:sinbash
echo(
echo   No encuentro bash en este equipo.
echo(
echo   Este instalador necesita Git Bash o WSL. Como ya tienes git,
echo   lo normal es que Git Bash este instalado: buscalo en el menu
echo   de inicio, abrelo en esta carpeta y ejecuta:
echo(
echo       ./hotel.sh instalar
echo(
echo   Si no lo tienes: https://git-scm.com/download/win
echo(
exit /b 1
