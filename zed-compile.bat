@SETLOCAL
@SET DENO_DIR=.
@"%~dp0\lib\deno.exe" run --reload -A "%~dp0\src\main.ts" "compile" "%0"
@PAUSE
@ENDLOCAL