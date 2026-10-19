@echo off
rem Daftari - run all tests on demand (double-click). Optional filter: run-tests.cmd ui journey
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required to run the tests: https://nodejs.org
  pause
  exit /b 1
)
echo Running Daftari tests... this takes a few minutes.
node tests\run.mjs %*
set RESULT=%ERRORLEVEL%
if exist "tests\report\index.html" start "" "tests\report\index.html"
if not "%RESULT%"=="0" (
  echo.
  echo Some tests failed. See the report that just opened.
  pause
)
exit /b %RESULT%
