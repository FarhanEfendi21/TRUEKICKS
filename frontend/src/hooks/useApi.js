import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

// Fetch all sneakers
export function useSneakers() {
    return useQuery({
        queryKey: ["sneakers"],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/api/sneakers`);
            return data;
        },
        staleTime: 5 * 60 * 1000, // Data dianggap fresh selama 5 menit
        cacheTime: 30 * 60 * 1000, // Cache disimpan selama 30 menit
    });
}

// Fetch all apparel
export function useApparel() {
    return useQuery({
        queryKey: ["apparel"],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/api/apparel`);
            return data;
        },
        staleTime: 5 * 60 * 1000,
        cacheTime: 30 * 60 * 1000,
    });
}

// Fetch sale products
export function useSaleProducts() {
    return useQuery({
        queryKey: ["sale_products"],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/api/sale_products`);
            return data;
        },
        staleTime: 5 * 60 * 1000,
        cacheTime: 30 * 60 * 1000,
    });
}

// Fetch single product by type and id
export function useProduct(type, id) {
    return useQuery({
        queryKey: ["product", type, id],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/api/${type}/${id}`);
            return data;
        },
        enabled: !!type && !!id, // Hanya fetch jika type dan id tersedia
        staleTime: 10 * 60 * 1000,
        cacheTime: 60 * 60 * 1000,
    });
}

// Fetch reviews for a product
export function useReviews(productId, productType) {
    return useQuery({
        queryKey: ["reviews", productId, productType],
        queryFn: async () => {
            const { data } = await axios.get(
                `${API_URL}/api/reviews/${productId}?product_type=${productType}`
            );
            return data;
        },
        enabled: !!productId && !!productType,
        staleTime: 2 * 60 * 1000,
    });
}
