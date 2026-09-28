@echo off
title Desplegar EAs (MARO v2.30 + smart+IA v2.30) a Terminales MT5
cd /d "%~dp0"
echo ==================================================================
echo    MARO CONSULTORES - DESPLIEGUE EAs (MARO + smart+IA v2.30)
echo ==================================================================
echo.
python deploy_eas_to_all_terminals.py
echo.
echo Presione cualquier tecla para continuar...
pause >nul
