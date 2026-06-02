"""Local file storage utilities + upload/serve routes."""
import os
import uuid
import logging
import shutil

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Response
from fastapi.staticfiles import StaticFiles

from db import db
from auth import get_current_user

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def init_storage():
    """No-op: local storage needs no initialization."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    return UPLOAD_DIR

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}


def put_object(path: str, data: bytes, content_type: str) -> dict:
    full_path = os.path.join(UPLOAD_DIR, path.replace("/", os.sep))
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(data)
    return {"path": path, "size": len(data)}


def get_object(path: str):
    full_path = os.path.join(UPLOAD_DIR, path.replace("/", os.sep))
    if not os.path.exists(full_path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(full_path, "rb") as f:
        data = f.read()
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else "bin"
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    return data, content_type


router = APIRouter(prefix="/api", tags=["files"])


@router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    owner = user.get("restaurant_id") or str(user["_id"])
    path = f"menudigital/uploads/{owner}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem muito grande (máx 8MB)")
    result = put_object(path, data, content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
    })
    return {"url": f"/api/files/{result['path']}", "path": result["path"]}


@router.get("/files/{path:path}")
async def download(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    try:
        data, content_type = get_object(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor")
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Cache-Control": "public, max-age=86400"},
    )
