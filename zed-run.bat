@SETLOCAL
@SET DENO_DIR=.
@"%~dp0\lib\deno.exe" run --reload -A "%~dp0\src\main.ts" "run" "%0"
@PAUSE
@ENDLOCAL