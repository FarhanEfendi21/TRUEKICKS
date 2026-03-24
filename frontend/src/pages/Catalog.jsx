import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";

export default function Catalog() {
  const location = useLocation();
  const searchKeyword = location.state?.keyword || "";
  const [searchTerm, setSearchTerm] = useState(searchKeyword);
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Fetch data with React Query
  const fetchProducts = async () => {
    const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
    const { data } = await axios.get(`${API_URL}/api/sneakers`);
    return data;
  };

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ['catalogProducts'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  useEffect(() => {
    if (location.state?.keyword && location.state.keyword !== searchTerm) {
      setSearchTerm(location.state.keyword);
    }

    if (searchTerm) {
      const results = products.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(results);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products, location.state]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white font-poppins overflow-x-hidden">
      <Navbar />

      <div className="pt-32 pb-16 max-w-7xl mx-auto px-6">

        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-900 mb-2">CATALOG</h1>
          {searchTerm && (
            <p className="text-gray-500">
              Showing results for: <span className="font-bold text-black">"{searchTerm}"</span>
            </p>
          )}
        </div>

        {/* Grid Produk */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
            {[...Array(8)].map((_, i) => (
               <div key={i} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3">
                 <div className="w-full h-[180px] bg-gray-200 rounded-2xl animate-pulse"></div>
                 <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse"></div>
                 <div className="w-1/2 h-3 bg-gray-200 rounded animate-pulse"></div>
                 <div className="flex justify-between items-center mt-auto pt-2">
                   <div className="w-1/3 h-5 bg-gray-200 rounded animate-pulse"></div>
                   <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                 </div>
               </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-xl font-bold text-red-500 mb-2">Failed to load catalog.</p>
            <p className="text-gray-500">Please check your network or try again later.</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
            {filteredProducts.map((item, index) => (
              <ProductCard
                key={item.id}
                item={item}
                index={index}
                productType="sneakers"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 mb-6 rounded-full bg-gray-50 flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-400">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
               </svg>
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Nothing found</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">We couldn't find any products matching <span className="font-bold text-gray-900">"{searchTerm}"</span>. Try adjusting your search.</p>
            <button onClick={() => setSearchTerm("")} className="px-6 py-3 bg-black text-white font-bold rounded-xl hover:bg-[#FF5500] hover:shadow-lg transition-all active:scale-95">
              Clear Search
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}