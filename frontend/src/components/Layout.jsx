import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function Layout() {
  return (
    <div className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen font-poppins transition-colors duration-300">
      {/* Outlet adalah tempat halaman (Home/Catalog) akan muncul */}
      <Outlet />
      
      {/* Navigasi Bawah selalu muncul di sini */}
      <BottomNav />
    </div>
  );
}