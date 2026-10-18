# PyInstaller recipe: builds dist/RapidLabels/RapidLabels.exe (one folder, packed by installer.iss)
# Run from repo root:  pyinstaller desktop/rapid_labels.spec --noconfirm
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

ROOT = Path(SPECPATH).parent
BACKEND = ROOT / "backend"

datas = [
    (str(ROOT / "frontend" / "dist"), "frontend_dist"),
    (str(BACKEND / "seed_data"), "seed_data"),
    (str(ROOT / "desktop" / "build" / "mongodb"), "mongodb"),
    (str(ROOT / "desktop" / "build" / "app.json"), "."),
]
binaries = []
# backend packages listed from the file system (importing them here would need a database URL)
backend_mods = [f"{pkg}.{f.stem}" for pkg in ("routers", "models", "lib") for f in (BACKEND / pkg).glob("*.py") if f.stem != "__init__"]
hiddenimports = (
    ["server", "seed", "import_seed_data", "routers", "models", "lib",
     "odf", "xlrd", "openpyxl", "multipart", "python_multipart", "tzdata"]
    + backend_mods
    + collect_submodules("uvicorn")
)
datas += collect_data_files("tzdata")
for pkg in ("webview",):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(
    [str(ROOT / "desktop" / "launcher.py")],
    pathex=[str(BACKEND)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    # leave out tests & unused libraries: smaller install, fewer files for antivirus to scan -> faster first start
    excludes=["emergentintegrations", "tkinter", "matplotlib", "pytest", "IPython", "notebook", "scipy", "PIL",
              "pandas.tests", "numpy.tests", "numpy.f2py", "sqlalchemy", "pyarrow"],
    noarchive=False,
    optimize=1,  # pre-optimised bytecode
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="RapidLabels",
    icon=str(ROOT / "desktop" / "icon.ico"),
    # publisher / product details shown by Windows (written by the GitHub build)
    version=str(ROOT / "desktop" / "build" / "version_info.txt") if (ROOT / "desktop" / "build" / "version_info.txt").exists() else None,
    console=False,
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="RapidLabels", upx=False)
