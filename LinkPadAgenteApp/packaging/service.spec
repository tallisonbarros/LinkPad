# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['../src/linkpad_agent/service_main.py'],
    pathex=['../src'],
    binaries=[],
    datas=[],
    hiddenimports=['win32timezone', 'uvicorn.logging', 'uvicorn.loops.auto', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan.on'],
    hookspath=[],
    runtime_hooks=[],
    excludes=['PySide6'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='LinkPadAgentService',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=True, name='LinkPadAgentService')
