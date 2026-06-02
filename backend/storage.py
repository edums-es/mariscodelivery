"""Storage: Cloudinary (production) com fallback local."""
import os
import uuid
import logging

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Response

from db import db
from auth import get_current_user

logger = logging.getLogger(__name__)

# ── Cloudinary config ──────────────────────────────────────────────────────
CLOUDINARY_URL = os.environ.get("CLOUDINARY_URL", "")
USE_CLOUDINARY = bool(CLOUDINARY_URL)

if USE_CLOUDINARY:
    cloudinary.config(cloudinary_url=CLOUDINARY_URL)
    logger.info("Storage: Cloudinary ativo")
else:
    logger.warning("Storage: CLOUDINARY_URL não definida — usando armazenamento local (não persistente)")

# ── Local fallback ─────────────────────────────────────────────────────────
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}


def init_storage():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    return UPLOAD_DIR


# ── Upload helpers ─────────────────────────────────────────────────────────

def _upload_cloudinary(data: bytes, ext: str, folder: str) -> str:
    """Envia para Cloudinary e retorna a URL pública segura."""
    result = cloudinary.uploader.upload(
        data,
        folder=folder,
        resource_type="image",
        format=ext,
        overwrite=False,
    )
    return result["secure_url"]


def _upload_local(data: bytes, ext: str, owner: str) -> str:
    """Salva localmente e retorna o path relativo da API."""
    path = f"menudigital/uploads/{owner}/{uuid.uuid4()}.{ext}"
    full_path = os.path.join(UPLOAD_DIR, path.replace("/", os.sep))
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(data)
    return path  # retorna path para montar URL via /api/files/


# ── FastAPI router ─────────────────────────────────────────────────────────
router = APIRouter(prefix="/api", tags=["files"])


@router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Formato não suportado (use jpg, png, gif, webp)")

    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem muito grande (máx 8MB)")

    owner = user.get("restaurant_id") or str(user["_id"])

    try:
        if USE_CLOUDINARY:
            folder = f"menudigital/{owner}"
            public_url = _upload_cloudinary(data, ext, folder)
            await db.files.insert_one({
                "id": str(uuid.uuid4()),
                "storage_type": "cloudinary",
                "url": public_url,
                "original_filename": file.filename,
                "content_type": MIME_TYPES.get(ext, "image/jpeg"),
                "size": len(data),
                "is_deleted": False,
            })
            return {"url": public_url}
        else:
            path = _upload_local(data, ext, owner)
            await db.files.insert_one({
                "id": str(uuid.uuid4()),
                "storage_type": "local",
                "storage_path": path,
                "original_filename": file.filename,
                "content_type": MIME_TYPES.get(ext, "image/jpeg"),
                "size": len(data),
                "is_deleted": False,
            })
            return {"url": f"/api/files/{path}"}

    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no upload: {str(e)}")


@router.get("/files/{path:path}")
async def download(path: str):
    """Serve arquivos do storage local (fallback apenas)."""
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    full_path = os.path.join(UPLOAD_DIR, path.replace("/", os.sep))
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor")
    with open(full_path, "rb") as f:
        data = f.read()
    ext = path.rsplit(".", 1)[-1].lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    return Response(content=data, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400"})
