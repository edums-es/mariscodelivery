"""Public (customer-facing) menu endpoints — no auth required."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from db import db
from whatsapp import send_whatsapp
from routes_ws import broadcast as ws_broadcast
from models import OrderIn, clean, is_restaurant_open, new_id, now_iso

router = APIRouter(prefix="/api/public", tags=["public"])
logger = logging.getLogger(__name__)


@router.get("/platform-config")
async def public_platform_config():
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
        raise HTTPException(status_code=404, detail="Restaurante nao encontrado")
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
        raise HTTPException(status_code=404, detail="Cupom invalido")
    if subtotal < coupon.get("min_order", 0):
        raise HTTPException(
            status_code=400,
            detail=f"Pedido minimo de R$ {coupon['min_order']:.2f} para este cupom",
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


def brl_fmt(value):
    try:
        return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "R$ 0,00"


async def _notify_new_order(restaurant: dict, order: dict, order_in=None, pix_via_openpix: bool = False, order_number: int = None):
    """Envia WhatsApp ao dono quando novo pedido chega (ou e pago via Pix)."""
    try:
        from datetime import timedelta
        owner_phone = restaurant.get("whatsapp") or restaurant.get("phone")
        if not owner_phone:
            return

        br_tz = timezone(timedelta(hours=-3))
        dt_str = datetime.now(br_tz).strftime("%d/%m/%Y %H:%M")
        num = order_number or order.get("order_number", "?")

        if order_in:
            # Chamado diretamente de create_order (Pydantic object disponivel)
            items_lines = []
            for it in order_in.items:
                items_lines.append(f"  {it.quantity}x {it.product_name} - {brl_fmt(it.total_price)}")
                for op in (it.options or []):
                    items_lines.append(f"    + {op.name}")
            items_text = "\n".join(items_lines)
            order_type = order_in.type
            if order_type == "delivery" and order_in.address:
                a = order_in.address
                ln = f"  {a.street}, {a.number}"
                if a.complement: ln += f" ({a.complement})"
                addr_parts = [ln]
                if a.neighborhood: addr_parts.append(f"  {a.neighborhood}")
                address_text = "\n*Endereco:*\n" + "\n".join(addr_parts)
            else:
                address_text = ""
            pm = (order_in.payment_method or "").strip()
            subtotal = order_in.subtotal
            delivery_fee = order_in.delivery_fee
            total = order_in.total
            customer_name = order_in.customer.name
            customer_phone = order_in.customer.phone
        else:
            # Chamado do webhook/check-pix: le do documento MongoDB
            raw_items = order.get("items") or []
            logger.info(f"[notify_order] items={len(raw_items)} subtotal={order.get('subtotal')} total={order.get('total')}")
            items_lines = []
            for it in raw_items:
                qty = it.get("quantity", 1)
                name = it.get("product_name") or it.get("name", "?")
                price = it.get("total_price") or it.get("unit_price", 0)
                items_lines.append(f"  {qty}x {name} - {brl_fmt(price)}")
                for op in (it.get("options") or []):
                    op_name = op.get("name", "") if isinstance(op, dict) else str(op)
                    if op_name: items_lines.append(f"    + {op_name}")
            items_text = "\n".join(items_lines) if items_lines else "(itens nao disponiveis)"
            order_type = order.get("type", "delivery")
            addr = order.get("address") or {}
            if order_type == "delivery" and addr:
                ln = f"  {addr.get('street','')}, {addr.get('number','')}"
                if addr.get("complement"): ln += f" ({addr['complement']})"
                address_text = f"\n*Endereco:*\n{ln}"
                if addr.get("neighborhood"): address_text += f"\n  {addr['neighborhood']}"
            else:
                address_text = ""
            pm = order.get("payment_method", "")
            subtotal = order.get("subtotal") or 0
            delivery_fee = order.get("delivery_fee") or 0
            total = order.get("total") or 0
            cust = order.get("customer") or {}
            customer_name = cust.get("name", "")
            customer_phone = cust.get("phone", "")

        delivery_type = "Entrega" if order_type == "delivery" else "Retirada"
        pm_lower = pm.lower()
        if "pix" in pm_lower:
            payment_label = "Pix pago automatico Openpix" if pix_via_openpix else "Pix aguardando comprovante"
        elif pm_lower == "dinheiro":
            payment_label = "Dinheiro"
        elif "credito" in pm_lower:
            payment_label = "Cartao de credito"
        elif "debito" in pm_lower:
            payment_label = "Cartao de debito"
        elif "vale" in pm_lower:
            payment_label = "Vale refeicao"
        else:
            payment_label = pm if pm else "Nao informado"

        sep = "--------------------"
        entrega_line = f"Entrega: {brl_fmt(delivery_fee)}\n" if order_type == "delivery" else ""
        msg = (
            f"*NOVO PEDIDO #{num}*\n"
            f"Data: {dt_str}\n"
            f"{sep}\n"
            f"*Cliente:* {customer_name}\n"
            f"*Telefone:* {customer_phone}\n"
            f"*Tipo:* {delivery_type}"
            f"{address_text}\n"
            f"{sep}\n"
            f"*Itens:*\n{items_text}\n"
            f"{sep}\n"
            f"Subtotal: {brl_fmt(subtotal)}\n"
            f"{entrega_line}"
            f"*TOTAL: {brl_fmt(total)}*\n"
            f"*Pagamento:* {payment_label}\n"
            f"{sep}"
        )
        await send_whatsapp(restaurant, owner_phone, msg)
    except Exception as exc:
        logger.error(f"_notify_new_order falhou: {exc}", exc_info=True)


async def _push_onesignal(restaurant_id: str, order_number: int, title: str):
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
                    "contents": {"pt": f"Pedido #{order_number} aguardando confirmacao"},
                    "priority": 10,
                },
            )
    except Exception:
        pass


@router.post("/restaurants/{slug}/orders")
async def create_order(slug: str, order: OrderIn):
    r = await _get_restaurant_or_404(slug)
    if not is_restaurant_open(r):
        raise HTTPException(status_code=400, detail="Loja fechada no momento")
    if order.subtotal < (r.get("minimum_order") or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Pedido minimo de R$ {r.get('minimum_order'):.2f}",
        )
    count = await db.orders.count_documents({"restaurant_id": r["id"]})
    order_number = count + 1
    doc = order.model_dump()
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

    import asyncio

    if order.coupon_code:
        await db.coupons.update_one(
            {"restaurant_id": r["id"], "code": order.coupon_code.upper()},
            {"$inc": {"used_count": 1}},
        )

    for item in order.items:
        prod = await db.products.find_one({"id": item.product_id, "restaurant_id": r["id"]})
        if prod and prod.get("track_stock"):
            new_qty = max(0, (prod.get("stock_quantity") or 0) - item.quantity)
            await db.products.update_one({"id": item.product_id}, {"$set": {"stock_quantity": new_qty}})

    loyalty_cfg = r.get("loyalty", {})
    if loyalty_cfg.get("enabled") and order.customer.phone:
        ppr = loyalty_cfg.get("points_per_real", 1.0)
        pts = int(order.total * ppr)
        if pts > 0:
            acc = await db.loyalty_accounts.find_one({"restaurant_id": r["id"], "phone": order.customer.phone})
            if acc:
                await db.loyalty_accounts.update_one(
                    {"restaurant_id": r["id"], "phone": order.customer.phone},
                    {"$inc": {"points": pts, "total_earned": pts}, "$set": {"name": order.customer.name}},
                )
            else:
                await db.loyalty_accounts.insert_one({
                    "id": new_id(), "restaurant_id": r["id"],
                    "phone": order.customer.phone, "name": order.customer.name,
                    "points": pts, "total_earned": pts, "total_redeemed": 0,
                    "created_at": now_iso(),
                })

    # ── Tenta gerar cobrança OpenPix ─────────────────────────────────────────
    pix_charge = None
    openpix_app_id = (r.get("openpix_app_id") or "").strip()
    is_pix_auto = openpix_app_id and "pix" in order.payment_method.lower()

    if is_pix_auto:
        try:
            import httpx as _httpx
            async with _httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.openpix.com.br/api/v1/charge",
                    headers={"Authorization": openpix_app_id, "Content-Type": "application/json"},
                    json={
                        "correlationID": doc["id"],
                        "value": int(round(order.total * 100)),
                        "comment": f"Pedido #{order_number} - {r.get('name', '')}",
                        "customer": {
                            "name": order.customer.name,
                            "phone": order.customer.phone or "",
                        },
                    },
                )
            logger.info(f"[OpenPix] status={resp.status_code} body={resp.text[:300]}")
            if resp.status_code in (200, 201):
                body = resp.json()
                charge = body.get("charge") or body
                qr_img = charge.get("qrCodeImage") or ""
                if qr_img.startswith("data:"):
                    qr_img = qr_img.split(",", 1)[-1]
                br_code = charge.get("brCode") or charge.get("brcode") or ""
                if br_code:
                    pix_charge = {
                        "qr_code_image": qr_img,
                        "br_code": br_code,
                        "correlation_id": charge.get("correlationID") or doc["id"],
                        "status": charge.get("status", "ACTIVE"),
                    }
                    await db.orders.update_one(
                        {"id": doc["id"]},
                        {"$set": {"pix_charge": pix_charge, "payment_status": "awaiting"}},
                    )
            else:
                logger.error(f"[OpenPix] erro {resp.status_code}: {resp.text[:300]}")
        except Exception as _e:
            logger.error(f"[OpenPix] excecao: {_e}", exc_info=True)

    if is_pix_auto and pix_charge:
        # Pix automático: aguarda confirmação do webhook para notificar restaurante
        # Apenas sinaliza que o pedido existe (sem notificar ainda)
        logger.info(f"[OpenPix] Pedido {doc['id']} aguardando pagamento — restaurante sera notificado apos confirmacao")
    else:
        # Pagamento manual (dinheiro, cartao, pix manual): notifica imediatamente
        asyncio.create_task(ws_broadcast(r["id"], "new_order", {"order_number": order_number, "id": doc["id"]}))
        asyncio.create_task(_push_onesignal(r["id"], order_number, f"Novo pedido #{order_number}!"))
        asyncio.create_task(_notify_new_order(r, clean(doc), order, pix_via_openpix=False))

    result = clean(doc)
    if pix_charge:
        result["pix_charge"] = pix_charge
    return result


@router.post("/openpix/webhook")
async def openpix_webhook(request: Request):
    """Webhook da OpenPix/Woovi — chamado quando Pix e pago."""
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse({"ok": False}, status_code=400)

    event = payload.get("event", "")
    logger.info(f"[OpenPix Webhook] event={event} payload_keys={list(payload.keys())}")

    if event not in ("OPENPIX:CHARGE_COMPLETED", "OPENPIX:TRANSACTION_CONFIRMED", "charge:completed"):
        return JSONResponse({"ok": True})

    charge = payload.get("charge") or payload.get("transaction") or {}
    correlation_id = charge.get("correlationID") or charge.get("correlationId") or ""

    if not correlation_id:
        logger.warning(f"[OpenPix Webhook] sem correlationID no payload: {payload}")
        return JSONResponse({"ok": True})

    order = await db.orders.find_one({"id": correlation_id}, {"_id": 0})
    if not order:
        logger.warning(f"[OpenPix Webhook] pedido nao encontrado: {correlation_id}")
        return JSONResponse({"ok": True})

    if order.get("payment_status") == "paid":
        return JSONResponse({"ok": True})  # Idempotente

    # Marca como pago e aceito
    await db.orders.update_one(
        {"id": correlation_id},
        {"$set": {"payment_status": "paid", "status": "accepted", "updated_at": now_iso()}},
    )
    logger.info(f"[OpenPix Webhook] pedido {correlation_id} PAGO — notificando restaurante")

    restaurant = await db.restaurants.find_one({"id": order["restaurant_id"]}, {"_id": 0})
    order_number = order.get("order_number", "?")

    # Agora sim notifica o restaurante (pedido confirmado e pago)
    import asyncio
    asyncio.create_task(ws_broadcast(
        order["restaurant_id"], "new_order",
        {"order_number": order_number, "id": order["id"], "payment_status": "paid"},
    ))
    asyncio.create_task(_push_onesignal(order["restaurant_id"], order_number, f"Pix confirmado! Pedido #{order_number}"))

    if restaurant:
        updated_order = await db.orders.find_one({"id": correlation_id}, {"_id": 0})
        asyncio.create_task(_notify_new_order(restaurant, updated_order, pix_via_openpix=True, order_number=order_number))
        # Notifica cliente via WhatsApp que pedido foi aceito
        from whatsapp import notify_order_status
        asyncio.create_task(notify_order_status(updated_order, "accepted"))

    return JSONResponse({"ok": True})


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
        "payment_status": o.get("payment_status", "pending"),
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



@router.get("/orders/{order_id}/check-pix")
async def check_pix_payment(order_id: str):
    """Verifica ativamente na OpenPix se o pagamento foi feito (fallback sem webhook)."""
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")

    payment_status = o.get("payment_status", "pending")
    if payment_status == "paid":
        return {"payment_status": "paid", "order_status": o.get("status")}

    pix_charge = o.get("pix_charge")
    if not pix_charge:
        return {"payment_status": payment_status, "order_status": o.get("status")}

    restaurant = await db.restaurants.find_one({"id": o["restaurant_id"]}, {"_id": 0})
    openpix_app_id = (restaurant.get("openpix_app_id") or "").strip() if restaurant else ""
    if not openpix_app_id:
        return {"payment_status": payment_status, "order_status": o.get("status")}

    correlation_id = pix_charge.get("correlation_id") or order_id
    try:
        import httpx as _httpx
        async with _httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.openpix.com.br/api/v1/charge/{correlation_id}",
                headers={"Authorization": openpix_app_id},
            )
        logger.info(f"[check-pix] order={order_id} status={resp.status_code}")
        if resp.status_code == 200:
            body = resp.json()
            charge = body.get("charge") or body
            charge_status = charge.get("status", "")
            paid_statuses = ["COMPLETED", "ACTIVE_PAID", "PAID"]
            if charge_status in paid_statuses:
                import asyncio
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"payment_status": "paid", "status": "accepted", "updated_at": now_iso()}},
                )
                order_number = o.get("order_number", "?")
                asyncio.create_task(ws_broadcast(
                    o["restaurant_id"], "new_order",
                    {"order_number": order_number, "id": order_id, "payment_status": "paid"},
                ))
                asyncio.create_task(_push_onesignal(
                    o["restaurant_id"], order_number, f"Pix confirmado! Pedido #{order_number}"
                ))
                if restaurant:
                    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
                    asyncio.create_task(_notify_new_order(
                        restaurant, updated, pix_via_openpix=True, order_number=order_number
                    ))
                    from whatsapp import notify_order_status
                    asyncio.create_task(notify_order_status(updated, "accepted"))
                return {"payment_status": "paid", "order_status": "accepted"}
    except Exception as e:
        logger.error(f"[check-pix] erro: {e}")

    return {"payment_status": payment_status, "order_status": o.get("status")}


@router.get("/track")
async def track_by_phone(phone: str, slug: str = None):
    import re as _re
    raw = _re.sub(r"\D", "", phone)
    if not raw:
        raise HTTPException(400, "Telefone invalido")
    # Usa os ultimos 8 digitos mas com regex que tolera formatacao
    # Ex: busca "96717081" mas o banco tem "(27) 99671-7081" com traço e espacos
    suffix = raw[-8:]
    digit_pattern = "[^0-9]*".join(list(suffix))
    query = {"customer.phone": {"$regex": digit_pattern}}
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
