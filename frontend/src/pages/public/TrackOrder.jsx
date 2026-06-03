import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/lib/api";
import { brl } from "@/lib/format";
import {
  Clock, CheckCircle2, ChefHat, Package, Bike, Star,
  Loader2, Store, MapPin, Phone, MessageCircle, XCircle,
} from "lucide-react";

const STEPS = [
  { status: "pending",          label: "Pedido recebido",     icon: Clock,        desc: "Aguardando confirmação do restaurante" },
  { status: "accepted",         label: "Pedido aceito",        icon: CheckCircle2, desc: "O restaurante confirmou seu pedido" },
  { status: "preparing",        label: "Em preparo",           icon: ChefHat,      desc: "Sua comida está sendo preparada" },
  { status: "ready",            label: "Pronto",               icon: Package,      desc: "Seu pedido está pronto" },
  { status: "out_for_delivery", label: "Saiu para entrega",    icon: Bike,         desc: "Seu pedido está a caminho" },
  { status: "completed",        label: "Entregue",             icon: Star,         desc: "Bom apetite! 😋" },
];

const STATUS_ORDER = STEPS.map((s) => s.status);

function stepIndex(status) {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? 0 : i;
}

export default function TrackOrder() {
  const { order_id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/public/orders/${order_id}`);
      setOrder(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [order_id]);

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen grid place-items-center bg-gray-50 px-6 text-center">
      <div>
        <XCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="font-display font-bold text-lg text-gray-700">Pedido não encontrado</p>
        <p className="text-sm text-gray-400 mt-1">Verifique o link e tente novamente.</p>
      </div>
    </div>
  );

  const isCancelled = order.status === "cancelled";
  const currentStep = isCancelled ? -1 : stepIndex(order.status);
  const primary = order.restaurant?.primary_color || "#EF4444";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ background: primary }} className="px-4 pt-10 pb-6 text-white text-center">
        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/20 mx-auto mb-3 grid place-items-center">
          {order.restaurant?.logo_url
            ? <img src={order.restaurant.logo_url} alt="logo" className="w-full h-full object-cover" />
            : <Store className="w-7 h-7 text-white" />}
        </div>
        <p className="font-display font-bold text-lg">{order.restaurant?.name}</p>
        <p className="text-white/70 text-sm">Rastreamento do pedido</p>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 pb-10 space-y-4">
        {/* Order card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-display font-bold text-xl">Pedido #{order.order_number}</p>
            {isCancelled ? (
              <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full">Cancelado</span>
            ) : (
              <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ background: primary }}>
                {STEPS[currentStep]?.label}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">Olá, <span className="font-medium text-gray-700">{order.customer_name}</span>!</p>
        </div>

        {/* Timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="font-semibold text-sm text-gray-700 mb-4">Status do pedido</p>
            <div className="space-y-0">
              {STEPS.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                const future = i > currentStep;
                const Icon = step.icon;
                const isLast = i === STEPS.length - 1;

                return (
                  <div key={step.status} className="flex gap-3">
                    {/* Icon + line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full grid place-items-center border-2 transition-all duration-500 shrink-0 ${
                          done
                            ? "border-transparent text-white"
                            : active
                            ? "border-transparent text-white animate-pulse"
                            : "border-gray-200 bg-white text-gray-300"
                        }`}
                        style={done || active ? { background: primary } : {}}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {!isLast && (
                        <div
                          className="w-0.5 h-8 my-1 transition-all duration-700"
                          style={{ background: done ? primary : "#e5e7eb" }}
                        />
                      )}
                    </div>
                    {/* Label */}
                    <div className="pb-6 pt-1.5">
                      <p className={`text-sm font-semibold leading-none ${future ? "text-gray-300" : "text-gray-800"}`}>
                        {step.label}
                      </p>
                      {(done || active) && (
                        <p className="text-xs text-gray-400 mt-1">{step.desc}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
            <p className="font-semibold text-red-700">Pedido cancelado</p>
            <p className="text-sm text-red-500 mt-1">Entre em contato com o restaurante para mais informações.</p>
          </div>
        )}

        {/* Items summary */}
        {order.items && order.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="font-semibold text-sm text-gray-700 mb-3">Itens do pedido</p>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.quantity}x {item.product_name}</span>
                  <span className="font-medium">{brl(item.total_price)}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{brl(order.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Contact */}
        {(order.restaurant?.phone || order.restaurant?.whatsapp) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-3">
            {order.restaurant?.whatsapp && (
              <a
                href={`https://wa.me/55${order.restaurant.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-green-200 text-green-600 text-sm font-semibold hover:bg-green-50 transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            {order.restaurant?.phone && (
              <a
                href={`tel:${order.restaurant.phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                <Phone className="w-4 h-4" /> Ligar
              </a>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Atualiza automaticamente a cada 30 segundos
        </p>
      </div>
    </div>
  );
}
