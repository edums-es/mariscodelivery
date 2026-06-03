import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { API } from "@/lib/api";
import { brl } from "@/lib/format";
import {
  Phone, Search, Clock, CheckCircle2, ChefHat, Package,
  Bike, Star, XCircle, Loader2, ChevronRight, Store,
  ShoppingBag, RefreshCw,
} from "lucide-react";

const STATUS_LABEL = {
  pending:          { label: "Aguardando",     color: "bg-amber-100 text-amber-700",   icon: Clock },
  accepted:         { label: "Aceito",          color: "bg-blue-100 text-blue-700",     icon: CheckCircle2 },
  preparing:        { label: "Em preparo",      color: "bg-orange-100 text-orange-700", icon: ChefHat },
  ready:            { label: "Pronto",          color: "bg-purple-100 text-purple-700", icon: Package },
  out_for_delivery: { label: "A caminho",       color: "bg-indigo-100 text-indigo-700", icon: Bike },
  completed:        { label: "Entregue",        color: "bg-green-100 text-green-700",   icon: Star },
  cancelled:        { label: "Cancelado",       color: "bg-red-100 text-red-700",       icon: XCircle },
};

function maskPhone(value) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return value;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function OrderCard({ order, primary }) {
  const info = STATUS_LABEL[order.status] || STATUS_LABEL.pending;
  const Icon = info.icon;
  const isActive = !["completed","cancelled"].includes(order.status);

  return (
    <Link
      to={`/pedido/${order.id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-gray-800 truncate">
              Pedido #{order.order_number}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{order.restaurant_name}</p>
          </div>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${info.color}`}>
            <Icon className="w-3 h-3" />
            {info.label}
          </span>
        </div>

        {/* Items preview */}
        {order.items && order.items.length > 0 && (
          <p className="text-sm text-gray-500 truncate mb-2">
            {order.items.slice(0, 2).map(it => `${it.quantity}x ${it.product_name}`).join(", ")}
            {order.items.length > 2 && ` +${order.items.length - 2}`}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
            <p className="font-bold text-gray-800 text-sm">{brl(order.total)}</p>
          </div>
          <div className="flex items-center gap-1">
            {isActive && (
              <span className="text-xs font-semibold text-white px-2 py-1 rounded-full" style={{ background: primary }}>
                Acompanhar
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>
      </div>

      {/* Active progress bar */}
      {isActive && (
        <div className="h-1 bg-gray-100">
          <div
            className="h-full transition-all duration-700"
            style={{
              background: primary,
              width: {
                pending: "10%", accepted: "25%", preparing: "50%",
                ready: "75%", out_for_delivery: "90%",
              }[order.status] || "0%",
            }}
          />
        </div>
      )}
    </Link>
  );
}

export default function MyOrders() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [inputPhone, setInputPhone] = useState(maskPhone(searchParams.get("phone") || ""));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const primary = "#EF4444"; // fallback; será substituído pelo primary do restaurante se tiver

  const search = async (rawPhone) => {
    const clean = rawPhone.replace(/\D/g, "");
    if (clean.length < 8) {
      setError("Digite um número de telefone válido.");
      return;
    }
    setError("");
    setLoading(true);
    setSearched(false);
    try {
      const params = { phone: clean };
      if (slug) params.slug = slug;
      const { data } = await axios.get(`${API}/public/track`, { params });
      setOrders(data);
      setSearched(true);
    } catch {
      setError("Erro ao buscar pedidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-search se phone vier na URL
  useEffect(() => {
    const urlPhone = searchParams.get("phone");
    if (urlPhone && urlPhone.replace(/\D/g, "").length >= 8) {
      search(urlPhone);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    search(inputPhone);
  };

  const active = orders.filter(o => !["completed","cancelled"].includes(o.status));
  const past   = orders.filter(o =>  ["completed","cancelled"].includes(o.status));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-10 pb-6">
        <div className="max-w-md mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 mx-auto mb-3 grid place-items-center">
            <ShoppingBag className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="font-display font-bold text-2xl text-gray-800">Meus Pedidos</h1>
          <p className="text-sm text-gray-400 mt-1">
            Digite seu telefone para ver seus pedidos
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Search form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Número de telefone
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={inputPhone}
                onChange={(e) => setInputPhone(maskPhone(e.target.value))}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ background: primary }}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        )}

        {/* Results */}
        {!loading && searched && (
          <>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="font-semibold text-gray-600">Nenhum pedido encontrado</p>
                <p className="text-sm text-gray-400 mt-1">
                  Verifique o número digitado ou faça seu primeiro pedido!
                </p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">
                    {orders.length} pedido{orders.length !== 1 ? "s" : ""} encontrado{orders.length !== 1 ? "s" : ""}
                  </p>
                  <button
                    onClick={() => search(inputPhone)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Atualizar
                  </button>
                </div>

                {/* Active orders */}
                {active.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Em andamento ({active.length})
                    </p>
                    {active.map(o => (
                      <OrderCard key={o.id} order={o} primary={primary} />
                    ))}
                  </div>
                )}

                {/* Past orders */}
                {past.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Histórico ({past.length})
                    </p>
                    {past.map(o => (
                      <OrderCard key={o.id} order={o} primary={primary} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!searched && !loading && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400">
              Digite seu telefone acima para consultar seus pedidos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
