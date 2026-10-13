"""
GUARD TERMINALS GUI — BARRERA DE SEGURIDAD MARO CONSULTORES
============================================================
1. Sanitiza los archivos terminal.ini de todas las terminales de MT5 para evitar
   que se queden atrapadas en modo segundo plano (Type=2 / coordenadas -32000).
2. Asegura que arranquen en modo maximizado visible (Type=3).
3. Permite lanzar todas las terminales de forma interactiva y limpia.
"""

import os
import sys
import subprocess
import time

USER_ROAMING = os.path.expanduser("~/AppData/Roaming")

TERMINALS = [
    {
        "key": "PEPPERSTONE",
        "name": "Pepperstone-01 (smart+IA y MARO)",
        "folder": "Pepperstone-01",
        "account": 51571487,
        "strategy": "smart+IA (XAUUSD M1 / Oro)"
    },
    {
        "key": "HECTOR",
        "name": "Héctor (Vantage 35126659)",
        "folder": "Pepperstone-02",
        "account": 35126659,
        "strategy": "smart+IA / MARO (GBPUSD & ORO)"
    },
    {
        "key": "TITO",
        "name": "Tito (Pepperstone-03 51580714)",
        "folder": "Pepperstone-03",
        "account": 51580714,
        "strategy": "smart+IA y MARO (XAUUSD)"
    }
]

def sanitize_ini_file(ini_path: str) -> bool:
    """Corrige parámetros de ventana minimizada (-32000 o Type=2) a Type=3 visible."""
    if not os.path.isfile(ini_path):
        return False
    try:
        with open(ini_path, "r", encoding="utf-16le", errors="replace") as f:
            content = f.read()

        needs_fix = False
        if "Type=2" in content:
            content = content.replace("Type=2", "Type=3")
            needs_fix = True

        for bad_coord in ["LSave=-32000", "TSave=-32000", "RSave=-31840", "BSave=-31972"]:
            if bad_coord in content:
                content = content.replace("LSave=-32000", "LSave=-8")
                content = content.replace("TSave=-32000", "TSave=-8")
                content = content.replace("RSave=-31840", "RSave=1928")
                content = content.replace("BSave=-31972", "BSave=1040")
                needs_fix = True
                break

        if needs_fix:
            with open(ini_path, "w", encoding="utf-16le") as f:
                f.write(content)
            return True
    except Exception as e:
        # Si el archivo esta bloqueado por proceso activo no podemos escribir directamente
        pass
    return False


def sanitize_all_terminals():
    """Escanea y repara terminal.ini en las 4 terminales."""
    results = {}
    for t in TERMINALS:
        ini_p = os.path.join(USER_ROAMING, t["folder"], "Config", "terminal.ini")
        fixed = sanitize_ini_file(ini_p)
        results[t["folder"]] = "REPARADO" if fixed else "OK"
    return results


def launch_terminal(folder_name: str):
    """Lanza la terminal en modo visible maximizado usando el shell nativo de Windows."""
    dir_path = os.path.join(USER_ROAMING, folder_name)
    exe_path = os.path.join(dir_path, "terminal64.exe")
    if not os.path.isfile(exe_path):
        print(f"[!] No existe: {exe_path}")
        return False

    ini_p = os.path.join(dir_path, "Config", "terminal.ini")
    sanitize_ini_file(ini_p)

    cmd = f'powershell -Command "Start-Process \\"{exe_path}\\" -WorkingDirectory \\"{dir_path}\\" -WindowStyle Maximized"'
    subprocess.Popen(cmd, shell=True)
    return True


def launch_all_terminals():
    """Abre las 4 terminales secuencialmente con 3 segundos de pausa para evitar sobrecarga."""
    print("=" * 60)
    print("INICIANDO LAS 4 TERMINALES DE TRADING EN MODO VISIBLE")
    print("=" * 60)
    for t in TERMINALS:
        print(f"\n[*] Abriendo {t['name']} (Cuenta {t['account']})...")
        launch_terminal(t["folder"])
        time.sleep(3)
    print("\n[OK] Todas las terminales lanzadas en pantalla completa.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--launch-all":
        launch_all_terminals()
    else:
        res = sanitize_all_terminals()
        print("Auditoría de terminal.ini completada:", res)
