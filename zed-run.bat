@SETLOCAL
@SET DENO_DIR=.
@"%~dp0\lib\deno.exe" run -A "%~dp0\src\main.ts" run %1
@PAUSE
@ENDLOCAL