"""Public (customer-facing) menu endpoints — no auth required."""
import random
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from db import db
from whatsapp import send_whatsapp
from routes_ws import broadcast as ws_broadcast
from models import OrderIn, clean, is_restaurant_open, new_id, now_iso

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/platform-config")
async def public_platform_config():
    """Retorna configurações públicas da plataforma (sem segredos).
    Usado pelo frontend para inicializar OneSignal sem hardcode de env."""
    from routes_superadmin import get_platform_setting
    app_id = await get_platform_setting("onesignal_app_id", "")
    push_enabled = await get_platform_setting("push_notifications_enabled", "true")
    return {
        "onesignal_app_id": app_id,
        "push_enabled": str(push_enabled).lower() not in ("false", "0", ""),
    }


async def _get_restaurant_or_404(slug: str):
    r = await db.restaurants.find_one({"slug": slug})
    if not r or r.get("status") == "suspended":
        raise HTTPException(status_code=404, detail="Restaurante não encontrado")
    return r


@router.get("/restaurants/{slug}")
async def get_menu(slug: str):
    r = await _get_restaurant_or_404(slug)
    categories = await db.categories.find(
        {"restaurant_id": r["id"], "is_active": True}, {"_id": 0}
    ).sort("sort_order", 1).to_list(200)
    products = await db.products.find(
        {"restaurant_id": r["id"]}, {"_id": 0}
    ).sort("sort_order", 1).to_list(1000)
    banners = await db.banners.find(
        {"restaurant_id": r["id"], "is_active": True}, {"_id": 0}
    ).sort("sort_order", 1).to_list(50)
    combos = await db.combos.find(
        {"restaurant_id": r["id"], "is_active": True}, {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    reviews = await db.reviews.find(
        {"restaurant_id": r["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    avg = round(sum(rv["rating"] for rv in reviews) / len(reviews), 1) if reviews else 0
    restaurant = clean(r)
    restaurant["is_open"] = is_restaurant_open(r)
    return {
        "restaurant": restaurant,
        "categories": categories,
        "products": products,
        "banners": banners,
        "combos": combos,
        "reviews": reviews[:20],
        "reviews_summary": {"average": avg, "count": len(reviews)},
    }


@router.post("/restaurants/{slug}/validate-coupon")
async def validate_coupon(slug: str, payload: dict):
    r = await _get_restaurant_or_404(slug)
    code = (payload.get("code") or "").strip().upper()
    subtotal = float(payload.get("subtotal") or 0)
    coupon = await db.coupons.find_one(
        {"restaurant_id": r["id"], "code": code, "is_active": True}
    )
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupom inválido")
    if subtotal < coupon.get("min_order", 0):
        raise HTTPException(
            status_code=400,
            detail=f"Pedido mínimo de R$ {coupon['min_order']:.2f} para este cupom",
        )
    if coupon.get("usage_limit") and coupon.get("used_count", 0) >= coupon["usage_limit"]:
        raise HTTPException(status_code=400, detail="Cupom esgotado")
    discount = 0.0
    if coupon["discount_type"] == "percent":
        discount = round(subtotal * coupon["discount_value"] / 100, 2)
    else:
        discount = coupon["discount_value"]
    return {
        "code": coupon["code"],
        "discount_type": coupon["discount_type"],
        "discount_value": coupon["discount_value"],
        "discount": discount,
        "free_delivery": coupon.get("free_delivery", False),
    }



async def _notify_new_order(restaurant: dict, order: dict, order_in, pix_via_openpix: bool = False):
    """Send WhatsApp to restaurant owner when new order arrives."""
    import logging as _log
    _logger = _log.getLogger(__name__)
    try:
        from datetime import datetime, timezone, timedelta
        owner_phone = restaurant.get("whatsapp") or restaurant.get("phone")
        if not owner_phone:
            _logger.warning("_notify_new_order: sem telefone no restaurante")
            return

        br_tz = timezone(timedelta(hours=-3))
        dt_str = datetime.now(br_tz).strftime("%d/%m/%Y %H:%M")

        items_lines = []
        for it in order_in.items:
            items_lines.append(f"  {it.quantity}x {it.product_name} — {brl_fmt(it.total_price)}")
            for op in (it.options or []):
                items_lines.append(f"    + {op.name}")
        items_text = "\n".join(items_lines)

        delivery_type = "Entrega" if order_in.type == "delivery" else "Retirada"
        address_lines = []
        if order_in.address and order_in.type == "delivery":
            a = order_in.address
            line = f"  {a.street}, {a.number}"
            if a.complement:
                line += f" ({a.complement})"
            address_lines.append(line)
            if a.neighborhood:
                address_lines.append(f"  {a.neighborhood} — {getattr(a, 'city', '')} {getattr(a, 'state', '')}")
        address_text = ("\n*Endereco:*\n" + "\n".join(address_lines)) if address_lines else ""

        pm = (order_in.payment_method or "").strip()
        pm_lower = pm.lower()
        if pm_lower in ("pix", "pix automatico", "pix automático"):
            payment_label = "Pix (pago via OpenPix)" if pix_via_openpix else "Pix (aguardando comprovante)"
        elif pm_lower == "dinheiro":
            payment_label = "Dinheiro"
        elif "credito" in pm_lower or "crédito" in pm_lower:
            payment_label = "Cartao de credito"
        elif "debito" in pm_lower or "débito" in pm_lower:
            payment_label = "Cartao de debito"
        elif "vale" in pm_lower:
            payment_label = "Vale refeicao"
        else:
            payment_label = pm

        sep = "--------------------"
        msg = (
            f"*NOVO PEDIDO #{order['order_number']}*\n"
            f"Data: {dt_str}\n"
            f"{sep}\n"
            f"*Cliente:* {order_in.customer.name}\n"
            f"*Telefone:* {order_in.customer.phone}\n"
            f"*Tipo:* {delivery_type}"
            f"{address_text}\n"
            f"{sep}\n"
            f"*Itens:*\n{items_text}\n"
            f"{sep}\n"
            f"Subtotal: {brl_fmt(order_in.subtotal)}\n"
            f"Entrega: {brl_fmt(order_in.delivery_fee)}\n"
            f"*TOTAL: {brl_fmt(order_in.total)}*\n"
            f"*Pagamento:* {payment_label}\n"
            f"{sep}"
        )
        result = await send_whatsapp(restaurant, owner_phone, msg)
        _logger.info(f"_notify_new_order: enviado={result} para {owner_phone}")
    except Exception as exc:
        _logger.error(f"_notify_new_order falhou: {exc}", exc_info=True)


async def _push_onesignal(restaurant_id: str, order_number: int, title: str):
    """Envia push via OneSignal — credenciais lidas do banco (Super Admin config)."""
    import httpx as _httpx
    from routes_superadmin import get_platform_setting
    app_id = await get_platform_setting("onesignal_app_id")
    api_key = await get_platform_setting("onesignal_api_key")
    if not app_id or not api_key:
        return
    try:
        async with _httpx.AsyncClient(timeout=5) as client:
            await client.post(
                "https://onesignal.com/api/v1/notifications",
                headers={"Authorization": f"Basic {api_key}", "Content-Type": "application/json"},
                json={
                    "app_id": app_id,
                    "filters": [{"field": "tag", "key": "restaurant_id", "relation": "=", "value": restaurant_id}],
                    "headings": {"pt": title},
                    "contents": {"pt": f"Pedido #{order_number} aguardando confirmação"},
                    "priority": 10,
                },
            )
    except Exception as e:
        pass  # Push failure never blocks order


def brl_fmt(value):
    try:
        return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return "R$ 0,00"

@router.post("/restaurants/{slug}/orders")
async def create_order(slug: str, order: OrderIn):
    r = await _get_restaurant_or_404(slug)
    if not is_restaurant_open(r):
        raise HTTPException(status_code=400, detail="Loja fechada no momento")
    if order.subtotal < (r.get("minimum_order") or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Pedido mínimo de R$ {r.get('minimum_order'):.2f}",
        )
    count = await db.orders.count_documents({"restaurant_id": r["id"]})
    order_number = count + 1
    doc = order.model_dump()
    # scheduled_for and table_number come from OrderIn fields (already in model_dump)
    doc.update({
        "id": new_id(),
        "restaurant_id": r["id"],
        "order_number": order_number,
        "status": "pending",
        "payment_status": "pending",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.orders.insert_one(doc)

    # Notify restaurant owner about new order
    import asyncio
    # Notifica via WebSocket (tempo real)
    asyncio.create_task(ws_broadcast(r['id'], 'new_order', {'order_number': order_number, 'id': doc['id']}))
    asyncio.create_task(_push_onesignal(r['id'], order_number, f"🔔 Novo pedido #{order_number}!"))
    # Notify after OpenPix check so we know if pix was automatic

    if order.coupon_code:
        await db.coupons.update_one(
            {"restaurant_id": r["id"], "code": order.coupon_code.upper()},
            {"$inc": {"used_count": 1}},
        )
    # Decrement stock for tracked products
    for item in order.items:
        prod = await db.products.find_one({"id": item.product_id, "restaurant_id": r["id"]})
        if prod and prod.get("track_stock"):
            new_qty = max(0, (prod.get("stock_quantity") or 0) - item.quantity)
            await db.products.update_one({"id": item.product_id}, {"$set": {"stock_quantity": new_qty}})
    # Loyalty: earn points automatically
    loyalty_cfg = r.get("loyalty", {})
    if loyalty_cfg.get("enabled") and order.customer.phone:
        ppr = loyalty_cfg.get("points_per_real", 1.0)
        pts = int(order.total * ppr)
        if pts > 0:
            acc = await db.loyalty_accounts.find_one({"restaurant_id": r["id"], "phone": order.customer.phone})
            if acc:
                await db.loyalty_accounts.update_one(
                    {"restaurant_id": r["id"], "phone": order.customer.phone},
                    {"$inc": {"points": pts, "total_earned": pts}, "$set": {"name": order.customer.name}}
                )
            else:
                await db.loyalty_accounts.insert_one({
                    "id": new_id(), "restaurant_id": r["id"],
                    "phone": order.customer.phone, "name": order.customer.name,
                    "points": pts, "total_earned": pts, "total_redeemed": 0,
                    "created_at": now_iso(),
                })
    # ── OpenPix / Woovi automatic PIX charge ──────────────────────────
    pix_charge = None
    openpix_app_id = r.get("openpix_app_id", "")
    if openpix_app_id and order.payment_method.lower() in ("pix", "pix automático"):
        try:
            import httpx as _httpx
            async with _httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.openpix.com.br/api/v1/charge",
                    headers={"Authorization": f"App {openpix_app_id}"},
                    json={
                        "correlationID": doc["id"],
                        "value": int(round(order.total * 100)),
                        "comment": f"Pedido #{order_number} — {r.get('name', '')}",
                        "customer": {
                            "name": order.customer.name,
                            "phone": order.customer.phone or "",
                        },
                    },
                )
            if resp.status_code in (200, 201):
                charge = resp.json().get("charge", {})
                pix_charge = {
                    "qr_code_image": charge.get("qrCodeImage"),
                    "br_code": charge.get("brCode"),
                    "correlation_id": charge.get("correlationID"),
                    "status": charge.get("status"),
                }
                await db.orders.update_one(
                    {"id": doc["id"]},
                    {"$set": {"pix_charge": pix_charge, "payment_status": "awaiting"}},
                )
        except Exception:
            pass  # OpenPix failure must never block order creation

    # Notify owner — pass pix_via_openpix flag
    asyncio.create_task(_notify_new_order(r, clean(doc), order, pix_via_openpix=bool(pix_charge)))

    result = clean(doc)
    if pix_charge:
        result["pix_charge"] = pix_charge
    return result


@router.get("/orders/{order_id}")
async def track_order(order_id: str):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    r = await db.restaurants.find_one(
        {"id": o["restaurant_id"]},
        {"name": 1, "slug": 1, "logo_url": 1, "primary_color": 1, "phone": 1, "whatsapp": 1, "_id": 0},
    )
    customer = o.get("customer") or {}
    return {
        "id": o["id"],
        "order_number": o["order_number"],
        "status": o["status"],
        "created_at": o.get("created_at"),
        "updated_at": o.get("updated_at"),
        "customer": customer,
        "customer_name": customer.get("name", ""),
        "items": o.get("items", []),
        "subtotal": o.get("subtotal", 0),
        "delivery_fee": o.get("delivery_fee", 0),
        "discount": o.get("discount", 0),
        "total": o.get("total", 0),
        "type": o.get("type", "delivery"),
        "address": o.get("address"),
        "payment_method": o.get("payment_method"),
        "customer_notes": o.get("customer_notes"),
        "restaurant": {
            "name": r.get("name", "") if r else "",
            "slug": r.get("slug", "") if r else "",
            "logo_url": r.get("logo_url") if r else None,
            "primary_color": r.get("primary_color", "#EF4444") if r else "#EF4444",
            "phone": r.get("phone") if r else None,
            "whatsapp": r.get("whatsapp") if r else None,
        },
    }


@router.get("/track")
async def track_by_phone(phone: str, slug: str = None):
    """Retorna pedidos recentes de um cliente pelo telefone."""
    import re as _re
    raw = _re.sub(r"\D", "", phone)
    if not raw:
        raise HTTPException(400, "Telefone invalido")
    # Busca pelos ultimos 8 digitos (sem DDD pais)
    suffix = raw[-8:]

    query = {"customer.phone": {"$regex": suffix}}
    if slug:
        r = await db.restaurants.find_one({"slug": slug}, {"id": 1, "_id": 0})
        if r:
            query["restaurant_id"] = r["id"]

    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(20)

    result = []
    for o in orders:
        r = await db.restaurants.find_one({"id": o["restaurant_id"]}, {"name": 1, "slug": 1, "_id": 0})
        result.append({
            "id": o["id"],
            "order_number": o["order_number"],
            "status": o["status"],
            "created_at": o.get("created_at"),
            "total": o.get("total", 0),
            "type": o.get("type", "delivery"),
            "items": o.get("items", []),
            "restaurant_name": r["name"] if r else "",
            "restaurant_slug": r["slug"] if r else "",
            "payment_method": o.get("payment_method", ""),
        })
    return result


@router.post("/restaurants/{slug}/reviews")
async def submit_review(slug: str, payload: dict):
    r = await _get_restaurant_or_404(slug)
    rating = int(payload.get("rating", 5))
    comment = (payload.get("comment") or "").strip()
    customer_name = (payload.get("customer_name") or "Cliente").strip()
    if not 1 <= rating <= 5:
        raise HTTPException(400, "Rating deve ser entre 1 e 5")
    doc = {
        "id": new_id(),
        "restaurant_id": r["id"],
        "rating": rating,
        "comment": comment,
        "customer_name": customer_name,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(doc)
    return clean(doc)
