"""
AUTO PUSH GITHUB — MARO CONSULTORES
====================================
Genera static_data.js desde MT5 y hace git push al repo gildardomaro/Bitacora.
Se puede lanzar manualmente, en bat, o agendar con Task Scheduler cada 30 min.

Uso:
    python auto_push_github.py           # ciclo unico
    python auto_push_github.py --watch   # loop cada 30 min
"""

import os
import sys
import subprocess
import time
import datetime
import json

# ── Configuracion ─────────────────────────────────────────────────────────────
BOT_DIR    = os.path.dirname(os.path.abspath(__file__))
DASH_DIR   = os.path.join(BOT_DIR, "dashboard")
STATIC_JS  = os.path.join(DASH_DIR, "static_data.js")
INTERVAL   = 30 * 60          # 30 minutos en segundos
GIT_REMOTE = "origin"
GIT_BRANCH = "main"
# ──────────────────────────────────────────────────────────────────────────────

def log(msg: str):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def get_git_cmd() -> str:
    """Obtiene el comando o ruta completa de git."""
    user_home = os.path.expanduser("~")
    cand1 = os.path.join(user_home, "AppData", "Local", "Programs", "Git", "cmd", "git.exe")
    if os.path.isfile(cand1):
        return cand1
    cand2 = r"C:\Program Files\Git\cmd\git.exe"
    if os.path.isfile(cand2):
        return cand2
    return "git"

def run_git(args: list, cwd: str = BOT_DIR) -> tuple[int, str, str]:
    """Ejecuta un comando git y devuelve (returncode, stdout, stderr)."""
    git_bin = get_git_cmd()
    result = subprocess.run(
        [git_bin] + args,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def ensure_git_repo():
    """Inicializa el repo git si aun no existe."""
    git_dir = os.path.join(BOT_DIR, ".git")
    if not os.path.isdir(git_dir):
        log("Repo git no encontrado. Inicializando...")
        rc, out, err = run_git(["init", "-b", "main"])
        if rc != 0:
            # git < 2.28 no soporta -b; intentar sin el flag
            run_git(["init"])
            run_git(["checkout", "-b", "main"])
        log(f"git init: {out or err}")

        # Conectar al remoto
        rc, out, err = run_git(["remote", "add", GIT_REMOTE, "https://github.com/gildardomaro/Bitacora.git"])
        log(f"git remote add: {out or err or 'OK'}")

        # Intentar hacer pull para traer el historial existente
        log("Descargando historial existente del repo...")
        rc, out, err = run_git(["pull", "--rebase", GIT_REMOTE, GIT_BRANCH])
        if rc != 0:
            log(f"Pull no pudo ejecutarse (es posible que el repo este vacio): {err}")
    else:
        log("Repo git ya inicializado.")


def sync_mt5_data():
    """Llama a dashboard_server.py para regenerar static_data.js (si esta corriendo),
    o ejecuta directamente la funcion de sincronizacion de dashboard_server."""
    import urllib.request
    try:
        with urllib.request.urlopen("http://127.0.0.1:8080/api/sync", timeout=15) as r:
            body = r.read().decode()
            log(f"API /api/sync respondio: {body[:200]}")
            return True
    except Exception as e:
        log(f"Servidor local no disponible ({e}). Ejecutando sincronizacion directa desde MT5...")
        try:
            from dashboard_server import sync_all_data_from_mt5
            ok = sync_all_data_from_mt5()
            if ok:
                log("Datos MT5 extraidos y static_data.js regenerado con exito directamente.")
                return True
            else:
                log("sync_all_data_from_mt5 retorno False.")
        except Exception as ex_sync:
            log(f"Error ejecutando sync_all_data_from_mt5: {ex_sync}")
    return False


def add_timestamp_to_static_data():
    """Inyecta/actualiza el campo generated_at en static_data.js para que el
    dashboard muestre cuando se publicaron los datos."""
    if not os.path.isfile(STATIC_JS):
        log("static_data.js no encontrado — saltando inyeccion de timestamp.")
        return

    with open(STATIC_JS, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    ts = datetime.datetime.utcnow().isoformat() + "Z"
    new_field = f'  generated_at: "{ts}",'

    if "generated_at:" in content:
        import re
        content = re.sub(r'  generated_at: ".*?",', new_field, content)
    else:
        # Insertar despues de la primera llave de apertura del objeto raiz
        content = content.replace(
            "window.STATIC_DASHBOARD_DATA = {",
            f"window.STATIC_DASHBOARD_DATA = {{\n{new_field}",
            1
        )

    with open(STATIC_JS, "w", encoding="utf-8") as f:
        f.write(content)

    log(f"Timestamp inyectado en static_data.js: {ts}")


def sync_files_to_root():
    """Copia los archivos actualizados del dashboard a la raiz del repositorio
    para que GitHub Pages (que sirve desde la raiz) muestre exactamente los mismos
    datos en tiempo real."""
    import shutil
    files_to_copy = [
        "static_data.js",
        "index.html",
        "app.js",
        "auth.js",
        "styles.css",
        "chart.umd.min.js",
        "lightweight-charts.standalone.production.js",
        "logo_maro.jpg"
    ]
    for fn in files_to_copy:
        src = os.path.join(DASH_DIR, fn)
        dst = os.path.join(BOT_DIR, fn)
        if os.path.isfile(src):
            try:
                shutil.copy2(src, dst)
            except Exception as e:
                log(f"Error copiando {fn} a la raiz: {e}")
    log("Archivos del dashboard sincronizados a la raiz (GitHub Pages root).")


def git_push():
    """Stage -> Commit -> Pull Rebase -> Push del dashboard al repo de GitHub."""
    # Sincronizar siempre a la raiz antes de verificar cambios
    sync_files_to_root()

    # Stage de dashboard y archivos raiz
    files_to_stage = [
        "dashboard/",
        "index.html",
        "static_data.js",
        "app.js",
        "auth.js",
        "styles.css",
        "VER_DASHBOARD_LOCAL.html"
    ]
    rc, out, err = run_git(["add"] + files_to_stage)
    if rc != 0:
        log(f"Error en git add: {err}")
        return False

    # Status de los archivos staged
    rc, out, _ = run_git(["diff", "--cached", "--name-only"])
    if not out:
        log("Sin cambios pendientes de commit en dashboard/ ni raiz.")
        # Intentamos push de cualquier commit local pendiente
        rc_push, _, _ = run_git(["push", GIT_REMOTE, GIT_BRANCH])
        return rc_push == 0

    log(f"Archivos listos para commit:\n{out}")

    # Commit
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    msg = f"Auto-update: datos de trading {ts}"
    rc, out, err = run_git(["commit", "-m", msg])
    if rc != 0:
        log(f"Error en git commit: {err}")
        return False
    log(f"Commit creado: {msg}")

    # Traer posibles cambios remotos (ej. /minuta/) para evitar rechazos
    log("Sincronizando con remoto (git pull --rebase --autostash)...")
    rc_pull, out_pull, err_pull = run_git(["pull", "--rebase", "--autostash", GIT_REMOTE, GIT_BRANCH])
    if rc_pull != 0:
        log(f"Aviso en git pull --rebase: {err_pull or out_pull}")

    # Push
    log(f"Pusheando a {GIT_REMOTE}/{GIT_BRANCH}...")
    rc, out, err = run_git(["push", GIT_REMOTE, GIT_BRANCH])
    if rc != 0:
        log(f"Error en git push: {err}")
        log("CONSEJO: Asegurate de haber configurado tus credenciales de GitHub.")
        return False

    log(f"Push exitoso. Dashboard disponible en: https://gildardomaro.github.io/Bitacora")
    return True


def run_once():
    """Ejecuta un ciclo completo: sanitizar terminales -> sync datos -> timestamp -> push."""
    log("=" * 60)
    log("INICIANDO CICLO DE PUBLICACION Y AUDITORIA")
    log("=" * 60)
    # Barrera de seguridad: Sanitizar terminal.ini para evitar modo segundo plano en MT5
    try:
        from guard_terminals_gui import sanitize_all_terminals
        res = sanitize_all_terminals()
        log(f"Auditoria visual de terminales MT5: {res}")
    except Exception as ex_guard:
        log(f"Aviso en guard_terminals_gui: {ex_guard}")

    ensure_git_repo()
    sync_mt5_data()
    add_timestamp_to_static_data()
    git_push()
    log("CICLO COMPLETADO")
    log("")


def run_watch():
    """Corre en bucle cada INTERVAL segundos."""
    log(f"Modo WATCH activado — publicando cada {INTERVAL//60} minutos.")
    log("Presiona Ctrl+C para detener.")
    while True:
        run_once()
        next_run = datetime.datetime.now() + datetime.timedelta(seconds=INTERVAL)
        log(f"Proxima publicacion: {next_run.strftime('%H:%M:%S')}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    if "--watch" in sys.argv:
        run_watch()
    else:
        run_once()
