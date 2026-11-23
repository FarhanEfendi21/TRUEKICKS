import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import { translateOrderStatus } from "../lib/translations";
import { useLanguage } from "../Context/LanguageContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function VerifyAuthenticity() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const { language, locale, pick } = useLanguage();

  const [inputCode, setInputCode] = useState(() => (urlCode || "").toUpperCase());
  const [loading, setLoading] = useState(Boolean(urlCode));
  const [certificate, setCertificate] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const verifyCode = useCallback(
    async (rawCode) => {
      const clean = String(rawCode || "").trim().toUpperCase();
      if (!clean) {
        setCertificate(null);
        setErrorMsg("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg("");
      try {
        const res = await api.get(
          `/api/authenticity/${encodeURIComponent(clean)}`,
          { skipAuthRedirect: true }
        );
        if (res.data?.valid && res.data?.certificate) {
          setCertificate(res.data.certificate);
        } else {
          setCertificate(null);
          setErrorMsg(
            pick(
              "Kode tidak terdaftar. Periksa kembali kode pada invoice pesanan Anda.",
              "Code not registered. Double-check the code printed on your invoice."
            )
          );
        }
      } catch (error) {
        setCertificate(null);
        const status = error.response?.status;
        setErrorMsg(
          status === 400
            ? pick(
                "Format kode tidak valid. Contoh: TK-AUTH-XXXXXXXX-XXXXXXXX.",
                "Invalid code format. Example: TK-AUTH-XXXXXXXX-XXXXXXXX."
              )
            : pick(
                "Kode tidak terdaftar. Periksa kembali kode pada invoice pesanan Anda.",
                "Code not registered. Double-check the code printed on your invoice."
              )
        );
      } finally {
        setLoading(false);
      }
    },
    [pick]
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!urlCode) return undefined;
    const clean = urlCode.toUpperCase();
    const timer = setTimeout(() => {
      setInputCode(clean);
      verifyCode(clean);
    }, 0);
    return () => clearTimeout(timer);
  }, [urlCode, verifyCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) {
      toast.error(
        pick("Masukkan kode keaslian terlebih dahulu.", "Enter an authenticity code first.")
      );
      return;
    }
    if (clean === String(urlCode || "").toUpperCase()) {
      verifyCode(clean);
    } else {
      navigate(`/verify/${encodeURIComponent(clean)}`);
    }
  };

  const handleClear = () => {
    setInputCode("");
    setCertificate(null);
    setErrorMsg("");
    if (urlCode) {
      navigate("/verify", { replace: true });
    }
  };

  const handleCopyShareLink = async () => {
    if (!certificate?.code) return;
    const shareUrl = `${window.location.origin}/verify/${encodeURIComponent(
      certificate.code
    )}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(pick("Tautan verifikasi disalin.", "Verification link copied."));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(pick("Gagal menyalin tautan.", "Failed to copy link."));
    }
  };

  const formattedIssuedDate = certificate?.issued_at
    ? new Date(certificate.issued_at).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-poppins flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 w-full pt-32 md:pt-40 pb-28 max-w-xl mx-auto px-4 md:px-6">
        {/* === MINIMALIST HEADER === */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-950 dark:text-white">
            {pick("Verifikasi Keaslian", "Authenticity Verify")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            {pick(
              "Periksa keaslian produk menggunakan kode sertifikat digital pada invoice pesanan Anda.",
              "Verify product origin using the digital tag code printed on your order invoice."
            )}
          </p>
        </header>

        {/* === LOOKUP INPUT === */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 focus-within:bg-white dark:focus-within:bg-gray-950 focus-within:border-gray-950 dark:focus-within:border-white p-1.5 pl-5 transition-colors">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="TK-AUTH-XXXXXXXX-XXXXXXXX"
              aria-label={pick("Kode sertifikat keaslian", "Authenticity certificate code")}
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-w-0 bg-transparent py-2 text-sm font-mono font-semibold tracking-wide text-gray-950 dark:text-white placeholder:font-mono placeholder:font-normal placeholder:text-gray-400 focus:outline-none uppercase"
            />
            {inputCode && !loading && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={pick("Hapus kode", "Clear code")}
                className="w-7 h-7 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-6 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-xs font-semibold tracking-wide hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {loading ? pick("Memeriksa...", "Checking...") : pick("Periksa", "Verify")}
            </button>
          </div>
        </form>

        {/* === LOADING SKELETON === */}
        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-5 animate-pulse">
            <div className="space-y-2">
              <div className="h-3.5 w-28 bg-gray-100 dark:bg-gray-900 rounded" />
              <div className="h-6 w-56 bg-gray-100 dark:bg-gray-900 rounded" />
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-gray-900">
              <div className="h-9 bg-gray-100 dark:bg-gray-900 rounded" />
              <div className="h-9 bg-gray-100 dark:bg-gray-900 rounded" />
              <div className="h-9 bg-gray-100 dark:bg-gray-900 rounded" />
            </div>
            <div className="h-16 bg-gray-100 dark:bg-gray-900 rounded-xl" />
          </div>
        )}

        {/* === NOT FOUND / INVALID STATE === */}
        {!loading && errorMsg && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 p-6 flex items-start gap-3.5">
            <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              !
            </span>
            <div>
              <h2 className="text-sm font-bold text-gray-950 dark:text-white">
                {pick("Sertifikat tidak ditemukan", "Certificate not found")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {errorMsg}
              </p>
            </div>
          </div>
        )}

        {/* === VERIFIED CERTIFICATE DOSSIER === */}
        {!loading && certificate && (
          <section
            aria-label={pick("Hasil verifikasi keaslian", "Authenticity verification result")}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 divide-y divide-gray-100 dark:divide-gray-900"
          >
            {/* Status & Code */}
            <div className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-950 dark:text-white mb-2.5">
                  <span className="w-4 h-4 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-2.5 h-2.5"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span>{pick("Terverifikasi Asli", "Verified Authentic")}</span>
                </div>

                <p className="font-mono text-lg sm:text-xl font-bold tracking-tight text-gray-950 dark:text-white break-all">
                  {certificate.code}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="self-start text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white border border-gray-200 dark:border-gray-800 rounded-full px-3.5 py-1.5 transition-colors flex-shrink-0"
              >
                {copied
                  ? pick("Tersalin ✓", "Copied ✓")
                  : pick("Salin tautan", "Copy link")}
              </button>
            </div>

            {/* Core Metadata */}
            <dl className="px-6 py-5 grid grid-cols-3 gap-4">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {pick("Pemilik", "Owner")}
                </dt>
                <dd className="text-sm font-semibold text-gray-950 dark:text-white mt-1 truncate">
                  {certificate.buyer_masked}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {pick("Tanggal", "Issued")}
                </dt>
                <dd className="text-sm font-semibold text-gray-950 dark:text-white mt-1">
                  {formattedIssuedDate}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {pick("Status", "Status")}
                </dt>
                <dd className="text-sm font-semibold text-gray-950 dark:text-white mt-1">
                  {translateOrderStatus(certificate.status, language)}
                </dd>
              </div>
            </dl>

            {/* Verified Products */}
            <div className="p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                {pick("Produk", "Items")} ({certificate.items?.length || 0})
              </p>

              <div className="divide-y divide-gray-100 dark:divide-gray-900">
                {(certificate.items || []).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={!item.id}
                    onClick={() =>
                      item.id &&
                      navigate(`/product/${item.productType || "sneakers"}/${item.id}`)
                    }
                    className="w-full py-3 first:pt-1 last:pb-0 flex items-center gap-4 text-left group disabled:cursor-default"
                  >
                    <div className="w-14 h-14 rounded-xl bg-[#F6F6F6] dark:bg-gray-100 p-2 flex items-center justify-center flex-shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain mix-blend-multiply"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-950 dark:text-white truncate group-hover:text-[#FF5500] transition-colors">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {pick(
                          `Ukuran ${item.size} · Jumlah ${item.quantity}`,
                          `Size ${item.size} · Qty ${item.quantity}`
                        )}
                      </p>
                    </div>

                    {item.id && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-gray-950 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
