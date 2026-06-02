import { useEffect, useState, useRef, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  Search,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  X,
  Star,
  Bell,
} from "lucide-react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "card", label: "Cartão" },
];

function useNotificationSound() {
  const audioRef = useRef(null);
  const play = useCallback(() => {
    try {
      if (!audioRef.current) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {}
  }, []);
  return play;
}

export default function PDV() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [changeFor, setChangeFor] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lastPendingIds, setLastPendingIds] = useState(new Set());
  const playSound = useNotificationSound();

  const loadProducts = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        api.get("/admin/products"),
        api.get("/admin/categories"),
      ]);
      setProducts(productsRes.data.filter((p) => p.is_available));
      setCategories(categoriesRes.data);
    } catch {
      toast.error("Erro ao carregar produtos");
    }
  };

  const loadSummary = async () => {
    try {
      const r = await api.get("/admin/pdv/summary");
      setSummary(r.data);
    } catch {}
  };

  const pollPendingOrders = useCallback(async () => {
    try {
      const r = await api.get("/admin/orders", { params: { status: "pending" } });
      const newIds = new Set((r.data || []).map((o) => o.id));
      const hasNew = [...newIds].some((id) => !lastPendingIds.has(id));
      if (hasNew && lastPendingIds.size > 0) {
        playSound();
        toast("Novo pedido recebido!", {
          icon: <Bell className="w-4 h-4 text-orange-500" />,
          duration: 6000,
        });
      }
      setLastPendingIds(newIds);
    } catch {}
  }, [lastPendingIds, playSound]);

  useEffect(() => {
    loadProducts();
    loadSummary();
  }, []);

  useEffect(() => {
    const interval = setInterval(pollPendingOrders, 5000);
    return () => clearInterval(interval);
  }, [pollPendingOrders]);

  const filteredProducts = products.filter((p) => {
    const matchCat =
      selectedCategory === "all" || p.category_id === selectedCategory;
    const matchSearch =
      !productSearch.trim() ||
      p.name.toLowerCase().includes(productSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setDiscount("0");
    setPaymentMethod("cash");
    setChangeFor("");
  };

  const subtotal = cart.reduce(
    (acc, i) => acc + (i.promotional_price || i.price) * i.quantity,
    0
  );
  const discountAmount = Math.min(
    subtotal,
    Math.max(0, parseFloat(discount) || 0)
  );
  const total = subtotal - discountAmount;
  const changeAmount =
    paymentMethod === "cash" && changeFor
      ? Math.max(0, parseFloat(changeFor) - total)
      : 0;

  const finishSale = async () => {
    if (cart.length === 0) return toast.error("Carrinho vazio");
    setFinishing(true);
    try {
      const r = await api.post("/admin/pdv/order", {
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        items: cart.map((i) => ({
          product_id: i.id,
          product_name: i.name,
          quantity: i.quantity,
          unit_price: i.promotional_price || i.price,
          total_price: (i.promotional_price || i.price) * i.quantity,
          options: [],
          notes: "",
        })),
        subtotal: subtotal,
        total: total,
        discount: discountAmount,
        payment_method: paymentMethod,
        change_for: paymentMethod === "cash" && changeFor ? parseFloat(changeFor) : null,
      });
      setReceiptData({
        ...r.data,
        cart: [...cart],
        subtotal,
        discountAmount,
        total,
        changeAmount,
        paymentMethod,
        customerName,
        changeFor: parseFloat(changeFor) || 0,
      });
      setReceiptOpen(true);
      clearCart();
      loadSummary();
      toast.success("Venda finalizada com sucesso!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao finalizar venda");
    } finally {
      setFinishing(false);
    }
  };

  const printReceipt = () => {
    if (!receiptData) return;
    const win = window.open("", "_blank", "width=400,height=600");
    const itemsHtml = receiptData.cart
      .map(
        (i) =>
          `<tr>
            <td style="padding:3px 0">${i.name} x${i.quantity}</td>
            <td style="padding:3px 0;text-align:right">${brl((i.promotional_price || i.price) * i.quantity)}</td>
          </tr>`
      )
      .join("");
    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8"/>
        <title>Recibo</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 16px; max-width: 320px; margin: 0 auto; }
          h2 { text-align: center; font-size: 16px; margin-bottom: 4px; }
          .center { text-align: center; }
          .divider { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; }
          .total-row { font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <h2>MariscoDelivery</h2>
        <p class="center">Recibo de Venda PDV</p>
        <p class="center">${new Date().toLocaleString("pt-BR")}</p>
        <hr class="divider"/>
        ${receiptData.customerName ? `<p>Cliente: ${receiptData.customerName}</p>` : ""}
        <hr class="divider"/>
        <table>
          <tbody>${itemsHtml}</tbody>
        </table>
        <hr class="divider"/>
        <table>
          <tr><td>Subtotal:</td><td style="text-align:right">${brl(receiptData.subtotal)}</td></tr>
          ${receiptData.discountAmount > 0 ? `<tr><td>Desconto:</td><td style="text-align:right">- ${brl(receiptData.discountAmount)}</td></tr>` : ""}
          <tr class="total-row"><td>TOTAL:</td><td style="text-align:right">${brl(receiptData.total)}</td></tr>
          <tr><td>Pagamento:</td><td style="text-align:right">${PAYMENT_METHODS.find((m) => m.value === receiptData.paymentMethod)?.label || receiptData.paymentMethod}</td></tr>
          ${receiptData.paymentMethod === "cash" && receiptData.changeFor > 0 ? `<tr><td>Troco p/:</td><td style="text-align:right">${brl(receiptData.changeFor)}</td></tr><tr><td>Troco:</td><td style="text-align:right">${brl(receiptData.changeAmount)}</td></tr>` : ""}
          ${receiptData.loyalty_points_earned ? `<tr><td>Pontos ganhos:</td><td style="text-align:right">+${receiptData.loyalty_points_earned} pts</td></tr>` : ""}
        </table>
        <hr class="divider"/>
        <p class="center">Obrigado pela preferência!</p>
        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="flex flex-col gap-3" style={{height:"calc(100vh - 108px)"}}>
      {/* Compact Summary + Title */}
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl dark:text-white flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-orange-500"/> PDV
        </h1>
        {summary && (
          <div className="flex items-center gap-4">
            {[
              {icon:ShoppingBag, label:"Vendas", value: summary.orders_today ?? 0, color:"#3b82f6"},
              {icon:DollarSign,  label:"Receita", value: brl(summary.revenue_today ?? 0), color:"#22c55e"},
              {icon:TrendingUp,  label:"Ticket médio", value: brl(summary.avg_ticket ?? 0), color:"#f59e0b"},
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 bg-white dark:bg-[#111111] border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-1.5">
                <s.icon className="w-3.5 h-3.5" style={{color:s.color}}/>
                <span className="text-xs text-gray-400">{s.label}:</span>
                <span className="text-xs font-bold dark:text-white">{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main PDV Layout */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Left: Catalog */}
        <div className="flex flex-col flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="pl-9 h-9 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === "all"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredProducts.map((product) => {
                const inCart = cart.find((i) => i.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`relative rounded-lg border text-left p-3 transition-all hover:shadow-md active:scale-95 ${
                      inCart
                        ? "border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/30"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-700"
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-16 object-cover rounded mb-1.5"
                      />
                    )}
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                      {product.name}
                    </p>
                    <p className="text-sm font-bold text-orange-500 dark:text-orange-400">
                      {brl(product.promotional_price || product.price)}
                    </p>
                    {product.promotional_price && (
                      <p className="text-xs text-gray-400 line-through">
                        {brl(product.price)}
                      </p>
                    )}
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-4 text-center py-12 text-gray-400 dark:text-gray-600">
                  Nenhum produto encontrado
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Cart */}
        <div className="flex flex-col w-72 flex-shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              Carrinho
              {cart.length > 0 && (
                <Badge className="bg-orange-500 text-white ml-1">
                  {cart.reduce((a, i) => a + i.quantity, 0)}
                </Badge>
              )}
            </h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 py-10">
                <ShoppingCart className="w-10 h-10 mb-2" />
                <p className="text-sm">Carrinho vazio</p>
                <p className="text-xs mt-1">
                  Clique nos produtos para adicionar
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {cart.map((item) => (
                  <div key={item.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-orange-500 dark:text-orange-400">
                        {brl(item.promotional_price || item.price)} un.
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-gray-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {brl((item.promotional_price || item.price) * item.quantity)}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs dark:text-gray-300">Nome do cliente</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Opcional"
                  className="h-8 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs dark:text-gray-300">Telefone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="h-8 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs dark:text-gray-300">Desconto (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-8 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs dark:text-gray-300">Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-8 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {paymentMethod === "cash" && (
              <div className="space-y-1">
                <Label className="text-xs dark:text-gray-300">Troco para R$</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={changeFor}
                  onChange={(e) => setChangeFor(e.target.value)}
                  placeholder="Valor recebido"
                  className="h-8 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                {changeFor && parseFloat(changeFor) > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Troco: {brl(changeAmount)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1 py-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Desconto</span>
                  <span>- {brl(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-white">
                <span>Total</span>
                <span>{brl(total)}</span>
              </div>
            </div>

            <Button
              onClick={finishSale}
              disabled={cart.length === 0 || finishing}
              className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              <ShoppingCart className="w-4 h-4" />
              {finishing ? "Finalizando..." : "Finalizar Venda"}
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm dark:bg-gray-900 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-green-500" />
              Venda Realizada!
            </DialogTitle>
          </DialogHeader>

          {receiptData && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 text-center">
                <p className="text-sm text-green-700 dark:text-green-400 mb-1">
                  Total cobrado
                </p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {brl(receiptData.total)}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {PAYMENT_METHODS.find((m) => m.value === receiptData.paymentMethod)?.label}
                </p>
              </div>

              {receiptData.paymentMethod === "cash" && receiptData.changeFor > 0 && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    Troco
                  </span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {brl(receiptData.changeAmount)}
                  </span>
                </div>
              )}

              {receiptData.loyalty_points_earned && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <Star className="w-4 h-4" />
                    <span className="text-sm font-medium">Pontos ganhos</span>
                  </div>
                  <span className="font-bold text-orange-600 dark:text-orange-400">
                    +{receiptData.loyalty_points_earned} pts
                  </span>
                </div>
              )}

              <div className="space-y-1 text-sm">
                {receiptData.cart.map((i) => (
                  <div
                    key={i.id}
                    className="flex justify-between text-gray-600 dark:text-gray-400"
                  >
                    <span>
                      {i.name} x{i.quantity}
                    </span>
                    <span>
                      {brl((i.promotional_price || i.price) * i.quantity)}
                    </span>
                  </div>
                ))}
                {receiptData.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Desconto</span>
                    <span>- {brl(receiptData.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-800 pt-1 mt-1">
                  <span>Total</span>
                  <span>{brl(receiptData.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiptOpen(false)}
              className="dark:border-gray-600 dark:text-gray-200"
            >
              Fechar
            </Button>
            <Button onClick={printReceipt} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir Recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
