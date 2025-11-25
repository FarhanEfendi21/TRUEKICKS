import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useCart } from "../Context/CartContext";

export default function Cart() {
  const { cartItems, removeFromCart, updateQuantity, totalPrice } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fungsi utilitas untuk memastikan harga yang di-render adalah angka
  const safePrice = (price) => Number(price) || 0;

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 font-poppins flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center text-center px-6">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Your Bag is Empty</h2>
          <p className="text-gray-500 mb-8">Looks like you haven't added any sneakers yet.</p>
          <button 
            onClick={() => navigate('/home')}
            className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
          >
            Start Shopping
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-poppins">
      <Navbar />

      <main className="pt-24 pb-32 md:pt-32 md:pb-20 max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-end justify-between mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-black text-gray-900">MY BAG <span className="text-[#FF5500]">({cartItems.length})</span></h1>
            <button onClick={() => navigate('/home')} className="text-xs font-bold underline underline-offset-4 text-gray-500 hover:text-black">Continue Shopping</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
                  {/* === DAFTAR ITEM === */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {cartItems.map((item) => {
                const itemPrice = safePrice(item.price);
                const subtotalItem = itemPrice * item.quantity;
                
                return (
                    <div key={`${item.id}-${item.size}`} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex gap-4 md:gap-6 items-start md:items-center relative group transition-all hover:shadow-md">
                        
                        {/* Gambar (Ukuran disesuaikan untuk mobile) */}
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-gray-50 rounded-xl md:rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden p-2">
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                        </div>

                        {/* Info Produk */}
                        <div className="flex-grow flex flex-col justify-between min-h-[96px] md:min-h-[128px]">
                          <div>
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-sm md:text-lg text-gray-900 leading-snug line-clamp-2 md:line-clamp-none pr-6">{item.name}</h3>
                                {/* Tombol Hapus (Mobile: Absolute Top Right) */}
                                <button 
                                  onClick={() => removeFromCart(item.id, item.size)}
                                  className="text-gray-300 hover:text-red-500 transition-colors -mt-1 -mr-2 p-2"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.636-1.452zM12.75 9.75a.75.75 0 10-1.5 0v8.625a.75.75 0 101.5 0V9.75zm-3.375 0a.75.75 0 10-1.5 0v8.625a.75.75 0 101.5 0V9.75zm6.75 0a.75.75 0 10-1.5 0v8.625a.75.75 0 101.5 0V9.75z" clipRule="evenodd" />
                                  </svg>
                                </button>
                            </div>
                            <p className="text-xs md:text-sm text-gray-500 mt-1">Size: <span className="font-bold text-black">{item.size}</span></p>
                          </div>

                          <div className="flex justify-between items-end mt-2 md:mt-4">
                            {/* Quantity Control (Compact) */}
                            <div className="flex items-center border border-gray-200 rounded-lg md:rounded-full px-2 py-1 md:px-3 gap-3 md:gap-4 bg-gray-50 h-8 md:h-10">
                              <button onClick={() => updateQuantity(item.id, item.size, Math.max(1, item.quantity - 1))} className="text-gray-400 hover:text-black font-bold text-base md:text-lg flex items-center justify-center w-4">-</button>
                              <span className="text-xs md:text-sm font-bold w-4 text-center">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)} className="text-gray-400 hover:text-black font-bold text-base md:text-lg flex items-center justify-center w-4">+</button>
                            </div>
                            
                            {/* Harga */}
                            <p className="text-sm md:text-lg font-black text-gray-900">
                              Rp {(subtotalItem / 1000).toLocaleString()}K
                            </p>
                          </div>
                        </div>
                    </div>
                );
            })}
          </div>

          {/* SUMMARY / CHECKOUT */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 sticky top-32">
              <h2 className="font-black text-xl mb-6">SUMMARY</h2>
              
              <div className="space-y-4 mb-6 border-b border-gray-100 pb-6">
                <div className="flex justify-between text-gray-500 text-sm">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900">Rp {(totalPrice / 1000).toLocaleString()}K</span>
                </div>
                <div className="flex justify-between text-gray-500 text-sm">
                  <span>Estimated Delivery</span>
                  <span className="text-green-600 font-bold">Free</span>
                </div>
                <div className="flex justify-between text-gray-500 text-sm">
                  <span>Tax</span>
                  <span>-</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-8">
                <span className="font-bold text-lg">Total</span>
                {/* Total Price Display (FIXED) */}
                <span className="font-black text-2xl text-[#FF5500]">Rp {(totalPrice / 1000).toLocaleString()}K</span>
              </div>

              <button 
                onClick={() => navigate('/checkout')}
                className="w-full bg-black text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-gray-900/20 hover:bg-gray-900 hover:scale-[1.02] transition-all active:scale-95 flex justify-center items-center gap-2"
              >
                Checkout
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </button>
              
              <div className="mt-6 flex items-center justify-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wider">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                SECURE CHECKOUT
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}