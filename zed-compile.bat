@SETLOCAL
@SET DENO_DIR=.
@"%~dp0\lib\deno.exe" run -A "%~dp0\src\main.ts" compile %1
@PAUSE
@ENDLOCAL