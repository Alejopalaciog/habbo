@echo off
rem Ejecuta hotel.sh desde cmd.exe o PowerShell usando Git Bash.
rem Uso:  hotel.cmd instalar  /  hotel.cmd arrancar  /  hotel.cmd ayuda
rem
rem Busca Git Bash a proposito, y NO el bash del PATH: en Windows 11 ese
rem suele ser el de WSL, que no entiende rutas tipo C:\Users\... y falla
rem con "No such file or directory".
setlocal
set "AQUI=%~dp0"
set "BASH="

call :buscar "%ProgramFiles%\Git\bin\bash.exe"
call :buscar "%ProgramW6432%\Git\bin\bash.exe"
call :buscar "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
call :buscar "C:\Program Files (x86)\Git\bin\bash.exe"

rem Si no esta en las rutas habituales, lo deducimos de donde este git.exe.
if not defined BASH for /f "delims=" %%G in ('where git 2^>nul') do call :desdegit "%%~dpG"

if not defined BASH goto :sinbash

"%BASH%" "%AQUI%hotel.sh" %*
set "CODIGO=%errorlevel%"
if not "%CODIGO%"=="0" echo(& echo   [bash usado: %BASH%]
exit /b %CODIGO%

:buscar
if defined BASH exit /b 0
if exist %1 set "BASH=%~1"
exit /b 0

:desdegit
rem %1 llega como ...\Git\cmd\ ; bash.exe cuelga de ...\Git\bin\
call :buscar "%~1..\bin\bash.exe"
call :buscar "%~1..\..\bin\bash.exe"
call :buscar "%~1..\..\..\bin\bash.exe"
exit /b 0

:sinbash
echo(
echo   No encuentro Git Bash en este equipo.
echo(
echo   Opcion 1: instala Git para Windows, que lo incluye:
echo       https://git-scm.com/download/win
echo(
echo   Opcion 2: si usas WSL, abre tu distribucion y ejecuta el script
echo   desde dentro (ojo: Docker Desktop necesita tener activada la
echo   integracion con esa distribucion):
echo       cd /mnt/c/Users/USUARIO/Documents/proyectos/MyCompany/habbo
echo       ./hotel.sh instalar
echo(
exit /b 1
