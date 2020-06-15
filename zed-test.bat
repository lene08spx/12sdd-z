@SETLOCAL
@SET DENO_DIR=.
@"%~dp0\lib\deno.exe" test --reload -A "%~dp0\src"
@PAUSE
@ENDLOCAL