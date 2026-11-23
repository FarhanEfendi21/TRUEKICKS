import { Component } from "react";
import { resolveTranslation } from "../lib/translations";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "",
    };
  }

  componentDidCatch(error, info) {
    console.error("Page render error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, errorMessage: "" });
    window.location.href = "/home";
  };

  render() {
    if (this.state.hasError) {
      const lang =
        typeof window !== "undefined" && localStorage.getItem("truekicks_lang") === "en"
          ? "en"
          : "id";
      const tr = (key) => resolveTranslation(lang, key);

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-6 font-poppins">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 text-center shadow-xl">
            <h2 className="text-xl font-black tracking-tight mb-2">
              {tr("error.title")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {this.state.errorMessage || tr("error.fallbackMessage")}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-full bg-gray-900 dark:bg-[#FF5500] text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition"
              >
                {tr("error.reload")}
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-5 py-2.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition"
              >
                {tr("error.backHome")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
