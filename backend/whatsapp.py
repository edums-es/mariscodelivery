"""Twilio WhatsApp integration — notifications + keyword chatbot."""
import os
import logging
import unicodedata
import re
from typing import Optional

from fastapi import APIRouter, Request, Form, HTTPException
from fastapi.responses import PlainTextResponse
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from db import db
from models import now_iso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client(restaurant: dict) -> Optional[Client]:
    sid = restaurant.get("twilio_account_sid") or os.environ.get("TWILIO_ACCOUNT_SID")
    token = restaurant.get("twilio_auth_token") or os.environ.get("TWILIO_AUTH_TOKEN")
    if not sid or not token:
        return None
    return Client(sid, token)


def _from_number(restaurant: dict) -> str:
    return restaurant.get("twilio_whatsapp_number") or os.environ.get("TWILIO_WHATSAPP_NUMBER", "")


def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFD", text.lower())
    return re.sub(r"[^\w\s]", "", "".join(c for c in nfkd if not unicodedata.combining(c)))


def _brl(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ---------------------------------------------------------------------------
# Send helpers
# ---------------------------------------------------------------------------

async def send_whatsapp(restaurant: dict, to_phone: str, message: str) -> bool:
    """Send a WhatsApp message to a customer. Returns True on success."""
    client = _get_client(restaurant)
    from_num = _from_number(restaurant)
    if not client or not from_num:
        logger.warning("Twilio not configured — skipping WhatsApp send")
        return False

    raw = re.sub(r"\D", "", to_phone)
    if not raw.startswith("55"):
        raw = "55" + raw
    to_wa = f"whatsapp:+{raw}"
    from_wa = from_num if from_num.startswith("whatsapp:") else f"whatsapp:{from_num}"

    try:
        client.messages.create(body=message, from_=from_wa, to=to_wa)
        logger.info(f"WhatsApp sent to {to_wa}")
        return True
    except TwilioRestException as e:
        logger.error(f"Twilio error: {e}")
        return False


# ---------------------------------------------------------------------------
# Order status notification messages
# ---------------------------------------------------------------------------

STATUS_MESSAGES = {
    "accepted": (
        "✅ *Pedido #{number} confirmado!*\n\n"
        "Olá, {name}! Seu pedido foi aceito e já está sendo preparado com muito carinho. 🍽️\n\n"
        "Acompanhe seu pedido em tempo real:\n"
        "{tracking_url}\n\n"
        "Assim que ficar pronto avisamos aqui!"
    ),
    "preparing": (
        "👨‍🍳 *Pedido #{number} em preparo!*\n\n"
        "Olá, {name}! Nossa equipe já está preparando seu pedido. Aguarde um pouquinho! 🔥"
    ),
    "ready": (
        "🎉 *Pedido #{number} pronto!*\n\n"
        "Olá, {name}! Seu pedido está pronto e logo chegará até você! 🛵"
    ),
    "out_for_delivery": (
        "🛵 *Pedido #{number} saiu para entrega!*\n\n"
        "Olá, {name}! Seu pedido está a caminho. Prepare-se para receber! 📦"
    ),
    "completed": (
        "⭐ *Pedido #{number} entregue!*\n\n"
        "Olá, {name}! Esperamos que tenha gostado. Sua avaliação é muito importante para nós!\n\n"
        "Obrigado por pedir no *{restaurant}*! 💚"
    ),
    "cancelled": (
        "❌ *Pedido #{number} cancelado.*\n\n"
        "Olá, {name}. Infelizmente seu pedido foi cancelado. "
        "Entre em contato conosco para mais informações. Pedimos desculpas pelo transtorno!"
    ),
}


async def notify_order_status(order: dict, new_status: str):
    """Called whenever an order status changes. Sends WhatsApp if customer has phone."""
    if new_status not in STATUS_MESSAGES:
        return
    customer_phone = (order.get("customer") or {}).get("phone", "")
    if not customer_phone:
        return

    restaurant = await db.restaurants.find_one({"id": order["restaurant_id"]}, {"_id": 0})
    if not restaurant:
        return

    # Only notify if WhatsApp is configured
    client = _get_client(restaurant)
    if not client:
        return

    public_url = os.environ.get("PUBLIC_URL", "http://localhost:3000")
    tracking_url = f"{public_url}/pedido/{order.get('id', '')}"
    msg = STATUS_MESSAGES[new_status].format(
        number=order.get("order_number", ""),
        name=(order.get("customer") or {}).get("name", "cliente"),
        restaurant=restaurant.get("name", ""),
        tracking_url=tracking_url,
    )
    await send_whatsapp(restaurant, customer_phone, msg)


# ---------------------------------------------------------------------------
# Keyword chatbot
# ---------------------------------------------------------------------------

def _build_response(text: str, restaurant: dict) -> str:
    q = _normalize(text)

    # Saudações
    if re.search(r"\b(oi|ola|bom dia|boa tarde|boa noite|ola|hello|salve|ei)\b", q):
        return (
            f"Olá! 👋 Bem-vindo ao *{restaurant.get('name', '')}*!\n\n"
            "Como posso te ajudar?\n\n"
            "📍 *endereco* — nosso endereço\n"
            "🕐 *horario* — horários de funcionamento\n"
            "🛵 *entrega* — taxa e tempo de entrega\n"
            "💳 *pagamento* — formas aceitas\n"
            "🛒 *cardapio* — ver nosso cardápio\n"
            "📞 *contato* — falar com atendente"
        )

    # Localização / endereço
    if re.search(r"\b(enderec|localizac|onde|fica|local|bairro|rua|avenida|av|cep|cidade)\b", q):
        parts = [
            restaurant.get("address"),
            restaurant.get("neighborhood"),
            restaurant.get("city"),
            restaurant.get("state"),
        ]
        parts = [p for p in parts if p]
        if parts:
            return f"📍 *Endereço:*\n{', '.join(parts)}"
        return "Endereço ainda não cadastrado. Ligue para confirmar!"

    # Horários
    if re.search(r"\b(horario|hora|abre|fecha|funciona|funcionamento|atende|expediente|hoje)\b", q):
        hours = restaurant.get("opening_hours") or {}
        day_map = {"mon": "Segunda", "tue": "Terça", "wed": "Quarta",
                   "thu": "Quinta", "fri": "Sexta", "sat": "Sábado", "sun": "Domingo"}
        lines = []
        for k, label in day_map.items():
            h = hours.get(k, {})
            if h.get("open"):
                lines.append(f"  {label}: {h.get('start', '')}–{h.get('end', '')}")
        if lines:
            return "🕐 *Horários de funcionamento:*\n" + "\n".join(lines)
        return "Horários ainda não cadastrados. Entre em contato para confirmar!"

    # Status aberto agora
    if re.search(r"\b(aberto|abriu|aberta|funcionando|agora|aberto agora)\b", q):
        is_open = restaurant.get("is_open", False)
        if is_open:
            return "✅ Sim! Estamos *abertos* agora. Faça seu pedido pelo link do cardápio! 🍽️"
        return "❌ No momento estamos *fechados*. Veja nossos horários respondendo *horario*."

    # Entrega / frete / delivery
    if re.search(r"\b(entrega|delivery|frete|taxa|entreg|motoboy|tempo)\b", q):
        parts = []
        fee = restaurant.get("flat_delivery_fee")
        if fee is not None:
            parts.append(f"Taxa de entrega: {'grátis! 🎉' if fee == 0 else _brl(fee)}")
        eta = restaurant.get("average_delivery_time")
        if eta:
            parts.append(f"Tempo estimado: {eta}")
        if parts:
            return "🛵 *Informações de entrega:*\n" + "\n".join(f"  • {p}" for p in parts)
        return "Entre em contato para saber sobre nossa taxa de entrega!"

    # Pedido mínimo
    if re.search(r"\b(minimo|pedido minimo|valor minimo)\b", q):
        min_order = restaurant.get("minimum_order")
        if min_order:
            return f"🛒 Pedido mínimo: *{_brl(min_order)}*"
        return "Não temos valor mínimo de pedido! 🎉"

    # Pagamento
    if re.search(r"\b(pagamento|pagar|pix|cartao|dinheiro|credito|debito|forma|aceita)\b", q):
        methods = restaurant.get("payment_methods") or []
        pix_key = restaurant.get("pix_key")
        text_out = "💳 *Formas de pagamento:*\n"
        if methods:
            text_out += "\n".join(f"  • {m}" for m in methods)
        else:
            text_out += "  • Pix, Cartão de crédito/débito, Dinheiro"
        if pix_key:
            text_out += f"\n\n🔑 *Chave Pix:* `{pix_key}`"
        return text_out

    # Cardápio
    if re.search(r"\b(cardapio|menu|produto|prato|item|lanche|comida|bebida|preco|valor)\b", q):
        slug = restaurant.get("slug", "")
        backend_url = os.environ.get("PUBLIC_URL", "http://localhost:3000")
        link = f"{backend_url}/loja/{slug}" if slug else "nosso cardápio online"
        return f"🍽️ *Nosso cardápio:*\n{link}\n\nAcesse e faça seu pedido!"

    # Contato / atendente
    if re.search(r"\b(contato|atendente|falar|humano|pessoa|ajuda|suporte|numero|telefone)\b", q):
        phone = restaurant.get("phone") or restaurant.get("whatsapp")
        if phone:
            return f"📞 *Fale com a gente:*\n{phone}\n\nOu responda aqui mesmo!"
        return "Entre em contato pelo nosso número principal ou visite nossa loja!"

    # Obrigado
    if re.search(r"\b(obrigad|valeu|brigad|agradec|thanks)\b", q):
        return f"😊 Por nada! Fico feliz em ajudar. Bom apetite! 🍽️"

    # Fallback
    return (
        f"Não entendi muito bem, mas estou aqui para ajudar! 😊\n\n"
        "Tente perguntar sobre:\n"
        "📍 *endereco* · 🕐 *horario* · 🛵 *entrega*\n"
        "💳 *pagamento* · 🛒 *cardapio* · 📞 *contato*"
    )


# ---------------------------------------------------------------------------
# Webhook — Twilio sends incoming WhatsApp messages here
# ---------------------------------------------------------------------------

@router.post("/webhook/{restaurant_id}", response_class=PlainTextResponse)
async def whatsapp_webhook(
    restaurant_id: str,
    request: Request,
    Body: str = Form(default=""),
    From: str = Form(default=""),
):
    """
    Twilio webhook URL: POST /api/whatsapp/webhook/{restaurant_id}
    Configure this in Twilio Console > Messaging > WhatsApp Sandbox Settings.
    """
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    incoming = Body.strip()
    sender = From  # e.g. "whatsapp:+5511999999999"

    # Log incoming
    logger.info(f"[WA] From={sender} | msg={incoming!r}")

    # Store message log (optional, for analytics)
    await db.whatsapp_logs.insert_one({
        "restaurant_id": restaurant_id,
        "direction": "in",
        "from": sender,
        "body": incoming,
        "created_at": now_iso(),
    })

    response_text = _build_response(incoming, restaurant)

    # Reply using Twilio TwiML (Twilio reads this XML response)
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{response_text}</Message>
</Response>"""
    return PlainTextResponse(content=twiml, media_type="application/xml")
